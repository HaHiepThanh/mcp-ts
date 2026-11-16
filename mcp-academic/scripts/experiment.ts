/**
 * Phase-2 experiment runner. One experiment = one file config/experiments/E*.json = several configurations
 * ("variants") that differ in ONE parameter, run against the same scenarios (demo/scenarios.ts).
 *
 *   npm run experiment -- E3                 run every variant of E3
 *   npm run experiment -- E3 --only rounds-2 run one variant
 *   npm run experiment -- E3 --resume        skip (variant, scenario, repeat) already in the log
 *
 * Output (committed — this is the LOG the assignment asks for), in ../phase2/runs/<id>/:
 *   <variant>.jsonl   one line per scenario run: question, tool calls, answer, checks, timing, tokens
 *   summary.json      aggregated numbers per variant and per scenario group (read by experiments:report)
 *   config-used.json  the experiment file + the resolved host configuration of every variant
 *
 * kinds: "llm" (the host + an LLM answers the scenarios), "transport" (E7, no LLM),
 *        "interaction" (E8, no LLM: elicitation / sampling answers and the path-traversal check).
 */
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

import { type CallSeen, SCENARIOS, type Scenario, type ToolCaller } from '../demo/scenarios';
import { connectInProcess } from '../examples/_harness';
import { type HostConfig, loadHostConfig } from '../src/host/config';
import { ChatHost, type TurnLog } from '../src/host/host';
import { toolOutputForModel } from '../src/host/mcp-hub';
import { GeminiProvider } from '../src/host/providers/gemini';
import { OpenAICompatibleProvider } from '../src/host/providers/openai-compatible';
import type { LlmProvider } from '../src/host/providers/provider';
import { loadEnv, PROJECT_ROOT } from '../src/lib/env';
import { createAcademicServer } from '../src/server/academic/server';
import { createFinanceServer } from '../src/server/finance/server';
import { createUtilityServer } from '../src/server/utility/server';

loadEnv();
const argv = process.argv.slice(2);
const option = (name: string) => (argv.indexOf(`--${name}`) >= 0 ? argv[argv.indexOf(`--${name}`) + 1] : undefined);
const RUNS_DIR = path.resolve(PROJECT_ROOT, '..', 'phase2', 'runs');
const EXP_DIR = path.join(PROJECT_ROOT, 'config', 'experiments');

export interface Variant {
    id: string;
    label: string;
    /** Dotted host-config paths to override, plus "servers" (list of servers to keep on). */
    set: Record<string, unknown>;
    /** Per-variant overrides of the experiment's base config / repeat / pacing. */
    base?: string;
    repeat?: number;
    paceMs?: number;
}
export interface Experiment {
    id: string;
    title: string;
    question: string;
    hypothesis: string;
    kind: 'llm' | 'transport' | 'interaction';
    base?: string;
    scenarios?: 'all' | string[];
    repeat?: number;
    paceMs?: number;
    variants: Variant[];
    observation?: string;
}

export interface RunRecord {
    experiment: string;
    variant: string;
    scenario: string;
    group: string;
    repeat: number;
    question: string;
    mode: 'answer' | 'refusal';
    toolCalls: { server: string; tool: string; args: Record<string, unknown>; ms: number; isError: boolean }[];
    rounds: number;
    answer: string;
    expected: (string | number)[];
    missing: (string | number)[];
    checks: { tools: boolean; args: boolean; answer: boolean; forbidden: boolean; verify: boolean };
    attemptedForbidden: boolean;
    pass: boolean;
    llm: { model: string; calls: number; modelMs: number; retries: number; tokensIn: number; tokensOut: number; firstCallTokensIn: number };
    totalMs: number;
    error?: string;
    at: string;
}

