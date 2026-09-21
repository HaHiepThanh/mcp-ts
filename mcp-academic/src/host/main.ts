/**
 * Chat host CLI.
 *   npm run chat                                   interactive chat
 *   npm run chat -- --ask "question"               one question, then exit
 *   npm run chat -- --script questions.txt         one question per line (same conversation; --fresh = new each time)
 * Options: --config config/host.json   --model <id>   --quiet
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { loadEnv, PROJECT_ROOT } from '../lib/env';
import { loadHostConfig } from './config';
import { ChatHost } from './host';
import { GeminiProvider } from './providers/gemini';
import { OpenAICompatibleProvider } from './providers/openai-compatible';
import type { LlmProvider } from './providers/provider';
import { ask, c, closeInput, preview } from './ui';

loadEnv();
const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const option = (name: string) => (argv.indexOf(`--${name}`) >= 0 ? argv[argv.indexOf(`--${name}`) + 1] : undefined);

const { config, file } = loadHostConfig(option('config'));
if (option('model')) config.llm.model = option('model');

function createProvider(): LlmProvider {
    if (config.llm.provider === 'gemini') return new GeminiProvider({ model: config.llm.model, temperature: config.llm.temperature });
    if (!config.llm.baseUrl || !config.llm.model) throw new Error('openai-compatible provider needs llm.baseUrl and llm.model');
    return new OpenAICompatibleProvider({
        baseUrl: process.env.OLLAMA_BASE_URL ? `${process.env.OLLAMA_BASE_URL}/v1` : config.llm.baseUrl,
        model: config.llm.model,
        temperature: config.llm.temperature,
        label: config.llm.label
    });
}

const host = new ChatHost(config, createProvider(), { configFile: file, verbose: !flag('quiet') });
await host.start();

console.log(c.bold(`\nMCP Academic Assistant`) + c.dim(`  (config: ${file})`));
console.log(`  model : ${c.green(`${host.provider.name} / ${host.provider.model}`)}`);
for (const s of host.hub.servers.values()) {
    console.log(`  server: ${c.green(s.name.padEnd(9))} ${s.transport.padEnd(5)} protocol ${s.client.getProtocolEra() === 'modern' ? '2026-07-28' : '2025 (legacy)'} · ${s.tools.length} tools`);
}

async function runQuestion(question: string): Promise<void> {
    console.log(`\n${c.bold('You')}: ${question}`);
    const log = await host.ask(question);
    console.log(`\n${c.bold(c.green('Assistant'))}: ${log.answer}`);
    console.log(c.dim(`  (${log.toolCalls.length} tool calls in ${log.rounds} rounds · ${(log.totalMs / 1000).toFixed(1)}s · tokens in/out ${log.usage.inputTokens}/${log.usage.outputTokens})`));
}

async function command(line: string): Promise<boolean> {
    const [cmd, ...rest] = line.split(/\s+/);
    switch (cmd) {
        case '/exit':
        case '/quit':
            return false;
        case '/help':
            console.log(
                [
                    '/tools                      list every MCP tool the model can call',
                    '/resources                  list resources and resource templates',
                    '/attach <uri>               attach a resource to your next question',
                    '/prompts                    list prompts',
                    '/prompt <server>:<name> k=v run a server prompt, e.g. /prompt academic:class_report class_id=IT01',
                    '/new                        start a new conversation',
                    '/exit                       quit'
                ].join('\n')
            );
            return true;
        case '/tools':
            for (const t of host.hub.toolSpecs()) console.log(`  ${c.cyan(t.name.replace('__', '.'))}  ${c.dim(preview(t.description, 90))}`);
            return true;
        case '/resources':
            for (const s of host.hub.servers.values()) {
                const [{ resources }, { resourceTemplates }] = await Promise.all([s.client.listResources(), s.client.listResourceTemplates()]);
                for (const r of resources) console.log(`  ${c.cyan(r.uri)}  ${c.dim(r.name)}`);
                for (const t of resourceTemplates) console.log(`  ${c.cyan(t.uriTemplate)}  ${c.dim('(template)')}`);
            }
            return true;
        case '/attach':
            console.log(c.dim(`  attached ${rest[0]} — ${await host.attach(rest[0])}`));
            return true;
        case '/prompts':
            for (const s of host.hub.servers.values()) {
                if (!s.client.getServerCapabilities()?.prompts) continue;
                for (const p of (await s.client.listPrompts()).prompts) {
                    console.log(`  ${c.cyan(`${s.name}:${p.name}`)} ${c.dim((p.arguments ?? []).map(a => (a.required ? a.name : `${a.name}?`)).join(' '))}  ${c.dim(p.description ?? '')}`);
                }
            }
            return true;
        case '/prompt': {
            const [server, name] = (rest[0] ?? '').split(':');
            const args = Object.fromEntries(rest.slice(1).map(kv => kv.split('=') as [string, string]));
            const entry = host.hub.servers.get(server);
            if (!entry || !name) throw new Error('Usage: /prompt <server>:<name> key=value …');
            const { messages } = await entry.client.getPrompt({ name, arguments: args });
            const text = messages
                .map(m => (m.content.type === 'text' ? m.content.text : m.content.type === 'resource' && 'text' in m.content.resource ? `<resource uri="${m.content.resource.uri}">\n${m.content.resource.text}\n</resource>` : `[${m.content.type}]`))
                .join('\n\n');
            await runQuestion(text);
            return true;
        }
        case '/new':
            host.newConversation();
            console.log(c.dim('  new conversation'));
            return true;
        default:
            console.log(c.yellow(`  unknown command ${cmd} — /help`));
            return true;
    }
}

try {
    const single = option('ask');
    const script = option('script');
    if (single) {
        await runQuestion(single);
    } else if (script) {
        const questions = readFileSync(path.resolve(PROJECT_ROOT, script), 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
        for (const q of questions) {
            if (flag('fresh')) host.newConversation();
            await runQuestion(q);
        }
    } else {
        console.log(c.dim('\n  Ask anything about students, grades and classes. /help for commands.'));
        for (;;) {
            const line = await ask(`\n${c.bold('You')}: `);
            if (line === undefined) break;
            if (!line) continue;
            try {
                if (line.startsWith('/')) {
                    if (!(await command(line))) break;
                } else {
                    const log = await host.ask(line);
                    console.log(`\n${c.bold(c.green('Assistant'))}: ${log.answer}`);
                    console.log(c.dim(`  (${log.toolCalls.length} tool calls in ${log.rounds} rounds · ${(log.totalMs / 1000).toFixed(1)}s · tokens in/out ${log.usage.inputTokens}/${log.usage.outputTokens})`));
                }
            } catch (error) {
                console.log(c.red(`  error: ${(error as Error).message}`));
            }
        }
    }
} finally {
    closeInput();
    await host.hub.close();
}
