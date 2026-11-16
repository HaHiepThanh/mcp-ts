/**
 * Runs the benchmark (demo/benchmark.ts) against several LLM configurations — same MCP servers,
 * same host, only the model changes — and writes:
 *   outputs/benchmarks/compare-<timestamp>.json   every turn in full
 *   docs/model-comparison.md                      summary tables for the slides
 *
 * Usage: npm run compare                        (all configurations)
 *        npm run compare -- --only qwen3-4b     (one configuration)
 *        npm run compare -- --repeat 2          (run every case twice)
 *        npm run compare -- --only gemini-3.8-flash --merge outputs/benchmarks/compare-X.json
 *              (re-run some configurations, keep the others from an earlier run)
 *        npm run compare -- --report outputs/benchmarks/compare-X.json   (rebuild the Markdown only)
 * Gemini runs without model fallback and waits out free-tier rate limits, so every answer comes
 * from the model under test; "model time" excludes those waits.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { CASES, type Oracle, type ToolCallSeen } from '../demo/benchmark';
import { connectInProcess } from '../examples/_harness';
import { loadEnv, PROJECT_ROOT } from '../src/lib/env';
import { type HostConfig, loadHostConfig } from '../src/host/config';
import { ChatHost, type TurnLog } from '../src/host/host';
import { GeminiProvider } from '../src/host/providers/gemini';
import { OpenAICompatibleProvider } from '../src/host/providers/openai-compatible';
import type { LlmProvider } from '../src/host/providers/provider';
import { createAcademicServer } from '../src/server/academic/server';
import { createUtilityServer } from '../src/server/utility/server';

loadEnv();
const argv = process.argv.slice(2);
const option = (name: string) => (argv.indexOf(`--${name}`) >= 0 ? argv[argv.indexOf(`--${name}`) + 1] : undefined);
const repeat = Number(option('repeat') ?? 1);

interface Variant {
    id: string;
    description: string;
    configFile: string;
    override?: Partial<HostConfig['llm']>;
    /** Pause between cases (ms) — keeps free-tier cloud APIs under their requests-per-minute limit. */
    paceMs?: number;
}

const VARIANTS: Variant[] = [
    { id: 'gemini-3.5-flash-lite', description: 'Cloud · Google · small/fast', configFile: 'config/host.json', override: { model: 'gemini-3.5-flash-lite' }, paceMs: 4000 },
    { id: 'gemini-3.8-flash', description: 'Cloud · Google · larger', configFile: 'config/host.json', override: { model: 'gemini-3.8-flash' }, paceMs: 8000 },
    { id: 'qwen3-4b-instruct', description: 'Local · Ollama · open weights, answers directly', configFile: 'config/host.qwen.json', override: { model: 'qwen3:4b-instruct' } },
    { id: 'qwen3-4b-thinking', description: 'Local · Ollama · open weights, reasons first', configFile: 'config/host.qwen.json', override: { model: 'qwen3:4b' } }
];
const selected = option('only') ? VARIANTS.filter(v => option('only')!.split(',').includes(v.id)) : VARIANTS;

function makeProvider(llm: HostConfig['llm']): LlmProvider {
    if (llm.provider === 'gemini') return new GeminiProvider({ model: llm.model, temperature: llm.temperature, fallback: false });
    return new OpenAICompatibleProvider({ baseUrl: llm.baseUrl!, model: llm.model!, temperature: llm.temperature, label: llm.label });
}

/** Ground truth straight from the MCP servers (no LLM involved). */
async function makeOracle(): Promise<{ oracle: Oracle; close: () => Promise<void> }> {
    const academic = await connectInProcess(createAcademicServer);
    const utility = await connectInProcess(createUtilityServer);
    const oracle: Oracle = async (server, tool, args) => {
        const client = server === 'academic' ? academic.client : utility.client;
        const result = await client.callTool({ name: tool, arguments: args });
        return result.structuredContent as Record<string, unknown>;
    };
    return { oracle, close: async () => (await academic.close(), await utility.close()) };
}