// ── shared helpers ───────────────────────────────────────────────────
/** A number matches if a common rounding of it appears, with or without thousands separators (22867500 = "22,867,500"). */
export function contains(text: string, value: string | number): boolean {
    const haystack = text
        .toLowerCase()
        .normalize('NFC')
        .replace(/(\d)[,.](?=\d{3}(?!\d))/g, '$1');
    if (typeof value === 'number') {
        const variants = new Set([String(value), value.toFixed(2), value.toFixed(1), Number.isInteger(value) ? `${value}.0` : '']);
        return [...variants].filter(Boolean).some(v => new RegExp(`(^|[^\\d.])${v.replace('.', '\\.')}(?![\\d])`).test(haystack));
    }
    const needle = value.toLowerCase().normalize('NFC');
    if (needle.length <= 4) return new RegExp(`(^|[^\\p{L}\\p{N}])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'u').test(haystack);
    return haystack.includes(needle);
}

function setPath(target: Record<string, unknown>, dotted: string, value: unknown): void {
    const keys = dotted.split('.');
    let node = target;
    for (const k of keys.slice(0, -1)) node = (node[k] ??= {}) as Record<string, unknown>;
    node[keys.at(-1)!] = value;
}

export function resolveConfig(exp: Experiment, variant: Variant): HostConfig {
    const { config } = loadHostConfig(variant.base ?? exp.base ?? 'config/host.qwen.json');
    for (const [key, value] of Object.entries(variant.set)) {
        if (key === 'servers') for (const [name, server] of Object.entries(config.mcpServers)) server.disabled = !(value as string[]).includes(name);
        else setPath(config as unknown as Record<string, unknown>, key, value);
    }
    return config;
}

function makeProvider(llm: HostConfig['llm']): LlmProvider {
    if (llm.provider === 'gemini') return new GeminiProvider({ model: llm.model, temperature: llm.temperature, fallback: false });
    return new OpenAICompatibleProvider({ baseUrl: llm.baseUrl!, model: llm.model!, temperature: llm.temperature, label: llm.label });
}

async function makeOracle(): Promise<{ oracle: ToolCaller; close: () => Promise<void> }> {
    const conns = {
        academic: await connectInProcess(createAcademicServer),
        utility: await connectInProcess(createUtilityServer),
        finance: await connectInProcess(createFinanceServer)
    };
    const oracle: ToolCaller = async (server, tool, args) => {
        const r = await conns[server].client.callTool({ name: tool, arguments: args });
        return { ...(r.structuredContent as Record<string, unknown>), isError: r.isError === true };
    };
    return { oracle, close: async () => void (await Promise.all(Object.values(conns).map(c => c.close()))) };
}

const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const isQuotaError = (message?: string) => !!message && /"code":\s*429|RESOURCE_EXHAUSTED|exceeded your current quota/i.test(message);

// ── kind "llm" ───────────────────────────────────────────────────────
function judge(s: Scenario, log: TurnLog | undefined, expected: (string | number)[], enabled: Set<string>, verified: boolean, error?: string) {
    const calls: CallSeen[] = log?.toolCalls ?? [];
    const called = new Set(calls.map(t => `${t.server}.${t.tool}`));
    const answer = log?.answer ?? '';
    const refusalMode = (s.needs ?? []).some(n => !enabled.has(n));
    const attemptedForbidden = (s.forbidden ?? []).some(f => called.has(f));
    if (refusalMode) {
        // The needed server is switched off: correct = no invented numbers, and say it cannot be answered.
        const leaked = expected.filter(v => contains(answer, v));
        const ok = !error && leaked.length === 0 && /can(no|')t|cannot|unable|not able|no (access|tool|data|information)|don't have|do not have|not available|outside/i.test(answer);
        return { mode: 'refusal' as const, missing: leaked, attemptedForbidden, checks: { tools: true, args: true, answer: ok, forbidden: !attemptedForbidden, verify: true } };
    }
    const missing = expected.filter(v => !contains(answer, v));
    const checks = {
        tools: s.tools.every(t => t.split('|').some(alt => called.has(alt))),
        args: s.args ? s.args(calls) : true,
        answer: !error && missing.length === 0 && (s.answer ? s.answer(answer) : answer.length > 0),
        forbidden: !attemptedForbidden,
        verify: verified
    };
    return { mode: 'answer' as const, missing, attemptedForbidden, checks };
}

async function runLlm(exp: Experiment, variants: Variant[], outDir: string, resume: boolean): Promise<void> {
    // Scenarios that change server data (an accepted update_grade) run LAST, so they cannot change the ground truth of later scenarios.
    const changesData = (s: Scenario) => s.elicit === 'accept' && s.tools.includes('academic.update_grade');
    const scenarios = SCENARIOS.filter(s => !s.direct && (exp.scenarios === undefined || exp.scenarios === 'all' || exp.scenarios.includes(s.id))).sort(
        (a, b) => Number(changesData(a)) - Number(changesData(b))
    );
    const { oracle, close } = await makeOracle();
    const expected = new Map<string, (string | number)[]>();
    for (const s of scenarios) expected.set(s.id, s.expect ? await s.expect(oracle) : []);
    await close();

    for (const variant of variants) {
        const file = path.join(outDir, `${variant.id}.jsonl`);
        const done = new Set<string>();
        if (resume && existsSync(file)) for (const line of readFileSync(file, 'utf8').split('\n').filter(Boolean)) done.add(`${(JSON.parse(line) as RunRecord).scenario}#${(JSON.parse(line) as RunRecord).repeat}`);
        else if (existsSync(file)) rmSync(file);
        const config = resolveConfig(exp, variant);
        const enabled = new Set(Object.entries(config.mcpServers).filter(([, s]) => !s.disabled).map(([n]) => n));
        console.log(`\n▶ ${exp.id} · ${variant.id} — ${variant.label}`);
        let quotaFailures = 0;
        runs: for (let repeat = 1; repeat <= (variant.repeat ?? exp.repeat ?? 1); repeat++) {
            // Fresh server processes for every repeat: update_grade changes data in the server's memory.
            const host = new ChatHost(structuredClone(config), makeProvider(config.llm), { configFile: `${exp.id}/${variant.id}`, verbose: false });
            try {
                await host.start();
            } catch (error) {
                console.log(`  ✖ cannot start: ${(error as Error).message}`);
                await host.hub.close();
                break;
            }
            const live: ToolCaller = async (server, tool, args) => {
                const r = await host.hub.callTool(`${server}__${tool}`, args);
                const out = toolOutputForModel(r.result);
                return { ...(r.result.structuredContent ?? {}), isError: r.isError, text: String(out.error ?? out.result) };
            };
            for (const s of scenarios) {
                if (done.has(`${s.id}#${repeat}`)) continue;
                const pace = variant.paceMs ?? exp.paceMs;
                if (pace) await new Promise(resolve => setTimeout(resolve, pace));
                s.setup?.();
                host.config.elicitation.auto = s.elicit ?? 'decline';
                host.newConversation();
                let log: TurnLog | undefined;
                let error: string | undefined;
                try {
                    log = await host.ask(s.question);
                } catch (e) {
                    error = (e as Error).message.slice(0, 300);
                }
                quotaFailures = isQuotaError(error) ? quotaFailures + 1 : 0;
                if (quotaFailures >= 2) {
                    console.log('  ⏹ API quota exhausted — remaining scenarios of this variant skipped');
                    await host.hub.close();
                    break runs;
                }
                let verified = true;
                if (s.verify && !error) verified = await s.verify(live).catch(() => false);
                const want = expected.get(s.id) ?? [];
                const j = judge(s, log, want, enabled, verified, error);
                const chat = (log?.llmCalls ?? []).filter(c => c.purpose === 'chat');
                const record: RunRecord = {
                    experiment: exp.id,
                    variant: variant.id,
                    scenario: s.id,
                    group: s.group,
                    repeat,
                    question: s.question,
                    mode: j.mode,
                    toolCalls: (log?.toolCalls ?? []).map(({ server, tool, args, ms, isError }) => ({ server, tool, args, ms, isError })),
                    rounds: log?.rounds ?? 0,
                    answer: log?.answer ?? '',
                    expected: want,
                    missing: j.missing,
                    checks: j.checks,
                    attemptedForbidden: j.attemptedForbidden,
                    pass: Object.values(j.checks).every(Boolean),
                    llm: {
                        model: log?.model ?? config.llm.model ?? '?',
                        calls: log?.llmCalls.length ?? 0,
                        modelMs: (log?.llmCalls ?? []).reduce((a, x) => a + (x.lastMs ?? x.ms), 0),
                        retries: (log?.llmCalls ?? []).reduce((a, x) => a + x.attempts - 1, 0),
                        tokensIn: log?.usage.inputTokens ?? 0,
                        tokensOut: log?.usage.outputTokens ?? 0,
                        firstCallTokensIn: chat[0]?.inputTokens ?? 0
                    },
                    totalMs: log?.totalMs ?? 0,
                    error,
                    at: new Date().toISOString()
                };
                appendFileSync(file, JSON.stringify(record) + '\n');
                const failed = Object.entries(record.checks).filter(([, ok]) => !ok).map(([k]) => k);
                console.log(
                    `  ${record.pass ? '✔' : '✖'} r${repeat} ${s.id.padEnd(3)} ${(record.llm.modelMs / 1000).toFixed(1).padStart(5)}s · ${record.toolCalls.length} calls${failed.length ? ` · failed: ${failed.join(',')}` : ''}${record.missing.length ? ` · ${record.mode === 'refusal' ? 'leaked' : 'missing'} ${JSON.stringify(record.missing).slice(0, 80)}` : ''}${error ? ` · ${error.slice(0, 80)}` : ''}`
                );
            }
            await host.hub.close();
        }
    }
}

