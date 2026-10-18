/** Helper for the phase-2 examples: run a list of (tool, arguments) parameter sets and record each result. */
import type { Client } from '@modelcontextprotocol/client';

import { type Example, firstText } from './_harness';

export async function callSets(ex: Example, client: Client, sets: [label: string, tool: string, args: Record<string, unknown>][]): Promise<void> {
    for (const [label, tool, args] of sets) {
        await ex.run(`${tool} · ${label}`, 'callTool', { name: tool, arguments: args }, () => client.callTool({ name: tool, arguments: args }), r =>
            r.isError ? { isError: true, text: firstText(r) } : { isError: false, structuredContent: r.structuredContent ?? firstText(r) }
        );
    }
}
