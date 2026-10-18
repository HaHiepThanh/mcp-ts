/** Reproduce Khoa's main-dataset checks without changing the shared benchmark.
 * From mcp-academic: npx tsx scripts/run-khoa-cases.ts --suite
 * Logs go to outputs/khoa/<timestamp>/ unless --out is supplied.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { z } from 'zod';
import { parseCsv, toCsv } from '../src/lib/csv';
import { loadEnv, PROJECT_ROOT } from '../src/lib/env';
import { loadHostConfig, type HostConfig } from '../src/host/config';
import { McpHub, type ToolCallRecord } from '../src/host/mcp-hub';
import { ChatHost, type TurnLog } from '../src/host/host';
import { GeminiProvider } from '../src/host/providers/gemini';
import { OpenAICompatibleProvider } from '../src/host/providers/openai-compatible';

const expectedSchema = z.array(z.object({ tool: z.string(), values: z.record(z.string(), z.unknown()), error_contains: z.string().optional() })).min(1);
const noteSchema = z.object({ source: z.string(), status: z.string().optional(), calls: z.array(z.object({ arguments: z.record(z.string(), z.unknown()), excel: z.record(z.string(), z.string()).default({}) })) });
const readOnly = new Set(['search_teachers', 'class_timetable', 'teacher_workload', 'teacher_grade_report', 'attendance_summary', 'conduct_score', 'at_risk_students', 'get_transcript', 'tuition_status', 'outstanding_tuition', 'check_scholarship_eligibility', 'rank_scholarship_candidates', 'calculate_teacher_pay', 'payroll_summary']);
type Case = { id: string; question: string; calls: { server: string; tool: string; args: Record<string, unknown>; values: Record<string, unknown>; excel: Record<string, string>; errorContains?: string }[] };
type Summary = { configuration: string; planned: number; total: number; passed: number; failed: number; errors: number; startupErrors: number; complete: boolean; median_ms: number; input_tokens: number; output_tokens: number; extra_api_attempts: number; log: string };
const args = process.argv.slice(2);
const option = (name: string): string | undefined => {
    const i = args.indexOf(name);
    if (i < 0) return undefined;
    if (!args[i + 1] || args[i + 1].startsWith('--')) throw Error(`Missing value for ${name}`);
    return args[i + 1];
};
const hash = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const valueAt = (value: unknown, key: string): unknown => key.split('.').reduce<unknown>((v, k) => v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined, value);
const equal = (a: unknown, b: unknown): boolean => typeof b === 'number' ? typeof a === 'number' && Math.abs(a - b) < 1e-8 : JSON.stringify(a) === JSON.stringify(b);
function mentioned(answer: string, value: unknown): boolean {
    if (typeof value === 'boolean') return true; // Only a screen: exam restrictions need content review.
    const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![\\p{L}\\p{N}.])${escaped}${typeof value === 'number' ? '(?:\\.0+)?' : ''}(?![\\p{L}\\p{N}.])`, 'iu').test(answer.replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, ''));
}
function loadCases(file: string): Case[] {
    const table = parseCsv(readFileSync(file, 'utf8'));
    if (table.headers.join(',') !== 'id,question,expected_tools,expected_values,note') throw Error('Case CSV must have the five TASKS.md columns, in order.');
    const ids = new Set<string>();
    const cases = table.rows.map(row => {
        if (!row.id || ids.has(row.id) || !row.question) throw Error(`Missing or duplicate case ID/question: ${row.id}`);
        ids.add(row.id);
        const note = noteSchema.parse(JSON.parse(row.note));
        if (note.source !== 'main' || note.status === 'provisional') throw Error(`${row.id}: provisional finance data is excluded. Recompute on shared main after finance merges.`);
        const expected = expectedSchema.parse(JSON.parse(row.expected_values));
        if (expected.length !== note.calls.length || row.expected_tools !== expected.map(x => x.tool).join(';')) throw Error(`${row.id}: tools and call metadata disagree.`);
        return { id: row.id, question: row.question, calls: expected.map((e, i) => {
            const parts = e.tool.split('.');
            if (parts.length !== 2 || !readOnly.has(parts[1])) throw Error(`${row.id}: expected a qualified read-only tool, got ${e.tool}`);
            return { server: parts[0], tool: parts[1], args: note.calls[i].arguments, values: e.values, excel: note.calls[i].excel, errorContains: e.error_contains };
        }) };
    });
    const only = option('--only')?.split(',');
    if (only?.some(id => !ids.has(id))) throw Error('--only contains an unknown case ID.');
    const selected = only ? cases.filter(c => only.includes(c.id)) : cases;
    if (!selected.length) throw Error('No cases to run.');
    return selected;
}
function gitCommit(): string {
    try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: PROJECT_ROOT, encoding: 'utf8', windowsHide: true }).trim(); }
    catch { return 'unavailable'; }
}
function sourceHashes(): Record<string, string> {
    const files = readdirSync(path.join(PROJECT_ROOT, 'data/sample')).filter(f => f.endsWith('.csv')).map(f => `data/sample/${f}`);
    files.push('config/academic-rules.json', 'config/grading.json', 'config/academic.json');
    return Object.fromEntries(files.map(file => [file, hash(readFileSync(path.join(PROJECT_ROOT, file), 'utf8').replace(/\r\n/g, '\n'))]));
}
async function startHttp(config: HostConfig, children: ChildProcess[]): Promise<void> {
    for (const [name, server] of Object.entries(config.mcpServers)) {
        if (server.disabled || !('url' in server)) continue;
        if (!['academic', 'utility', 'finance'].includes(name)) throw Error(`Cannot automatically start HTTP server ${name}`);
        const url = new URL(server.url);
        if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:' || !url.port) throw Error('Auto-start requires an explicit localhost HTTP port.');
        const port = Number(url.port);
        await new Promise<void>((resolve, reject) => {
            const probe = createServer();
            probe.once('error', () => reject(Error(`Port ${port} is occupied. Stop that server or omit --start-http.`)));
            probe.listen(port, '127.0.0.1', () => probe.close(() => resolve()));
        });
        const entry = path.join(PROJECT_ROOT, `src/server/${name}/main.ts`);
        if (!existsSync(entry)) throw Error(`Server ${name} is not on this checkout.`);
        const child = spawn(process.execPath, ['--import', 'tsx', entry, '--http', '--port', String(port)], { cwd: PROJECT_ROOT, windowsHide: true, stdio: 'ignore' });
        let launchError: Error | undefined;
        child.once('error', e => { launchError = e; });
        children.push(child);
        let ready = false;
        for (let i = 0; i < 40; i++) {
            if (launchError || child.exitCode !== null) throw launchError ?? Error(`HTTP ${name} exited before startup.`);
            try { const response = await fetch(url, { signal: AbortSignal.timeout(600) }); if (response.status !== 404) { ready = true; break; } } catch { /* wait for this child */ }
            await pause(250);
        }
        if (!ready) throw Error(`HTTP ${name} startup timed out.`);
    }
}
async function run(configFile: string, llm: boolean, autoHttp: boolean, out: string, cases: Case[], csvFile: string, paceMs: number): Promise<Summary> {
    const { config } = loadHostConfig(configFile);
    const isHttp = Object.values(config.mcpServers).some(s => !s.disabled && 'url' in s);
    const label = llm ? `${config.llm.provider === 'gemini' ? 'gemini' : 'qwen'}-${isHttp ? 'http' : 'stdio'}` : `check-${isHttp ? 'http' : 'stdio'}`;
    const logFile = path.join(out, `${label}.jsonl`);
    writeFileSync(logFile, '', { flag: 'wx' }); // Existing measurement evidence is never overwritten.
    const redact = (s: string): string => Object.entries(process.env).filter(([k, v]) => /(?:API_KEY|TOKEN|SECRET|PASSWORD)$/.test(k) && v && v.length >= 8).reduce((text, [, value]) => text.split(value!).join('[REDACTED]').split(encodeURIComponent(value!)).join('[REDACTED]'), s);
    const log = (data: unknown) => appendFileSync(logFile, redact(JSON.stringify(data)) + '\n');
    const started = new Date().toISOString();
    log({ kind: 'metadata', started, mode: llm ? 'llm' : 'direct_mcp', scope: 'main dataset only; provisional finance excluded', config: configFile, effectiveConfig: config, configSha256: hash(JSON.stringify(config)), casesFile: path.relative(PROJECT_ROOT, csvFile), casesSha256: hash(readFileSync(csvFile)), runnerSha256: hash(readFileSync(import.meta.filename)), gitCommit: gitCommit(), sourceFiles: sourceHashes(), node: process.version, platform: process.platform, fallback: false, paceMs: llm ? paceMs : 0, expectedCases: cases, grading: 'Required tools/arguments and exact expected values; answerScreenPass only screens value presence, not semantic correctness.' });
    const hub = new McpHub({ onElicit: async () => ({ action: 'decline' }), onSample: async () => { throw Error('Sampling is not used by these read-only cases.'); } });
    const provider = llm ? config.llm.provider === 'gemini' ? new GeminiProvider({ ...config.llm, fallback: false }) : new OpenAICompatibleProvider({ baseUrl: config.llm.baseUrl!, model: config.llm.model!, temperature: config.llm.temperature, label: config.llm.label }) : undefined;
    const host = provider ? new ChatHost(config, provider, { configFile, verbose: false }) : undefined;
    let captured: ToolCallRecord[] = [];
    if (host) {
        const original = host.hub.callTool.bind(host.hub);
        host.hub.callTool = async (...params: Parameters<typeof original>) => { const result = await original(...params); captured.push(result); return result; };
    }
    const children: ChildProcess[] = [];
    const results: { status: string; ms: number; turn?: TurnLog }[] = [];
    let startupErrors = 0;
    try {
        if (autoHttp) await startHttp(config, children);
        if (host) await host.start();
        else for (const [name, server] of Object.entries(config.mcpServers)) if (!server.disabled) await hub.connect(name, server);
        const live = host?.hub ?? hub;
        log({ kind: 'capabilities', servers: [...live.servers.values()].map(s => ({ name: s.name, transport: s.transport, tools: s.tools.map(t => t.name) })) });
        for (const row of cases) {
            if (host) await pause(paceMs); // Outside per-question timing.
            const begin = performance.now();
            try {
                let turn: TurnLog | undefined;
                if (host) { captured = []; host.newConversation(); turn = await host.ask(row.question); }
                const actual = [];
                for (const call of row.calls) {
                    const got = host ? captured.find(c => c.server === call.server && c.tool === call.tool && Object.entries(call.args).every(([k, v]) => equal(c.args[k], v))) : await live.callTool(`${call.server}__${call.tool}`, call.args);
                    if (!got) { actual.push({ tool: call.tool, pass: false, checks: [], reason: 'Expected tool with required arguments not called' }); continue; }
                    const text = got.result.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
                    const checks = Object.entries(call.values).map(([key, value]) => ({ path: key, value, excel_cell: call.excel[key], actual: valueAt(got.result.structuredContent, key), pass: equal(valueAt(got.result.structuredContent, key), value), answerMentions: turn ? mentioned(turn.answer, value) : undefined }));
                    const pass = call.errorContains ? got.isError && text.includes(call.errorContains) : !got.isError && checks.every(c => c.pass);
                    actual.push({ server: call.server, tool: call.tool, pass, checks, result: got.result, ms: got.ms });
                }
                const subsetPass = actual.every(c => c.pass);
                const answerScreenPass = host ? actual.every(c => c.pass && c.checks.every(x => x.answerMentions)) : undefined;
                const result = { kind: 'case', id: row.id, question: row.question, status: subsetPass ? 'passed' : 'failed', subsetPass, answerScreenPass, requiresHumanReview: !!host, ms: Math.round(performance.now() - begin), actual, fullMcpResults: host ? captured : undefined, turn };
                log(result); results.push(result);
                console.log(`${label} ${row.id}: ${result.status} (${result.ms} ms)`);
            } catch (e) {
                const result = { kind: 'case', id: row.id, status: 'error', error: redact(String(e)), ms: Math.round(performance.now() - begin) };
                log(result); results.push(result); console.log(`${label} ${row.id}: error (see log)`);
                if (/quota|429|API.key|API_KEY/i.test(String(e))) break;
            }
        }
    } catch (e) { startupErrors++; log({ kind: 'startup_error', error: redact(String(e)) }); }
    finally {
        await host?.hub.close(); await hub.close();
        for (const child of children) child.kill();
    }
    const times = results.map(r => r.ms).sort((a, b) => a - b);
    const turns = results.flatMap(r => r.turn ? [r.turn] : []);
    const summary: Summary = { configuration: label, planned: cases.length, total: results.length, passed: results.filter(r => r.status === 'passed').length, failed: results.filter(r => r.status === 'failed').length, errors: results.filter(r => r.status === 'error').length, startupErrors, complete: results.length === cases.length && !startupErrors, median_ms: times.length ? (times[Math.floor((times.length - 1) / 2)] + times[Math.floor(times.length / 2)]) / 2 : 0, input_tokens: turns.reduce((n, t) => n + t.usage.inputTokens, 0), output_tokens: turns.reduce((n, t) => n + t.usage.outputTokens, 0), extra_api_attempts: turns.reduce((n, t) => n + t.llmCalls.reduce((m, c) => m + c.attempts - 1, 0), 0), log: path.basename(logFile) };
    log({ kind: 'summary', started, finished: new Date().toISOString(), ...summary });
    console.log(JSON.stringify(summary));
    if (!summary.complete || summary.failed || summary.errors) process.exitCode = 1;
    return summary;
}
async function main(): Promise<void> {
    loadEnv();
    const allowed = ['--suite', '--llm', '--start-http', '--dry-run', '--cases', '--config', '--only', '--out', '--pace-ms'];
    for (const a of args.filter(a => a.startsWith('--'))) if (!allowed.includes(a)) throw Error(`Unknown option: ${a}`);
    const csvFile = path.resolve(PROJECT_ROOT, option('--cases') ?? '../phase2/test-cases.csv');
    const cases = loadCases(csvFile);
    if (args.includes('--dry-run')) { console.log(JSON.stringify({ validated: cases.length, ids: cases.map(c => c.id), casesSha256: hash(readFileSync(csvFile)) })); return; }
    const paceMs = Number(option('--pace-ms') ?? 9000);
    if (!Number.isFinite(paceMs) || paceMs < 0) throw Error('--pace-ms must be non-negative.');
    const out = path.resolve(PROJECT_ROOT, option('--out') ?? `outputs/khoa/${new Date().toISOString().replace(/[:.]/g, '-')}`);
    mkdirSync(out, { recursive: true });
    const configs = '../phase2/runs/khoa/configs/';
    const suite = args.includes('--suite') ? [
        { file: `${configs}host-stdio.json`, llm: false, http: false },
        { file: `${configs}host-http.json`, llm: false, http: true },
        { file: `${configs}host-stdio.json`, llm: true, http: false }
    ] : [{ file: option('--config') ?? `${configs}host-stdio.json`, llm: args.includes('--llm'), http: args.includes('--start-http') }];
    const summaries = [];
    for (const mode of suite) summaries.push(await run(mode.file, mode.llm, mode.http, out, cases, csvFile, paceMs));
    writeFileSync(path.join(out, 'comparison.csv'), toCsv(['configuration', 'planned', 'total', 'passed', 'failed', 'errors', 'startupErrors', 'complete', 'median_ms', 'input_tokens', 'output_tokens', 'extra_api_attempts', 'log'], summaries), { flag: 'wx' });
    console.log(`Logs: ${out}`);
}
main().catch(e => { console.error((e as Error).message); process.exitCode = 1; });
