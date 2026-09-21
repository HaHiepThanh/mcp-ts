/**
 * The chat host: LLM provider + MCP hub + the agent loop.
 *
 *   user question → LLM (sees every MCP tool) → tool calls → MCP servers → results → LLM → … → answer
 *
 * Every turn is appended to <logDir>/chat-YYYY-MM-DD.jsonl (question, tool calls, answer, timing, tokens).
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

import type { CreateMessageRequest, CreateMessageResult, ElicitRequest, ElicitResult } from '@modelcontextprotocol/client';

import { PROJECT_ROOT } from '../lib/env';
import type { HostConfig } from './config';
import { McpHub, type ToolCallRecord, toolOutputForModel } from './mcp-hub';
import type { ChatSession, LlmCall, LlmProvider, ModelTurn, ToolOutcome } from './providers/provider';
import { ask, c, preview } from './ui';

export interface TurnLog {
    at: string;
    config: string;
    provider: string;
    model: string;
    question: string;
    rounds: number;
    toolCalls: { server: string; tool: string; args: Record<string, unknown>; ms: number; isError: boolean; output: string }[];
    answer: string;
    totalMs: number;
    usage: { inputTokens: number; outputTokens: number };
    /** Every LLM API request of the turn (chat rounds + sampling), with latency and retry count. */
    llmCalls: (LlmCall & { purpose: 'chat' | 'sampling' })[];
    samplingCalls: number;
    elicitations: { server: string; message: string; action: string }[];
}

export interface HostOptions {
    configFile: string;
    /** Print tool calls, progress and server requests while working. */
    verbose: boolean;
}

export class ChatHost {
    readonly hub: McpHub;
    private session?: ChatSession;
    private attachments: { uri: string; text: string }[] = [];
    private turnStats = this.emptyStats();

    private emptyStats() {
        return { samplingCalls: 0, elicitations: [] as TurnLog['elicitations'], usage: { inputTokens: 0, outputTokens: 0 }, llmCalls: [] as TurnLog['llmCalls'] };
    }

    constructor(
        readonly config: HostConfig,
        readonly provider: LlmProvider,
        private readonly options: HostOptions
    ) {
        this.hub = new McpHub({
            onElicit: (server, params) => this.handleElicitation(server, params),
            onSample: (server, params) => this.handleSampling(server, params),
            onLog: (server, level, data) => this.say(c.dim(`    [${server} log/${level}] ${preview(data)}`)),
            onToolsChanged: server => {
                this.say(c.yellow(`  (tools of "${server}" changed — conversation restarted with the new tool list)`));
                this.newConversation();
            }
        });
    }

    private say(line: string): void {
        if (this.options.verbose) console.log(line);
    }

    async start(): Promise<void> {
        await this.provider.init();
        for (const [name, server] of Object.entries(this.config.mcpServers)) {
            if (server.disabled) continue;
            await this.hub.connect(name, server);
        }
        this.newConversation();
    }

    newConversation(): void {
        const instructions = this.hub.instructions();
        this.session = this.provider.startChat({
            system: `${this.config.agent.systemPrompt}${instructions ? `\n\nMCP server instructions:\n${instructions}` : ''}`,
            tools: this.hub.toolSpecs()
        });
        this.attachments = [];
    }

    /** Attach a resource's text to the next question (resources are chosen by the user/host, not the model). */
    async attach(uri: string): Promise<string> {
        for (const server of this.hub.servers.values()) {
            try {
                const { contents } = await server.client.readResource({ uri });
                const text = contents.map(item => ('text' in item ? item.text : `[binary ${item.mimeType ?? ''}]`)).join('\n');
                this.attachments.push({ uri, text });
                return `${server.name}: ${text.length} characters`;
            } catch {
                // try the next server
            }
        }
        throw new Error(`No connected server could read ${uri}`);
    }

    async ask(question: string): Promise<TurnLog> {
        if (!this.session) throw new Error('Host not started');
        const started = performance.now();
        this.turnStats = this.emptyStats();
        this.provider.resetModel?.();
        const calls: ToolCallRecord[] = [];

        const context = this.attachments.map(a => `<resource uri="${a.uri}">\n${a.text}\n</resource>`).join('\n');
        this.attachments = [];
        let turn = this.count(await this.session.send(context ? `${context}\n\n${question}` : question));

        let rounds = 0;
        while (turn.toolCalls.length > 0 && rounds < this.config.agent.maxToolRounds) {
            rounds++;
            const outcomes: ToolOutcome[] = [];
            for (const call of turn.toolCalls) {
                this.say(c.cyan(`  ⚙ ${call.name.replace('__', '.')} ${preview(call.args, 120)}`));
                const record = await this.hub.callTool(call.name, call.args, p =>
                    this.say(c.dim(`    … progress ${p.progress}${p.total ? `/${p.total}` : ''}${p.message ? ` ${p.message}` : ''}`))
                );
                calls.push(record);
                const output = toolOutputForModel(record.result);
                this.say((record.isError ? c.red : c.dim)(`    ${record.isError ? '✖' : '↳'} ${record.ms}ms ${preview(output, 150)}`));
                outcomes.push({ call, output });
            }
            turn = this.count(await this.session.sendToolResults(outcomes));
        }
        const answer = turn.toolCalls.length > 0 ? `${turn.text}\n(stopped after ${rounds} tool rounds — raise agent.maxToolRounds)`.trim() : turn.text;

        const log: TurnLog = {
            at: new Date().toISOString(),
            config: this.options.configFile,
            provider: this.provider.name,
            model: this.provider.model,
            question,
            rounds,
            toolCalls: calls.map(r => ({ server: r.server, tool: r.tool, args: r.args, ms: r.ms, isError: r.isError, output: preview(toolOutputForModel(r.result), 400) })),
            answer,
            totalMs: Math.round(performance.now() - started),
            usage: this.turnStats.usage,
            llmCalls: this.turnStats.llmCalls,
            samplingCalls: this.turnStats.samplingCalls,
            elicitations: this.turnStats.elicitations
        };
        this.writeLog(log);
        return log;
    }

