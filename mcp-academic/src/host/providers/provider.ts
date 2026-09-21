/**
 * The one seam between the host and an LLM vendor. Each provider keeps the conversation in its
 * own native format (so vendor-specific data such as Gemini thought signatures survive).
 */
export interface ToolSpec {
    /** Qualified name the model sees, e.g. "academic__calculate_gpa". */
    name: string;
    description: string;
    /** JSON Schema of the arguments (from MCP tools/list). */
    parameters: Record<string, unknown>;
}

export interface ToolCall {
    id?: string;
    name: string;
    args: Record<string, unknown>;
}

export interface ToolOutcome {
    call: ToolCall;
    /** JSON object handed back to the model. */
    output: Record<string, unknown>;
}

export interface Usage {
    inputTokens?: number;
    outputTokens?: number;
}

/** One request to the LLM API, for latency analysis. */
export interface LlmCall {
    model: string;
    /** Wall time including retries and rate-limit waits. */
    ms: number;
    /** Time of the successful attempt only — the model's own latency. */
    lastMs: number;
    attempts: number;
}

export interface ModelTurn {
    text: string;
    toolCalls: ToolCall[];
    usage?: Usage;
    call?: LlmCall;
}

export interface ChatSession {
    send(userText: string): Promise<ModelTurn>;
    sendToolResults(results: ToolOutcome[]): Promise<ModelTurn>;
}

export interface LlmProvider {
    readonly name: string;
    /** Resolved model id (valid after init()). */
    readonly model: string;
    init(): Promise<void>;
    /** Optional: return to the preferred model after a fallback. */
    resetModel?(): void;
    startChat(options: { system: string; tools: ToolSpec[] }): ChatSession;
    /** Single-shot completion, used to answer MCP sampling requests. */
    complete(request: { system?: string; prompt: string; maxTokens: number }): Promise<{ text: string; model: string; usage?: Usage; call?: LlmCall }>;
}
