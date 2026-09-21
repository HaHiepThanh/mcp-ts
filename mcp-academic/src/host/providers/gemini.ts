/**
 * Gemini provider (Google AI Studio, @google/genai).
 * - Model: GEMINI_MODEL env > config llm.model; the stable Flash models (newest first) are kept as fallbacks.
 * - Transient errors (429/500/503) are retried with backoff, then the next Flash model is tried.
 * - The model's own Content objects are appended to history unchanged, which preserves the
 *   thought signatures Gemini requires across function-calling turns.
 */
import { type Content, type FunctionCall, type GenerateContentResponse, GoogleGenAI, type Part } from '@google/genai';

import type { ChatSession, LlmCall, LlmProvider, ModelTurn, ToolOutcome, ToolSpec, Usage } from './provider';

const EXCLUDED = /lite|preview|exp|tts|image|live|audio|thinking|embedding|native|latest/;
const version = (name: string) => Number(/gemini-(\d+(?:\.\d+)?)/.exec(name)?.[1] ?? 0);
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const isTransient = (error: unknown) => /"code":\s*(429|500|503)|UNAVAILABLE|RESOURCE_EXHAUSTED|fetch failed/.test(String(error));
/** The model is retired or not offered to this key — skip straight to the next one. */
const isGone = (error: unknown) => /"code":\s*404|NOT_FOUND/.test(String(error));

export class GeminiProvider implements LlmProvider {
    readonly name = 'gemini';
    private ai: GoogleGenAI;
    private candidates: string[] = [];
    private current = 0;

    constructor(private readonly options: { model?: string; temperature?: number } = {}) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY is missing — add it to .env');
        this.ai = new GoogleGenAI({ apiKey });
    }

    get model(): string {
        return this.candidates[this.current] ?? '(not initialised)';
    }

    async init(): Promise<void> {
        const preferred = process.env.GEMINI_MODEL || this.options.model;
        const names: string[] = [];
        for await (const m of await this.ai.models.list()) {
            if (m.name && m.supportedActions?.includes('generateContent')) names.push(m.name.replace(/^models\//, ''));
        }
        if (preferred && !names.includes(preferred)) throw new Error(`Gemini model "${preferred}" is not available for this key`);
        const fallbacks = names.filter(n => n.includes('flash') && !EXCLUDED.test(n) && n !== preferred).sort((a, b) => version(b) - version(a));
        this.candidates = preferred ? [preferred, ...fallbacks] : fallbacks;
        if (this.candidates.length === 0) throw new Error('No stable Gemini Flash model available for this key');
    }

    /** generateContent with retry + model fallback. Reports how long it took and how many attempts it needed. */
    private async generate(contents: Content[], config: Record<string, unknown>): Promise<{ response: GenerateContentResponse; call: LlmCall }> {
        const started = performance.now();
        let attempts = 0;
        let lastError: unknown;
        for (; this.current < this.candidates.length; this.current++) {
            for (let attempt = 1; attempt <= 3; attempt++) {
                attempts++;
                try {
                    const response = await this.ai.models.generateContent({ model: this.model, contents, config: { temperature: this.options.temperature, ...config } });
                    return { response, call: { model: this.model, ms: Math.round(performance.now() - started), attempts } };
                } catch (error) {
                    lastError = error;
                    if (isGone(error)) break;
                    if (!isTransient(error)) throw error;
                    if (attempt < 3) await sleep(1500 * attempt);
                }
            }
            console.error(`[gemini] ${this.model} unavailable (${String(lastError).slice(0, 80)}), falling back to the next model`);
        }
        this.current = 0;
        throw lastError;
    }

    /** Back to the preferred model (called at the start of every user turn). */
    resetModel(): void {
        this.current = 0;
    }

    startChat({ system, tools }: { system: string; tools: ToolSpec[] }): ChatSession {
        const history: Content[] = [];
        const config = {
            systemInstruction: system,
            tools: tools.length ? [{ functionDeclarations: tools.map(t => ({ name: t.name, description: t.description, parametersJsonSchema: t.parameters })) }] : undefined
        };
        const turn = async (userParts: Part[]): Promise<ModelTurn> => {
            history.push({ role: 'user', parts: userParts });
            const { response, call } = await this.generate(history, config);
            const content = response.candidates?.[0]?.content ?? { role: 'model', parts: [] };
            history.push(content);
            return {
                text: (content.parts ?? []).filter(p => p.text && !p.thought).map(p => p.text).join('').trim(),
                toolCalls: (response.functionCalls ?? []).map((fc: FunctionCall) => ({ id: fc.id, name: fc.name ?? '', args: fc.args ?? {} })),
                usage: usageOf(response),
                call
            };
        };
        return {
            send: text => turn([{ text }]),
            sendToolResults: (results: ToolOutcome[]) =>
                turn(results.map(r => ({ functionResponse: { id: r.call.id, name: r.call.name, response: r.output } })))
        };
    }

    async complete({ system, prompt, maxTokens }: { system?: string; prompt: string; maxTokens: number }) {
        const { response, call } = await this.generate([{ role: 'user', parts: [{ text: prompt }] }], { systemInstruction: system, maxOutputTokens: maxTokens });
        return { text: response.text?.trim() ?? '', model: call.model, usage: usageOf(response), call };
    }
}

function usageOf(response: GenerateContentResponse): Usage {
    return { inputTokens: response.usageMetadata?.promptTokenCount, outputTokens: response.usageMetadata?.candidatesTokenCount };
}