    private count(turn: ModelTurn): ModelTurn {
        this.turnStats.usage.inputTokens += turn.usage?.inputTokens ?? 0;
        this.turnStats.usage.outputTokens += turn.usage?.outputTokens ?? 0;
        if (turn.call) {
            this.turnStats.llmCalls.push({ ...turn.call, purpose: 'chat' });
            this.say(c.dim(`  🧠 ${turn.call.model} ${(turn.call.ms / 1000).toFixed(1)}s${turn.call.attempts > 1 ? ` (${turn.call.attempts} attempts)` : ''}`));
        }
        return turn;
    }

    private writeLog(log: TurnLog): void {
        const dir = path.resolve(PROJECT_ROOT, this.config.logDir);
        mkdirSync(dir, { recursive: true });
        appendFileSync(path.join(dir, `chat-${log.at.slice(0, 10)}.jsonl`), JSON.stringify(log) + '\n');
    }

    // ── Server → client requests ─────────────────────────────────────
    private async handleElicitation(server: string, params: ElicitRequest['params']): Promise<ElicitResult> {
        const record = (action: string) => this.turnStats.elicitations.push({ server, message: params.message, action });
        if (params.mode === 'url') {
            record('decline');
            return { action: 'decline' };
        }
        console.log(c.magenta(`\n  ❓ [${server}] ${params.message}`));
        const fields = Object.entries(params.requestedSchema.properties ?? {}) as [string, { type?: string; title?: string; enum?: string[] }][];

        const firstAnswer = await ask(c.magenta(`     ${fields.length === 1 && fields[0][1].type === 'boolean' ? 'Confirm? (y = yes, n = decline, c = cancel): ' : 'Answer? (enter = fill in the form, n = decline, c = cancel): '}`));
        if (firstAnswer === undefined) {
            const policy = this.config.elicitation.nonInteractive;
            console.log(c.magenta(`     (no terminal — policy "${policy}")`));
            record(policy);
            return policy === 'accept' ? { action: 'accept', content: Object.fromEntries(fields.filter(([, s]) => s.type === 'boolean').map(([k]) => [k, true])) } : { action: 'decline' };
        }
        const choice = firstAnswer.toLowerCase();
        if (choice === 'c') return record('cancel'), { action: 'cancel' };
        if (choice === 'n') return record('decline'), { action: 'decline' };
        if (fields.length === 1 && fields[0][1].type === 'boolean') {
            record('accept');
            return { action: 'accept', content: { [fields[0][0]]: choice === 'y' || choice === 'yes' } };
        }
        const content: Record<string, string | number | boolean> = {};
        for (const [key, schema] of fields) {
            const value = (await ask(`     ${schema.title ?? key}${schema.enum ? ` (${schema.enum.join('/')})` : ''}: `)) ?? '';
            content[key] = schema.type === 'boolean' ? /^y/i.test(value) : schema.type === 'number' || schema.type === 'integer' ? Number(value) : value;
        }
        record('accept');
        return { action: 'accept', content };
    }

    private async handleSampling(server: string, params: CreateMessageRequest['params']): Promise<CreateMessageResult> {
        const prompt = params.messages
            .flatMap(m => (Array.isArray(m.content) ? m.content : [m.content]))
            .map(block => (block.type === 'text' ? block.text : `[${block.type}]`))
            .join('\n\n');
        this.say(c.magenta(`  ✎ [${server}] sampling request → ${this.provider.model} (${prompt.length} chars, max ${params.maxTokens} tokens)`));

        const approval = this.config.sampling.approval;
        if (approval === 'deny') throw new Error('Sampling is disabled by host configuration');
        if (approval === 'ask') {
            const answer = await ask(c.magenta(`     Let "${server}" use the model? (y/n): `));
            if (answer !== undefined && !/^y/i.test(answer)) throw new Error('The user rejected the sampling request');
        }
        const result = await this.provider.complete({ system: params.systemPrompt, prompt, maxTokens: Math.min(params.maxTokens, this.config.sampling.maxTokens) });
        this.turnStats.samplingCalls++;
        if (result.call) this.turnStats.llmCalls.push({ ...result.call, purpose: 'sampling' });
        this.turnStats.usage.inputTokens += result.usage?.inputTokens ?? 0;
        this.turnStats.usage.outputTokens += result.usage?.outputTokens ?? 0;
        return { role: 'assistant', model: result.model, content: { type: 'text', text: result.text } };
    }
}
