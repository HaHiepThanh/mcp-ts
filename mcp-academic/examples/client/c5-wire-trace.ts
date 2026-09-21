/**
 * C5 — what actually travels on the wire: the JSON-RPC 2.0 messages of one session,
 * captured on both protocol eras (connect → tools/list → tools/call → a call that needs elicitation).
 * Output: outputs/examples/c5-wire-trace.json — ready to paste into the "algorithm" slides.
 */
import { Client, InMemoryTransport, type Transport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';

import { createAcademicServer } from '../../src/server/academic/server';
import { Example, inProcessHttpTransport } from '../_harness';

const ex = new Example('c5-wire-trace', 'C5 · JSON-RPC messages on the wire (2025 vs 2026-07-28)', ['JSON-RPC 2.0', 'initialize', 'server/discover', 'tools/list', 'tools/call', 'input_required']);

interface Frame {
    n: number;
    direction: 'client → server' | 'server → client';
    message: unknown;
}

/** Wrap a client transport so every message in and out is recorded. */
function traced(inner: Transport, frames: Frame[]): Transport {
    const record = (direction: Frame['direction'], message: unknown) => frames.push({ n: frames.length + 1, direction, message: shorten(message) });
    const originalSend = inner.send.bind(inner);
    inner.send = (message, options) => (record('client → server', message), originalSend(message, options));
    return new Proxy(inner, {
        set(target, prop, value) {
            if (prop === 'onmessage' && typeof value === 'function') {
                const handler = value as (m: unknown, extra?: unknown) => void;
                return Reflect.set(target, prop, (m: unknown, extra?: unknown) => (record('server → client', m), handler(m, extra)));
            }
            return Reflect.set(target, prop, value);
        }
    });
}

/** Keep the trace readable: long strings and big arrays are clipped. */
function shorten(value: unknown, depth = 0): unknown {
    if (typeof value === 'string') return value.length > 160 ? `${value.slice(0, 157)}...` : value;
    if (Array.isArray(value)) return value.length > 3 && depth > 0 ? [...value.slice(0, 2).map(v => shorten(v, depth + 1)), `... ${value.length - 2} more`] : value.map(v => shorten(v, depth + 1));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k === 'inputSchema' || k === 'outputSchema' ? '{…JSON Schema…}' : shorten(v, depth + 1)]));
    return value;
}

async function session(era: 'legacy' | 'modern') {
    const frames: Frame[] = [];
    const client = new Client(
        { name: 'trace-client', version: '1.0.0' },
        { capabilities: { elicitation: { form: {} } }, ...(era === 'modern' ? { versionNegotiation: { mode: 'auto' as const } } : {}) }
    );
    client.setRequestHandler('elicitation/create', async () => ({ action: 'accept', content: { confirm: true } }));

    let close: () => Promise<void>;
    if (era === 'modern') {
        const handler = createMcpHandler(createAcademicServer);
        await client.connect(traced(inProcessHttpTransport(handler), frames));
        close = async () => (await client.close(), await handler.close());
    } else {
        const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
        const server = createAcademicServer({ era: 'legacy' });
        await server.connect(serverSide);
        await client.connect(traced(clientSide, frames));
        close = async () => (await client.close(), await server.close());
    }
    const mark = (label: string) => frames.push({ n: frames.length + 1, direction: 'client → server', message: `──── ${label} ────` });

    mark('tools/list');
    await client.listTools();
    mark('tools/call calculate_gpa');
    await client.callTool({ name: 'calculate_gpa', arguments: { student_id: '2201001', semester: '2024-1' } });
    mark('tools/call update_grade (needs user confirmation)');
    await client.callTool({ name: 'update_grade', arguments: { student_id: '2201001', course_id: 'GE101', semester: '2024-1', final_score: 9 } });
    await close();
    return frames;
}

const legacy = await ex.run('2025 era: initialize handshake, server pushes elicitation/create mid-call', 'trace', undefined, () => session('legacy'), f => `${f.length} frames`);
const modern = await ex.run('2026-07-28 era: server/discover, tool returns input_required and the client retries', 'trace', undefined, () => session('modern'), f => `${f.length} frames`);

for (const [title, frames] of [['2025', legacy], ['2026-07-28', modern]] as const) {
    ex.section(`${title} — message sequence`);
    for (const f of frames ?? []) {
        const m = f.message as { method?: string; id?: unknown; result?: { resultType?: string } };
        const label = typeof f.message === 'string' ? f.message : m.method ? `${m.method}${m.id !== undefined ? ` (id ${String(m.id)})` : ' (notification)'}` : `response id ${String(m.id)}${m.result?.resultType === 'input_required' ? ' — input_required' : ''}`;
        console.log(`  ${String(f.n).padStart(2)}. ${typeof f.message === 'string' ? '' : f.direction.padEnd(16)} ${label}`);
    }
}
ex.save({ legacy, modern });
