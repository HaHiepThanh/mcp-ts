/**
 * Kiểm tra môi trường M0: Node, MCP SDK v2 (stdio round-trip), Gemini, Ollama.
 * Chạy: npm run doctor  → in bảng kết quả + ghi outputs/logs/doctor.json
 * Không bao giờ in ra giá trị API key.
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
        detail: `v${process.versions.node} (cần >= 20)`
    });
}

function checkEnvFiles(): void {
    const files = loadEnv();
    record({
        name: 'File .env',
        status: files.length > 0 ? 'OK' : 'WARN',
        detail: files.length > 0 ? `đã nạp: ${files.map(f => path.relative(path.join(PROJECT_ROOT, '..'), f)).join(', ')}` : 'không tìm thấy'
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
        const { value: result, ms: callMs } = await timed(() => client.callTool({ name: 'xin_chao', arguments: { ten: 'Nhóm MCP' } }));
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

/** Các bản Flash ổn định, phiên bản cao nhất trước (bỏ lite/preview/exp/tts/image/live/...). */
function flashCandidates(names: string[]): string[] {
    const excluded = /lite|preview|exp|tts|image|live|audio|thinking|embedding|native|latest/;
    const version = (n: string): number => Number(/gemini-(\d+(?:\.\d+)?)/.exec(n)?.[1] ?? 0);
    return names.filter(n => n.includes('flash') && !excluded.test(n)).sort((a, b) => version(b) - version(a));
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Lỗi tạm thời phía Google (quá tải / vượt hạn mức) — đáng thử lại. */
function isTransient(error: unknown): boolean {
    return /"code":\s*(429|500|503)|UNAVAILABLE|RESOURCE_EXHAUSTED/.test(String(error));
}

async function checkGemini(): Promise<void> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        record({ name: 'Gemini', status: 'FAIL', detail: 'chưa có GEMINI_API_KEY trong .env' });
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
            record({ name: 'Gemini', status: 'WARN', detail: 'key hợp lệ nhưng không tìm thấy model Flash', data: { models: names } });
            return;
        }
        // Mỗi model thử tối đa 3 lần (chờ 2s, 4s); lỗi tạm thời thì chuyển sang model kế tiếp.
        for (const model of candidates) {
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const { value: reply, ms } = await timed(() =>
                        ai.models.generateContent({ model, contents: 'Chỉ trả lời đúng một từ: OK' })
                    );
                    data.attempts.push(`${model}#${attempt}: OK ${ms}ms`);
                    record({
                        name: 'Gemini',
                        status: 'OK',
                        detail: `key hợp lệ, model "${model}" trả lời "${reply.text?.trim()}" trong ${ms}ms (lần thử ${data.attempts.length})`,
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
        record({ name: 'Gemini', status: 'WARN', detail: 'key hợp lệ nhưng mọi model Flash đang quá tải — thử lại sau', data });
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
            detail: has ? `đang chạy, đã có model "${wanted}"` : `đang chạy nhưng chưa có "${wanted}" (ollama pull ${wanted})`,
            data: { models: models.map(m => ({ name: m.name, sizeGB: +(m.size / 1e9).toFixed(2) })) }
        });
    } catch {
        record({ name: 'Ollama', status: 'WARN', detail: `không kết nối được ${baseUrl} — chưa cài hoặc chưa mở Ollama` });
    }
}

console.log('== Kiểm tra môi trường mcp-hocvu ==\n');
checkNode();
checkEnvFiles();
await checkMcp();
await checkGemini();
await checkOllama();

const report = path.join(PROJECT_ROOT, 'outputs', 'logs', 'doctor.json');
writeFileSync(report, JSON.stringify({ at: new Date().toISOString(), checks }, null, 2));
console.log(`\nĐã ghi báo cáo: ${path.relative(PROJECT_ROOT, report)}`);
process.exitCode = checks.some(c => c.status === 'FAIL') ? 1 : 0;
