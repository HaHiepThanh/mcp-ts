import type { CallToolResult } from '@modelcontextprotocol/server';

/** Structured tool result: JSON text for the model + structuredContent for programs. */
export function structured<T extends Record<string, unknown>>(value: T): CallToolResult & { structuredContent: T } {
    return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }], structuredContent: value };
}

/** Plain text tool result. */
export function text(message: string): CallToolResult {
    return { content: [{ type: 'text', text: message }] };
}

/** Tool-level failure the model can read and recover from (not a protocol error). */
export function fail(message: string): CallToolResult {
    return { content: [{ type: 'text', text: message }], isError: true };
}

/** Case- and diacritic-insensitive text for searching ("hai" matches "Hải"). */
export function fold(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase();
}