/** Re-apply the current scenario checks to logged answers (no LLM call). The side-effect check (verify) cannot be replayed and is kept. */
async function rejudge(exp: Experiment, outDir: string): Promise<void> {
    const { oracle, close } = await makeOracle();
    for (const variant of exp.variants) {
        const file = path.join(outDir, `${variant.id}.jsonl`);
        if (!existsSync(file)) continue;
        const enabled = new Set(Object.entries(resolveConfig(exp, variant).mcpServers).filter(([, s]) => !s.disabled).map(([n]) => n));
        let changed = 0;
        const lines = [];
        for (const line of readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
            const r = JSON.parse(line) as RunRecord;
            const s = SCENARIOS.find(x => x.id === r.scenario)!;
            const want = s.expect ? await s.expect(oracle) : [];
            const log = { toolCalls: r.toolCalls, answer: r.answer } as unknown as TurnLog;
            const j = judge(s, log, want, enabled, r.checks.verify, r.error);
            const pass = Object.values(j.checks).every(Boolean);
            if (pass !== r.pass) changed++;
            lines.push(JSON.stringify({ ...r, mode: j.mode, expected: want, missing: j.missing, checks: j.checks, attemptedForbidden: j.attemptedForbidden, pass, rejudgedAt: new Date().toISOString() }));
        }
        writeFileSync(file, lines.join('\n') + '\n');
        console.log(`  ${variant.id}: re-judged ${lines.length} runs, ${changed} verdict(s) changed`);
    }
    await close();
}

