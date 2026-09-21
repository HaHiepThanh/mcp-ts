/**
 * Server → client interaction that works on BOTH protocol eras.
 *
 * - 2025 era ("legacy"): the handler pushes a request and awaits the answer in-line
 *   (ctx.mcpReq.elicitInput / ctx.mcpReq.requestSampling).
 * - 2026-07-28 era ("modern"): there is no server→client request channel. The handler
 *   RETURNS inputRequired(...); the client answers and retries the same call, and the
 *   answer arrives in ctx.mcpReq.inputResponses.
 *
 * Callers get either an answer or a `pending` result they must return as-is.
 */
import type { InputRequiredResult, ProtocolEra, ServerContext } from '@modelcontextprotocol/server';
import { inputRequired, inputResponse } from '@modelcontextprotocol/server';

export type Pending = { kind: 'pending'; result: InputRequiredResult };

export type Confirmation = Pending | { kind: 'answer'; action: 'accept' | 'decline' | 'cancel'; confirmed: boolean };

const CONFIRM_SCHEMA = {
    type: 'object' as const,
    properties: { confirm: { type: 'boolean' as const, title: 'Confirm', description: 'Tick to proceed' } },
    required: ['confirm']
};

/** Ask the end user a yes/no question through elicitation. */
export async function confirmWithUser(era: ProtocolEra, ctx: ServerContext, key: string, message: string): Promise<Confirmation> {
    if (era === 'legacy') {
        const result = await ctx.mcpReq.elicitInput({ mode: 'form', message, requestedSchema: CONFIRM_SCHEMA });
        return { kind: 'answer', action: result.action, confirmed: result.action === 'accept' && result.content?.confirm === true };
    }
    const view = inputResponse(ctx.mcpReq.inputResponses, key);
    if (view.kind === 'missing') {
        return { kind: 'pending', result: inputRequired({ inputRequests: { [key]: inputRequired.elicit({ message, requestedSchema: CONFIRM_SCHEMA }) } }) };
    }
    if (view.kind !== 'elicit') throw new Error(`Unexpected response kind "${view.kind}" for ${key}`);
    return { kind: 'answer', action: view.action, confirmed: view.action === 'accept' && view.content?.confirm === true };
}

export type Completion = Pending | { kind: 'answer'; text: string; model: string };

/** Borrow the host's LLM (sampling). Deprecated by SEP-2577 but still supported on both eras. */
export async function askHostModel(
    era: ProtocolEra,
    ctx: ServerContext,
    key: string,
    prompt: string,
    options: { systemPrompt?: string; maxTokens: number }
): Promise<Completion> {
    const messages = [{ role: 'user' as const, content: { type: 'text' as const, text: prompt } }];
    const params = { messages, systemPrompt: options.systemPrompt, maxTokens: options.maxTokens };

    if (era === 'legacy') {
        const result = await ctx.mcpReq.requestSampling(params);
        return { kind: 'answer', text: textOf(result.content), model: result.model };
    }
    const view = inputResponse(ctx.mcpReq.inputResponses, key);
    if (view.kind === 'missing') {
        return { kind: 'pending', result: inputRequired({ inputRequests: { [key]: inputRequired.createMessage(params) } }) };
    }
    if (view.kind !== 'sampling') throw new Error(`Unexpected response kind "${view.kind}" for ${key}`);
    return { kind: 'answer', text: textOf(view.result.content), model: view.result.model };
}

function textOf(content: unknown): string {
    const blocks = Array.isArray(content) ? content : [content];
    return blocks
        .filter((b): b is { type: 'text'; text: string } => typeof b === 'object' && b !== null && (b as { type?: string }).type === 'text')
        .map(b => b.text)
        .join('\n')
        .trim();
}