/** A number matches if any common rounding of it appears in the text (2.06 → "2.06", "2.1"). */
function contains(text: string, value: string | number): boolean {
    const haystack = text.toLowerCase().normalize('NFC');
    if (typeof value === 'number') {
        const variants = new Set([String(value), value.toFixed(2), value.toFixed(1), Number.isInteger(value) ? `${value}.0` : '']);
        return [...variants].filter(Boolean).some(v => new RegExp(`(^|[^\\d.])${v.replace('.', '\\.')}(?![\\d])`).test(haystack));
    }
    const needle = value.toLowerCase().normalize('NFC');
    // Short values ("B", "IT01") must match as a whole word, otherwise any "b" in the text would count.
    if (needle.length <= 4) return new RegExp(`(^|[^\\p{L}\\p{N}])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'u').test(haystack);
    return haystack.includes(needle);
}

interface CaseResult {
    variant: string;
    run: number;
    id: string;
    category: string;
    toolsOk: boolean;
    argsOk: boolean;
    answerOk: boolean;
    pass: boolean;
    missing: (string | number)[];
    totalMs: number;
    llmMs: number;
    /** LLM time without retries / rate-limit waits. */
    modelMs: number;
    retries: number;
    /** Every LLM call was answered by the model under test. */
    pureModel: boolean;
    rounds: number;
    toolCalls: number;
    toolErrors: number;
    inputTokens: number;
    outputTokens: number;
    error?: string;
    log?: TurnLog;
}

const { oracle, close: closeOracle } = await makeOracle();
const expected = new Map<string, (string | number)[]>();
for (const c of CASES) expected.set(c.id, c.expect ? await c.expect(oracle) : []);
await closeOracle();

const results: CaseResult[] = [];
const hosts: Record<string, { model: string; ready: boolean; error?: string; note?: string }> = {};
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

// ── Keep other configurations from an earlier run ────────────────────
const shown = [...selected];
const mergeFile = option('merge');
if (mergeFile) {
    const previous = JSON.parse(readFileSync(path.resolve(PROJECT_ROOT, mergeFile), 'utf8')) as { hosts: typeof hosts; results: CaseResult[] };
    for (const v of VARIANTS.filter(v => !selected.includes(v) && previous.hosts[v.id]?.ready)) {
        hosts[v.id] = previous.hosts[v.id];
        results.push(...previous.results.filter(r => r.variant === v.id).map(r => ({ ...r, modelMs: r.modelMs ?? r.llmMs, retries: r.retries ?? 0, pureModel: r.pureModel ?? true })));
        shown.push(v);
    }
    shown.sort((a, b) => VARIANTS.indexOf(a) - VARIANTS.indexOf(b));
}

// Report-only mode: rebuild docs/model-comparison.md from a saved run without calling any model.
const reportFile = option('report');
if (reportFile) {
    const saved = JSON.parse(readFileSync(path.resolve(PROJECT_ROOT, reportFile), 'utf8')) as { hosts: typeof hosts; results: CaseResult[]; repeat: number };
    Object.assign(hosts, saved.hosts);
    results.push(...saved.results);
    shown.splice(0, shown.length, ...VARIANTS.filter(v => saved.hosts[v.id]));
    writeOutputs(path.basename(reportFile, '.json').replace(/^compare-/, ''), saved.repeat);
    console.log('docs/model-comparison.md rebuilt from', reportFile);
    process.exit(0);
}

const isQuotaError = (message?: string) => !!message && /"code":\s*429|RESOURCE_EXHAUSTED|exceeded your current quota/i.test(message);

for (const variant of reportFile ? [] : selected) {
    const { config } = loadHostConfig(variant.configFile);
    config.llm = { ...config.llm, ...variant.override };
    const host = new ChatHost(config, makeProvider(config.llm), { configFile: variant.configFile, verbose: false });
    try {
        await host.start();
        hosts[variant.id] = { model: host.provider.model, ready: true };
    } catch (error) {
        hosts[variant.id] = { model: config.llm.model ?? '?', ready: false, error: (error as Error).message };
        console.log(`✖ ${variant.id}: ${(error as Error).message}`);
        await host.hub.close();
        writeOutputs();
        continue;
    }
    console.log(`\n▶ ${variant.id} (${host.provider.model})`);

    let quotaFailures = 0;
    runs: for (let run = 1; run <= repeat; run++) {
        for (const c of CASES) {
            if (variant.paceMs) await new Promise(resolve => setTimeout(resolve, variant.paceMs));
            host.newConversation();
            const want = expected.get(c.id) ?? [];
            let log: TurnLog | undefined;
            let error: string | undefined;
            try {
                log = await host.ask(c.question);
            } catch (e) {
                error = (e as Error).message.slice(0, 200);
            }
            // Two quota failures in a row = the free-tier quota is used up: stop this model instead of waiting.
            quotaFailures = isQuotaError(error) ? quotaFailures + 1 : 0;
            if (quotaFailures >= 2) {
                results.splice(results.length - 1, 1); // drop the previous quota failure too — it is not a model result
                hosts[variant.id].note = `stopped after ${results.filter(r => r.variant === variant.id).length} valid turns: API quota exhausted (HTTP 429)`;
                console.log(`  ⏹ ${variant.id}: API quota exhausted — remaining cases skipped`);
                break runs;
            }
            const calls: ToolCallSeen[] = log?.toolCalls ?? [];
            const called = new Set(calls.map(t => `${t.server}.${t.tool}`));
            const answer = log?.answer ?? '';
            const missing = want.filter(v => !contains(answer, v));
            const toolsOk = c.tools.every(t => called.has(t));
            const argsOk = c.args ? c.args(calls) : true;
            const answerOk = !error && missing.length === 0 && (c.answer ? c.answer(answer) : answer.length > 0);
            const r: CaseResult = {
                variant: variant.id,
                run,
                id: c.id,
                category: c.category,
                toolsOk,
                argsOk,
                answerOk,
                pass: toolsOk && argsOk && answerOk,
                missing,
                totalMs: log?.totalMs ?? 0,
                llmMs: log?.llmCalls.reduce((a, x) => a + x.ms, 0) ?? 0,
                modelMs: log?.llmCalls.reduce((a, x) => a + (x.lastMs ?? x.ms), 0) ?? 0,
                retries: log?.llmCalls.reduce((a, x) => a + x.attempts - 1, 0) ?? 0,
                pureModel: (log?.llmCalls ?? []).every(x => x.model === host.provider.model),
                rounds: log?.rounds ?? 0,
                toolCalls: calls.length,
                toolErrors: calls.filter(t => t.isError).length,
                inputTokens: log?.usage.inputTokens ?? 0,
                outputTokens: log?.usage.outputTokens ?? 0,
                error,
                log
            };
            results.push(r);
            console.log(
                `  ${r.pass ? '✔' : '✖'} ${c.id.padEnd(18)} tools ${toolsOk ? 'ok' : 'NO'} · args ${argsOk ? 'ok' : 'NO'} · answer ${answerOk ? 'ok' : 'NO'} · model ${(r.modelMs / 1000).toFixed(1)}s${r.retries ? ` (+${r.retries} retries)` : ''}${missing.length ? ` · missing ${JSON.stringify(missing)}` : ''}${error ? ` · ${error.slice(0, 90)}` : ''}`
            );
        }
    }
    await host.hub.close();
    writeOutputs(); // after every configuration, so an interrupted run keeps what finished
}
console.log(`\nWrote outputs/benchmarks/compare-${stamp}.json and docs/model-comparison.md`);

// ── Write results ────────────────────────────────────────────────────
function writeOutputs(runStamp = stamp, runRepeat = repeat): void {
    if (runStamp === stamp) {
        const outDir = path.join(PROJECT_ROOT, 'outputs', 'benchmarks');
        mkdirSync(outDir, { recursive: true });
        writeFileSync(path.join(outDir, `compare-${stamp}.json`), JSON.stringify({ ranAt: new Date().toISOString(), repeat, hosts, expected: Object.fromEntries(expected), results }, null, 2));
    }

    const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '—');
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const median = (xs: number[]) => {
        const s = [...xs].sort((a, b) => a - b);
        return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
    };
    const row = (cells: unknown[]) => `| ${cells.join(' | ')} |`;
    const ready = shown.filter(v => hosts[v.id]?.ready && results.some(r => r.variant === v.id));
    const md: string[] = [
        '# Model comparison — same MCP servers, different LLMs',
        '',
        `Generated by \`npm run compare\` (run ${runStamp}) · ${CASES.length} cases × ${runRepeat} run(s) per model · machine: Apple M4 Pro (Qwen runs locally on it).`,
        'A case **passes** when the model called the expected tool(s), with sensible arguments, and the answer contains the ground-truth values obtained directly from the MCP tools.',
        'Cloud models run without fallback: every answer comes from the model under test. *Model time* excludes rate-limit waits.',
        '',
        '## Summary',
        '',
        row(['Model', 'Where', 'Turns', 'Pass', 'Right tools', 'Right args', 'Right answer', 'Median model time/turn (s)', 'Avg LLM calls/turn', 'Avg tokens in/out', 'Rate-limit retries']),
        row(Array(11).fill('---'))
    ];
    for (const v of shown) {
        const rs = results.filter(r => r.variant === v.id);
        if (!hosts[v.id]?.ready || rs.length === 0) {
            md.push(row([v.id, v.description, 0, `not measured — ${hosts[v.id]?.error ?? hosts[v.id]?.note ?? ''}`, '', '', '', '', '', '', '']));
            continue;
        }
        md.push(
            row([
                `**${v.id}**`,
                v.description,
                rs.length,
                `**${pct(rs.filter(r => r.pass).length, rs.length)}**`,
                pct(rs.filter(r => r.toolsOk).length, rs.length),
                pct(rs.filter(r => r.argsOk).length, rs.length),
                pct(rs.filter(r => r.answerOk).length, rs.length),
                (median(rs.map(r => r.modelMs)) / 1000).toFixed(1),
                avg(rs.map(r => r.log?.llmCalls.length ?? 0)).toFixed(1),
                `${Math.round(avg(rs.map(r => r.inputTokens)))}/${Math.round(avg(rs.map(r => r.outputTokens)))}`,
                rs.reduce((a, r) => a + r.retries, 0)
            ])
        );
    }
    const notes = shown.filter(v => hosts[v.id]?.note);
    if (notes.length) md.push('', ...notes.map(v => `> **${v.id}**: ${hosts[v.id].note}.`));
    md.push('', '## Per case (✔ pass with model time · ✖ fail — reason)', '', row(['Case', 'Category', ...ready.map(v => v.id)]), row(Array(2 + ready.length).fill('---')));
    for (const c of CASES) {
        md.push(
            row([
                c.id,
                c.category,
                ...ready.map(v =>
                    results
                        .filter(r => r.variant === v.id && r.id === c.id)
                        .map(r => (r.pass ? `✔ ${(r.modelMs / 1000).toFixed(1)}s` : `✖ ${[!r.toolsOk && 'tool', !r.argsOk && 'args', !r.answerOk && (r.error ? 'error' : 'answer')].filter(Boolean).join('+')}`))
                        .join(' / ') || '—'
                )
            ])
        );
    }
    md.push('', '## Questions', '', ...CASES.map(c => `- **${c.id}** — ${c.question} *(expects ${c.tools.join(', ')})*`), '');
    writeFileSync(path.join(PROJECT_ROOT, 'docs', 'model-comparison.md'), md.join('\n'));
}
