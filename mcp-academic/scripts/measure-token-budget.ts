/**
 * Token budget: how much of the LLM context do the MCP tool definitions use?
 *   npm run budget                                              config/host.qwen.json, enabled servers only
 *   npm run budget -- --all                                     also servers marked "disabled" (e.g. finance on Qwen)
 *   npm run budget -- --config config/host.json --ctx 8192
 * Options: --config <file>  --all  --ctx <tokens, default 8192>  --model <ollama model>  --reserve <tokens kept for question + tool results + answer, default 1500>
 *
 * Two numbers per server: a character-based ESTIMATE (always) and the EXACT count reported by Ollama
 * (prompt_eval_count) when Ollama is running. Writes outputs/benchmarks/token-budget-<config>.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { loadHostConfig } from '../src/host/config';
import { McpHub } from '../src/host/mcp-hub';
import { loadEnv, PROJECT_ROOT } from '../src/lib/env';

loadEnv();
const argv = process.argv.slice(2);
const option = (name: string): string | undefined => (argv.indexOf(`--${name}`) >= 0 ? argv[argv.indexOf(`--${name}`) + 1] : undefined);
const configFile = option('config') ?? 'config/host.qwen.json';
const contextSize = Number(option('ctx') ?? 8192);
const reserve = Number(option('reserve') ?? 1500);
const includeDisabled = argv.includes('--all');

const { config, file } = loadHostConfig(configFile);
const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
const model = option('model') ?? config.llm.model ?? 'qwen3:4b-instruct';

const hub = new McpHub({
    onElicit: async () => ({ action: 'decline' }),
    onSample: async () => {
        throw new Error('sampling is not used by this script');
    }
});
for (const [name, server] of Object.entries(config.mcpServers)) {
    if (server.disabled && !includeDisabled) continue;
    await hub.connect(name, server);
}

const system = `${config.agent.systemPrompt}${hub.instructions() ? `\n\nMCP server instructions:\n${hub.instructions()}` : ''}`;
const allSpecs = hub.toolSpecs();
const asOllamaTools = (specs: typeof allSpecs) => specs.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
const estimate = (value: unknown): number => Math.ceil(JSON.stringify(value).length / 3.5);

/** Prompt tokens Ollama really evaluates. A random nonce at the very start defeats the prompt cache (which would under-report). */
async function promptTokens(tools: ReturnType<typeof asOllamaTools>): Promise<number | undefined> {
    try {
        const response = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                model,
                stream: false,
                messages: [
                    { role: 'system', content: `[run ${Math.random().toString(36).slice(2)}] ${system}` },
                    { role: 'user', content: 'Hi' }
                ],
                ...(tools.length > 0 ? { tools } : {}),
                options: { num_ctx: 32768, num_predict: 1 }
            }),
            signal: AbortSignal.timeout(180_000)
        });
        if (!response.ok) return undefined;
        return ((await response.json()) as { prompt_eval_count?: number }).prompt_eval_count;
    } catch {
        return undefined;
    }
}

const baseline = await promptTokens([]);
const rows: { server: string; tools: number; estimated_tokens: number; exact_tokens: number | undefined; tool_names: string[] }[] = [];
for (const server of hub.servers.values()) {
    const specs = allSpecs.filter(t => t.name.startsWith(`${server.name}__`));
    const exact = baseline === undefined ? undefined : await promptTokens(asOllamaTools(specs)).then(n => (n === undefined ? undefined : n - baseline));
    rows.push({ server: server.name, tools: specs.length, estimated_tokens: estimate(asOllamaTools(specs)), exact_tokens: exact, tool_names: specs.map(t => t.name) });
}
const totalExactRaw = baseline === undefined ? undefined : await promptTokens(asOllamaTools(allSpecs));
const totalExact = totalExactRaw === undefined || baseline === undefined ? undefined : totalExactRaw - baseline;
const totalEstimated = estimate(asOllamaTools(allSpecs));
const used = (totalExact ?? totalEstimated) + (baseline ?? Math.ceil(system.length / 3.5));
const free = contextSize - used;

console.log(`\nConfig ${file} · model ${model} · context ${contextSize} tokens · ${includeDisabled ? 'ALL servers' : 'enabled servers'}\n`);
console.log('server       tools  estimated  exact(Ollama)');
for (const r of rows) console.log(`${r.server.padEnd(12)} ${String(r.tools).padStart(5)}  ${String(r.estimated_tokens).padStart(9)}  ${r.exact_tokens === undefined ? 'n/a' : String(r.exact_tokens).padStart(8)}`);
console.log(`${'TOTAL'.padEnd(12)} ${String(allSpecs.length).padStart(5)}  ${String(totalEstimated).padStart(9)}  ${totalExact === undefined ? 'n/a (Ollama not reachable)' : String(totalExact).padStart(8)}`);
console.log(`\nSystem prompt + chat template + "Hi": ${baseline ?? '~' + Math.ceil(system.length / 3.5)} tokens${baseline === undefined ? ' (estimate)' : ''}`);
console.log(`Used before the first question: ${used} of ${contextSize} → ${free} free; reserve ${reserve} for question + tool results + answer.`);
console.log(free >= reserve ? '✅ fits' : `❌ does NOT fit: short by ${reserve - free} tokens`);

const outDir = path.join(PROJECT_ROOT, 'outputs', 'benchmarks');
mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `token-budget-${path.basename(file, '.json')}${includeDisabled ? '-all' : ''}.json`);
writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), config: file, model, contextSize, reserve, baseline_tokens: baseline ?? null, total_tools: allSpecs.length, total_estimated: totalEstimated, total_exact: totalExact ?? null, free, fits: free >= reserve, servers: rows }, null, 2));
console.log(`\nReport written: ${path.relative(PROJECT_ROOT, out)}`);
await hub.close();
