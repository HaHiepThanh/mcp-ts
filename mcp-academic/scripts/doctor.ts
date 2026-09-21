/**
 * Environment check: Node, MCP SDK v2 (stdio round-trip), Gemini, Ollama.
 * Run: npm run doctor  → prints a checklist + writes outputs/logs/doctor.json
 * Never prints API key values.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { GoogleGenAI } from '@google/genai';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

import { loadEnv, PROJECT_ROOT } from '../src/lib/env';

type Status = 'OK' | 'WARN' | 'FAIL';
interface Check {
    name: string;
    status: Status;
    detail: string;
    data?: unknown;
}

const checks: Check[] = [];
const icon: Record<Status, string> = { OK: '✅', WARN: '⚠️ ', FAIL: '❌' };

function record(check: Check): void {
    checks.push(check);
    console.log(`${icon[check.status]} ${check.name}: ${check.detail}`);
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
    const start = performance.now();
    const value = await fn();
    return { value, ms: Math.round(performance.now() - start) };
}

function checkNode(): void {
    const major = Number(process.versions.node.split('.')[0]);
    record({
        name: 'Node.js',
        status: major >= 20 ? 'OK' : 'FAIL',
        detail: `v${process.versions.node} (need >= 20)`
    });
}

function checkEnvFiles(): void {
    const files = loadEnv();
    record({
        name: 'File .env',
        status: files.length > 0 ? 'OK' : 'WARN',
        detail: files.length > 0 ? `loaded: ${files.map(f => path.relative(path.join(PROJECT_ROOT, '..'), f)).join(', ')}` : 'not found'
    });
}

async function checkMcp(): Promise<void> {
    const client = new Client({ name: 'doctor', version: '0.1.0' });
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: ['--import', 'tsx', path.join(PROJECT_ROOT, 'scripts', 'smoke-server.ts')],
        cwd: PROJECT_ROOT
    });
    try {
        const { ms: connectMs } = await timed(() => client.connect(transport));
        const tools = await client.listTools();
        const { value: result, ms: callMs } = await timed(() => client.callTool({ name: 'greet', arguments: { name: 'MCP team' } }));
        const text = result.content.find(block => block.type === 'text');
        const server = client.getServerVersion();
        record({
            name: 'MCP SDK v2 (stdio)',
            status: 'OK',
            detail: `server "${server?.name}" — ${tools.tools.length} tool, connect ${connectMs}ms, callTool ${callMs}ms → "${text && 'text' in text ? text.text : '?'}"`,
            data: { server, tools: tools.tools.map(t => t.name), connectMs, callMs }
        });
    } catch (error) {
        record({ name: 'MCP SDK v2 (stdio)', status: 'FAIL', detail: String(error) });
    } finally {
        await client.close();
    }
}

/** Stable Flash models, newest first (skips lite/preview/exp/tts/image/live/...). */
function flashCandidates(names: string[]): string[] {
    const excluded = /lite|preview|exp|tts|image|live|audio|thinking|embedding|native|latest/;
    const version = (n: string): number => Number(/gemini-(\d+(?:\.\d+)?)/.exec(n)?.[1] ?? 0);
    return names.filter(n => n.includes('flash') && !excluded.test(n)).sort((a, b) => version(b) - version(a));
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Transient Google-side errors (overloaded / rate limited) — worth retrying. */
function isTransient(error: unknown): boolean {
    return /"code":\s*(429|500|503)|UNAVAILABLE|RESOURCE_EXHAUSTED/.test(String(error));
}

async function checkGemini(): Promise<void> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        record({ name: 'Gemini', status: 'FAIL', detail: 'GEMINI_API_KEY missing from .env' });
        return;
    }
    try {
        const ai = new GoogleGenAI({ apiKey });
        const names: string[] = [];
        for await (const model of await ai.models.list()) {
            if (model.name && model.supportedActions?.includes('generateContent')) {
                names.push(model.name.replace(/^models\//, ''));
            }
        }
        const candidates = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : flashCandidates(names);
        const data = { candidates, flashModels: names.filter(n => n.includes('flash')), attempts: [] as string[] };
        if (candidates.length === 0) {
            record({ name: 'Gemini', status: 'WARN', detail: 'key is valid but no Flash model was found', data: { models: names } });
            return;
        }
        // Up to 3 attempts per model (wait 2s, 4s); on persistent transient errors move to the next model.
        for (const model of candidates) {
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const { value: reply, ms } = await timed(() =>
                        ai.models.generateContent({ model, contents: 'Reply with exactly one word: OK' })
                    );
                    data.attempts.push(`${model}#${attempt}: OK ${ms}ms`);
                    record({
                        name: 'Gemini',
                        status: 'OK',
                        detail: `key valid, model "${model}" replied "${reply.text?.trim()}" in ${ms}ms (attempt ${data.attempts.length})`,
                        data: { chosen: model, ...data }
                    });
                    return;
                } catch (error) {
                    data.attempts.push(`${model}#${attempt}: ${String(error).slice(0, 120)}`);
                    if (!isTransient(error)) throw error;
                    if (attempt < 3) await sleep(2000 * attempt);
                }
            }
        }
        record({ name: 'Gemini', status: 'WARN', detail: 'key is valid but every Flash model is overloaded — try again later', data });
    } catch (error) {
        record({ name: 'Gemini', status: 'FAIL', detail: String(error).slice(0, 300) });
    }
}

async function checkOllama(): Promise<void> {
    const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
    const wanted = process.env.OLLAMA_MODEL ?? 'qwen3:4b';
    try {
        const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
        const { models } = (await response.json()) as { models: { name: string; size: number }[] };
        const has = models.some(m => m.name === wanted);
        record({
            name: 'Ollama',
            status: has ? 'OK' : 'WARN',
            detail: has ? `running, model "${wanted}" installed` : `running but "${wanted}" is missing (ollama pull ${wanted})`,
            data: { models: models.map(m => ({ name: m.name, sizeGB: +(m.size / 1e9).toFixed(2) })) }
        });
    } catch {
        record({ name: 'Ollama', status: 'WARN', detail: `cannot reach ${baseUrl} — Ollama not installed or not running` });
    }
}

console.log('== mcp-academic environment check ==\n');
checkNode();
checkEnvFiles();
await checkMcp();
await checkGemini();
await checkOllama();

const report = path.join(PROJECT_ROOT, 'outputs', 'logs', 'doctor.json');
writeFileSync(report, JSON.stringify({ at: new Date().toISOString(), checks }, null, 2));
console.log(`\nReport written: ${path.relative(PROJECT_ROOT, report)}`);
process.exitCode = checks.some(c => c.status === 'FAIL') ? 1 : 0;
