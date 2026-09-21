/**
 * S6 — request context helpers inside a handler (ctx.mcpReq):
 *   progress      ctx.mcpReq.notify(notifications/progress)  ← client passes onprogress
 *   logging       ctx.mcpReq.log(level, data)                ← client.setLoggingLevel (deprecated, SEP-2577)
 *   cancellation  ctx.mcpReq.signal                          ← client aborts its AbortSignal
 */
import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';

import { createAcademicServer } from '../../src/server/academic/server';
import { connectInProcess, Example } from '../_harness';

const ex = new Example('s6-logging-progress-cancel', 'S6 · Progress, logging and cancellation (ctx.mcpReq)', [
    'ctx.mcpReq.notify (progress)',
    'ctx.mcpReq.log',
    'ctx.mcpReq.signal',
    'client.callTool({ onprogress, signal })',
    'client.setLoggingLevel'
]);

// ── Progress ─────────────────────────────────────────────────────────
ex.section('Progress — rank_students reports every 10 students');
{
    const { client, close } = await connectInProcess(createAcademicServer);
    const updates: unknown[] = [];
    await ex.run('With onprogress → server sends notifications/progress', 'callTool', { name: 'rank_students', arguments: { scope: 'all', top: 3 }, options: { onprogress: 'fn' } }, async () => {
        const r = await client.callTool({ name: 'rank_students', arguments: { scope: 'all', top: 3 } }, { onprogress: u => void updates.push(u) });
        return { progressUpdates: updates, top3: (r.structuredContent as { ranking: { full_name: string; gpa: number }[] }).ranking.map(x => `${x.full_name} ${x.gpa}`) };
    });
    await ex.run('Without onprogress → no progressToken, no notifications', 'callTool', { name: 'rank_students', arguments: { scope: 'all', top: 3 } }, async () => {
        const before = updates.length;
        await client.callTool({ name: 'rank_students', arguments: { scope: 'all', top: 3 } });
        return { newProgressUpdates: updates.length - before };
    });
    await close();
}

// ── Logging (session-level filter = 2025 era) ────────────────────────
ex.section('Logging — client.setLoggingLevel filters ctx.mcpReq.log (2025-era session)');
ex.note('MCP logging is deprecated in protocol 2026-07-28 (SEP-2577); on 2026 connections the level is sent per request.');
{
    const logs: string[] = [];
    const { client, close } = await connectInProcess(createAcademicServer, {
        era: 'legacy',
        setup: c => c.setNotificationHandler('notifications/message', n => void logs.push(`${n.params.level}: ${JSON.stringify(n.params.data)}`))
    });
    const query = { name: 'query_table', arguments: { table: 'students', filters: [{ column: 'class_id', operator: 'eq', value: 'IT01' }], limit: 1 } };
    for (const level of ['debug', 'info', 'error'] as const) {
        await ex.run(`setLoggingLevel("${level}") then callTool`, 'setLoggingLevel + callTool', { level, ...query }, async () => {
            logs.length = 0;
            await client.setLoggingLevel(level);
            await client.callTool(query);
            return { logMessagesReceived: [...logs] };
        });
    }
    await close();
}

// ── Cancellation ─────────────────────────────────────────────────────
ex.section('Cancellation — the client aborts; the handler sees ctx.mcpReq.signal');
{
    const serverSide: string[] = [];
    const slowServer = () => {
        const server = new McpServer({ name: 'slow', version: '1.0.0' });
        server.registerTool(
            'recalculate_all_gpas',
            { description: 'Slow batch job (100 ms per student)', inputSchema: z.object({ students: z.number().int().max(100) }) },
            async ({ students }, ctx) => {
                let done = 0;
                for (; done < students; done++) {
                    if (ctx.mcpReq.signal.aborted) {
                        serverSide.push(`stopped after ${done}/${students}: ${String(ctx.mcpReq.signal.reason)}`);
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                if (done === students) serverSide.push(`finished ${done}/${students}`);
                return { content: [{ type: 'text', text: `Recalculated ${done} GPAs` }] };
            }
        );
        return server;
    };

    for (const era of ['legacy', 'modern'] as const) {
        const { client, close } = await connectInProcess(slowServer, { era });
        serverSide.length = 0;
        const controller = new AbortController();
        setTimeout(() => controller.abort('user pressed Stop'), 350);
        await ex.run(`${era} era: abort after 350 ms`, 'callTool', { name: 'recalculate_all_gpas', arguments: { students: 20 }, options: { signal: 'AbortSignal' } }, () =>
            client.callTool({ name: 'recalculate_all_gpas', arguments: { students: 20 } }, { signal: controller.signal })
        );
        await new Promise(resolve => setTimeout(resolve, 250));
        ex.note(`server side: ${serverSide.join(' | ') || '(handler did not report)'}`);
        await close();
    }
}

ex.save();