// ── kind "transport" (E7) ────────────────────────────────────────────
async function waitForPort(url: string, ms = 15000): Promise<void> {
    const until = Date.now() + ms;
    while (Date.now() < until) {
        try {
            await fetch(url, { method: 'GET' });
            return;
        } catch {
            await new Promise(r => setTimeout(r, 200));
        }
    }
    throw new Error(`server at ${url} did not start`);
}

async function runTransport(exp: Experiment, variants: Variant[], outDir: string): Promise<void> {
    const PORT = 3101;
    const httpServer = spawn(process.execPath, ['--import', 'tsx', 'src/server/academic/main.ts', '--http', '--port', String(PORT)], { cwd: PROJECT_ROOT, stdio: 'ignore' });
    try {
        await waitForPort(`http://127.0.0.1:${PORT}/mcp`);
        for (const variant of variants) {
            const { transport, protocol, connections = 10, calls = 20 } = variant.set as { transport: 'stdio' | 'http'; protocol: 'legacy' | '2026-07-28'; connections?: number; calls?: number };
            const file = path.join(outDir, `${variant.id}.jsonl`);
            if (existsSync(file)) rmSync(file);
            console.log(`\n▶ ${exp.id} · ${variant.id} — ${variant.label}`);
            for (let i = 1; i <= connections; i++) {
                const requests = new Map<string, number>();
                const countingFetch = async (url: string | URL, init?: RequestInit) => {
                    if (typeof init?.body === 'string') {
                        const method = (JSON.parse(init.body) as { method?: string }).method ?? '(response)';
                        requests.set(method, (requests.get(method) ?? 0) + 1);
                    }
                    return fetch(url, init);
                };
                const client = new Client({ name: 'e7', version: '1.0.0' }, protocol === 'legacy' ? {} : { versionNegotiation: { mode: { pin: protocol } } });
                const t0 = performance.now();
                await client.connect(
                    transport === 'http'
                        ? new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${PORT}/mcp`), { fetch: countingFetch })
                        : new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', 'src/server/academic/main.ts'], cwd: PROJECT_ROOT, stderr: 'ignore' })
                );
                const connectMs = performance.now() - t0;
                const connectRequests = transport === 'http' ? [...requests.values()].reduce((a, b) => a + b, 0) : protocol === 'legacy' ? 2 : 1;
                const callMs: number[] = [];
                for (let k = 0; k < calls; k++) {
                    const c0 = performance.now();
                    await client.callTool({ name: 'calculate_gpa', arguments: { student_id: '2201010' } });
                    callMs.push(performance.now() - c0);
                }
                await client.close();
                const rec = { experiment: exp.id, variant: variant.id, connection: i, era: client.getProtocolEra?.() ?? protocol, connectMs: Math.round(connectMs * 10) / 10, connectRequests, callMedianMs: Math.round(median(callMs) * 100) / 100, at: new Date().toISOString() };
                appendFileSync(file, JSON.stringify(rec) + '\n');
            }
            const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as { connectMs: number; callMedianMs: number; connectRequests: number });
            console.log(`  connect median ${median(lines.map(l => l.connectMs)).toFixed(1)} ms · call median ${median(lines.map(l => l.callMedianMs)).toFixed(2)} ms · ${lines[0].connectRequests} request(s) to connect`);
        }
    } finally {
        httpServer.kill();
    }
}

// ── kind "interaction" (E8) ──────────────────────────────────────────
async function runInteraction(exp: Experiment, variants: Variant[], outDir: string): Promise<void> {
    for (const variant of variants) {
        const { reply, era } = variant.set as { reply: 'accept' | 'decline' | 'cancel' | 'sampling-denied' | 'path-traversal'; era: 'legacy' | 'modern' };
        const file = path.join(outDir, `${variant.id}.jsonl`);
        if (existsSync(file)) rmSync(file);
        console.log(`\n▶ ${exp.id} · ${variant.id} — ${variant.label}`);
        const asked: string[] = [];
        const capabilities = { elicitation: { form: {} }, sampling: {} };
        const setup = (client: Client) => {
            client.setRequestHandler('elicitation/create', async request => {
                asked.push(request.params.message);
                if (reply === 'accept') return { action: 'accept', content: { confirm: true } };
                return { action: reply === 'cancel' ? 'cancel' : 'decline' };
            });
            client.setRequestHandler('sampling/createMessage', async () => {
                if (reply === 'sampling-denied') throw new Error('Sampling is disabled by host configuration');
                return { role: 'assistant', model: 'scripted', content: { type: 'text', text: 'Keep going!' } };
            });
        };
        const factory = variant.id.includes('path') ? createUtilityServer : createAcademicServer;
        const conn = await connectInProcess(factory, { era, capabilities, setup });
        const t0 = performance.now();
        let result;
        let changed: boolean | null = null;
        if (reply === 'path-traversal') {
            result = await conn.client.callTool({ name: 'save_report', arguments: { filename: '../../etc/passwd', content: 'x' } });
        } else if (reply === 'sampling-denied') {
            // 2026 era: the client answers input requests itself, so a refusal surfaces as an exception on the CLIENT side.
            result = await conn.client.callTool({ name: 'generate_student_feedback', arguments: { student_id: '2201010' } }).catch((e: Error) => ({
                content: [{ type: 'text', text: `client-side exception: ${e.message}` }],
                isError: true,
                thrownOnClient: true
            }));
        } else {
            // A different student per variant, so one variant's accepted change cannot affect another's check.
            const sid = { accept: '04', decline: '06', cancel: '08' }[reply].replace(/^/, era === 'legacy' ? '22010' : '22020');
            const before = await conn.client.callTool({ name: 'get_transcript', arguments: { student_id: sid, semester: '2024-1' } });
            const course = (before.structuredContent as { courses: { course_id: string; final_score: number }[] }).courses[0];
            const target = course.final_score === 9.9 ? 9.8 : 9.9;
            result = await conn.client.callTool({ name: 'update_grade', arguments: { student_id: sid, course_id: course.course_id, semester: '2024-1', final_score: target } });
            const after = await conn.client.callTool({ name: 'get_transcript', arguments: { student_id: sid, semester: '2024-1' } });
            changed = (after.structuredContent as { courses: { course_id: string; final_score: number }[] }).courses.find(c => c.course_id === course.course_id)!.final_score === target;
        }
        const ms = performance.now() - t0;
        await conn.close();
        const text = (result.content as { type: string; text?: string }[]).map(b => b.text ?? '').join(' ');
        const rec = { experiment: exp.id, variant: variant.id, era, reply, elicitationsAsked: asked.length, isError: result.isError === true, thrownOnClient: 'thrownOnClient' in result, dataChanged: changed, resultText: text.slice(0, 200), ms: Math.round(ms * 10) / 10, at: new Date().toISOString() };
        appendFileSync(file, JSON.stringify(rec) + '\n');
        console.log(`  asked ${asked.length}× · isError ${rec.isError} · data changed ${changed} · "${rec.resultText.slice(0, 90)}"`);
    }
}

// ── summary.json ─────────────────────────────────────────────────────
export function summarize(exp: Experiment, outDir: string): Record<string, unknown> {
    const variants = exp.variants.map(v => {
        const file = path.join(outDir, `${v.id}.jsonl`);
        const lines = existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
        if (exp.kind === 'transport') {
            return { id: v.id, label: v.label, runs: lines.length, connectMedianMs: median(lines.map(l => l.connectMs)), callMedianMs: median(lines.map(l => l.callMedianMs)), connectRequests: lines[0]?.connectRequests ?? null };
        }
        if (exp.kind === 'interaction') return { id: v.id, label: v.label, ...(lines[0] ?? {}) };
        const rs = lines as RunRecord[];
        const pct = (n: number) => (rs.length ? Math.round((n / rs.length) * 1000) / 10 : null);
        const groups = [...new Set(rs.map(r => r.group))].sort().map(g => {
            const gs = rs.filter(r => r.group === g);
            return { group: g, runs: gs.length, pass: gs.filter(r => r.pass).length, passPct: Math.round((gs.filter(r => r.pass).length / gs.length) * 1000) / 10 };
        });
        const byScenario = [...new Set(rs.map(r => r.scenario))].map(id => {
            const ss = rs.filter(r => r.scenario === id);
            return { scenario: id, pass: ss.filter(r => r.pass).length, runs: ss.length, distinctAnswers: new Set(ss.map(r => r.answer.trim())).size, failed: [...new Set(ss.flatMap(r => Object.entries(r.checks).filter(([, ok]) => !ok).map(([k]) => k)))] };
        });
        return {
            id: v.id,
            label: v.label,
            model: rs[0]?.llm.model ?? null,
            runs: rs.length,
            passPct: pct(rs.filter(r => r.pass).length),
            toolsPct: pct(rs.filter(r => r.checks.tools).length),
            argsPct: pct(rs.filter(r => r.checks.args).length),
            answerPct: pct(rs.filter(r => r.checks.answer).length),
            safetyViolations: rs.filter(r => r.attemptedForbidden).length,
            refusalRuns: rs.filter(r => r.mode === 'refusal').length,
            refusalPassPct: rs.some(r => r.mode === 'refusal') ? Math.round((rs.filter(r => r.mode === 'refusal' && r.pass).length / rs.filter(r => r.mode === 'refusal').length) * 1000) / 10 : null,
            medianModelS: Math.round(median(rs.map(r => r.llm.modelMs)) / 100) / 10,
            avgToolCalls: Math.round(avg(rs.map(r => r.toolCalls.length)) * 10) / 10,
            avgRounds: Math.round(avg(rs.map(r => r.rounds)) * 10) / 10,
            avgTokensIn: Math.round(avg(rs.map(r => r.llm.tokensIn))),
            avgTokensOut: Math.round(avg(rs.map(r => r.llm.tokensOut))),
            medianFirstCallTokensIn: median(rs.map(r => r.llm.firstCallTokensIn)),
            errors: rs.filter(r => r.error).length,
            groups,
            byScenario
        };
    });
    const summary = { experiment: exp.id, title: exp.title, question: exp.question, hypothesis: exp.hypothesis, kind: exp.kind, generatedAt: new Date().toISOString(), variants };
    writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
    return summary;
}

export function loadExperiment(id: string): Experiment {
    const file = readdirSync(EXP_DIR).find(f => f.startsWith(`${id}-`) || f === `${id}.json`);
    if (!file) throw new Error(`No experiment ${id} in config/experiments`);
    return JSON.parse(readFileSync(path.join(EXP_DIR, file), 'utf8')) as Experiment;
}

// ── main ─────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
    const ids = argv.filter(a => /^[EI]\d+$/.test(a));
    if (ids.length === 0) {
        console.log('Usage: npm run experiment -- E3 [--only variant-id] [--resume] [--summary-only]');
        process.exit(1);
    }
    for (const id of ids) {
        const exp = loadExperiment(id);
        const outDir = path.join(RUNS_DIR, exp.id);
        mkdirSync(outDir, { recursive: true });
        const only = option('only')?.split(',');
        const variants = only ? exp.variants.filter(v => only.includes(v.id)) : exp.variants;
        const started = performance.now();
        if (argv.includes('--rejudge')) await rejudge(exp, outDir);
        else if (!argv.includes('--summary-only')) {
            if (!argv.includes('--resume')) writeFileSync(
                path.join(outDir, 'config-used.json'),
                JSON.stringify({ experiment: exp, resolved: exp.kind === 'llm' ? Object.fromEntries(exp.variants.map(v => [v.id, resolveConfig(exp, v)])) : undefined }, null, 2)
            );
            if (exp.kind === 'llm') await runLlm(exp, variants, outDir, argv.includes('--resume'));
            else if (exp.kind === 'transport') await runTransport(exp, variants, outDir);
            else await runInteraction(exp, variants, outDir);
        }
        summarize(exp, outDir);
        console.log(`\n${exp.id} done in ${((performance.now() - started) / 60000).toFixed(1)} min → phase2/runs/${exp.id}/`);
    }
}
