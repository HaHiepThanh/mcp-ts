/**
 * Provider for any OpenAI-compatible Chat Completions endpoint — here Ollama running Qwen locally
 * (http://127.0.0.1:11434/v1), but the same code works for Groq, OpenRouter or OpenAI.
 * - Thinking models (e.g. qwen3:4b = Qwen3-4B-Thinking-2507) cannot switch thinking off through this API
 *   (neither "/no_think" nor think:false fully works) — pick a non-thinking model (qwen3:4b-instruct)
 *   instead. Ollama returns the reasoning separately; any inline <think>…</think> is stripped.
 * - Tool-call arguments arrive as a JSON string; malformed JSON is passed on as {} so the MCP
 *   server's schema validation reports the problem back to the model.
 */
import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

import type { ChatSession, LlmCall, LlmProvider, ModelTurn, ToolOutcome, ToolSpec, Usage } from './provider';

const stripThink = (text: string) => text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

export class OpenAICompatibleProvider implements LlmProvider {
    readonly name: string;
    private client: OpenAI;

    constructor(private readonly options: { baseUrl: string; model: string; temperature?: number; label?: string }) {
        this.name = options.label ?? 'openai-compatible';
        this.client = new OpenAI({ baseURL: options.baseUrl, apiKey: process.env.OPENAI_API_KEY || 'not-needed-for-ollama', maxRetries: 1, timeout: 300_000 });
    }

    get model(): string {
        return this.options.model;
    }

    async init(): Promise<void> {
        let ids: string[];
        try {
            ids = (await this.client.models.list()).data.map(m => m.id);
        } catch (error) {
            throw new Error(`Cannot reach ${this.options.baseUrl} (${(error as Error).message}). Is Ollama running?`);
        }
        if (!ids.includes(this.options.model)) {
            throw new Error(`Model "${this.options.model}" not found at ${this.options.baseUrl}. Available: ${ids.join(', ') || '(none)'} — run: ollama pull ${this.options.model}`);
        }
    }

    private async create(messages: ChatCompletionMessageParam[], extra: { tools?: ChatCompletionTool[]; max_tokens?: number } = {}) {
        const started = performance.now();
        const response = await this.client.chat.completions.create({
            model: this.options.model,
            messages,
            temperature: this.options.temperature,
            ...(extra.tools?.length ? { tools: extra.tools } : {}),
            ...(extra.max_tokens ? { max_tokens: extra.max_tokens } : {})
        });
        const ms = Math.round(performance.now() - started);
        const call: LlmCall = { model: this.options.model, ms, lastMs: ms, attempts: 1 };
        const usage: Usage = { inputTokens: response.usage?.prompt_tokens, outputTokens: response.usage?.completion_tokens };
        return { message: response.choices[0]?.message, usage, call };
    }

    startChat({ system, tools }: { system: string; tools: ToolSpec[] }): ChatSession {
        const history: ChatCompletionMessageParam[] = [{ role: 'system', content: system }];
        const toolDefs: ChatCompletionTool[] = tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));

        const turn = async (): Promise<ModelTurn> => {
            const { message, usage, call } = await this.create(history, { tools: toolDefs });
            if (!message) return { text: '', toolCalls: [], usage, call };
            const toolCalls = (message.tool_calls ?? []).flatMap(tc => (tc.type === 'function' ? [tc] : []));
            history.push({ role: 'assistant', content: message.content ?? '', ...(toolCalls.length ? { tool_calls: toolCalls } : {}) });
            return {
                text: stripThink(message.content ?? ''),
                toolCalls: toolCalls.map(tc => ({ id: tc.id, name: tc.function.name, args: parseArgs(tc.function.arguments) })),
                usage,
                call
            };
        };
        return {
            send: async text => (history.push({ role: 'user', content: text }), turn()),
            sendToolResults: async (results: ToolOutcome[]) => {
                for (const r of results) history.push({ role: 'tool', tool_call_id: r.call.id ?? r.call.name, content: JSON.stringify(r.output) });
                return turn();
            }
        };
    }

    async complete({ system, prompt, maxTokens }: { system?: string; prompt: string; maxTokens: number }) {
        const messages: ChatCompletionMessageParam[] = [
            { role: 'system', content: system ?? 'You are a helpful assistant.' },
            { role: 'user', content: prompt }
        ];
        const { message, usage, call } = await this.create(messages, { max_tokens: maxTokens });
        return { text: stripThink(message?.content ?? ''), model: this.options.model, usage, call };
    }
}

function parseArgs(raw: string | undefined): Record<string, unknown> {
    try {
        const value: unknown = JSON.parse(raw || '{}');
        return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}
