/**
 * C2 — per-request options and how failures surface on the client.
 *   RequestOptions: timeout, onprogress, resetTimeoutOnProgress, maxTotalTimeout
 *   Failure taxonomy: result.isError  vs  thrown ProtocolError(code)  vs  thrown SdkError(code)
 */
import { ProtocolError, SdkError } from '@modelcontextprotocol/client';
import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';

import { createAcademicServer } from '../../src/server/academic/server';
import { connectInProcess, Example, firstText } from '../_harness';

const ex = new Example('c2-request-options-errors', 'C2 · Request options (timeout, progress) and the client-side error taxonomy', [
    'RequestOptions.timeout',
    'RequestOptions.onprogress',
    'RequestOptions.resetTimeoutOnProgress',
    'RequestOptions.maxTotalTimeout',
    'ProtocolError',
    'SdkError'
]);

// A job that takes steps × delayMs and reports progress after every step.
function jobServer(): McpServer {
    const server = new McpServer({ name: 'jobs', version: '1.0.0' });
    server.registerTool(
        'export_transcripts',
        { description: 'Export transcripts in batches (slow)', inputSchema: z.object({ batches: z.number().int().max(50), delayMs: z.number().int().max(2000) }) },
        async ({ batches, delayMs }, ctx) => {
            const progressToken = ctx.mcpReq._meta?.progressToken;
            for (let i = 1; i <= batches; i++) {
                if (ctx.mcpReq.signal.aborted) break;
                await new Promise(resolve => setTimeout(resolve, delayMs));
                if (progressToken !== undefined) {
                    await ctx.mcpReq.notify({ method: 'notifications/progress', params: { progressToken, progress: i, total: batches } });
                }
            }
            return { content: [{ type: 'text', text: `Exported ${batches} batches` }] };
        }
    );
    return server;
}

ex.section('Timeouts — job = 8 batches × 150 ms ≈ 1.2 s');
{
    const { client, close } = await connectInProcess(jobServer);
    const job = { name: 'export_transcripts', arguments: { batches: 8, delayMs: 150 } };
    const runWith = (label: string, options: Record<string, unknown>) => {
        let updates = 0;
        return ex.run(label, 'callTool(params, options)', { ...job, options }, async () => {
            const result = await client.callTool(job, { ...options, onprogress: () => void updates++ });
            return { text: firstText(result), progressUpdates: updates };
        });
    };
    await runWith('A. timeout 400 ms → times out', { timeout: 400 });
    await runWith('B. timeout 400 ms + resetTimeoutOnProgress → each update restarts the clock', { timeout: 400, resetTimeoutOnProgress: true });
    await runWith('C. same + maxTotalTimeout 700 ms → hard cap wins', { timeout: 400, resetTimeoutOnProgress: true, maxTotalTimeout: 700 });
    await runWith('D. default timeout (60 s) → completes', {});
    await close();
}

ex.section('Failure taxonomy — where does each failure show up?');
const taxonomy: { failure: string; surfacesAs: string; detail: string }[] = [];

async function classify(failure: string, call: () => Promise<unknown>): Promise<void> {
    await ex.run(failure, 'classify', undefined, async () => {
        let row;
        try {
            const result = (await call()) as { isError?: boolean; content?: unknown[] };
            row = result.isError
                ? { failure, surfacesAs: 'result.isError = true', detail: firstText(result) }
                : { failure, surfacesAs: 'normal result', detail: JSON.stringify(result) };
        } catch (error) {
            const surfacesAs =
                error instanceof ProtocolError
                    ? `throws ProtocolError (${error.code})`
                    : error instanceof SdkError
                      ? `throws SdkError (${error.code})`
                      : `throws ${(error as Error).name}`;
            row = { failure, surfacesAs, detail: (error as Error).message };
        }
        row.detail = row.detail.slice(0, 110);
        taxonomy.push(row);
        return row;
    });
}

{
    const { client, close } = await connectInProcess(createAcademicServer);
    await classify('Handler reports a business error (unknown student)', () => client.callTool({ name: 'calculate_gpa', arguments: { student_id: '9999999' } }));
    await classify('Arguments fail the tool inputSchema', () => client.callTool({ name: 'calculate_gpa', arguments: { student_id: 42 } }));
    await classify('Tool name does not exist', () => client.callTool({ name: 'delete_everything', arguments: {} }));
    await classify('Prompt arguments fail argsSchema', () => client.getPrompt({ name: 'class_report', arguments: {} }));
    await classify('Resource URI not found', () => client.readResource({ uri: 'academic://students/0000000' }));
    await classify('Method not available in this protocol era (ping on 2026)', () => client.ping());
    await close();
    await classify('Connection already closed', () => client.callTool({ name: 'list_tables', arguments: {} }));
}
{
    const { client, close } = await connectInProcess(jobServer);
    await classify('Request timeout', () => client.callTool({ name: 'export_transcripts', arguments: { batches: 5, delayMs: 200 } }, { timeout: 100 }));
    await classify('Capability the server never advertised (prompts on a tools-only server)', () => client.listPrompts());
    await close();
}

ex.section('Summary');
console.table(taxonomy.map(({ failure, surfacesAs }) => ({ failure: failure.slice(0, 58), surfacesAs })));
ex.note('Rule of thumb: tool-level problems come back as a RESULT (isError) so the LLM can read and recover;');
ex.note('protocol problems THROW ProtocolError (JSON-RPC code from the server); local problems THROW SdkError.');
ex.save({ taxonomy });
