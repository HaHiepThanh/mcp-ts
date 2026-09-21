/**
 * S8 — the same academic server behind two real transports, each with two protocol eras.
 *   stdio : serveStdio(factory)                 ← client spawns the server process
 *   HTTP  : createMcpHandler(factory) on /mcp   ← server runs as its own process
 * Client side: StdioClientTransport / StreamableHTTPClientTransport,
 *   versionNegotiation absent (2025 "legacy", default) vs { mode: 'auto' } (2026-07-28 "modern").
 */
import { type ChildProcess, spawn } from 'node:child_process';
import { request } from 'node:http';
import path from 'node:path';

import { Client, StreamableHTTPClientTransport, type Transport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

import { PROJECT_ROOT } from '../../src/lib/env';
import { Example } from '../_harness';

const ex = new Example('s8-transports', 'S8 · Transports: stdio vs Streamable HTTP × 2025 vs 2026-07-28', [
    'serveStdio',
    'createMcpHandler',
    'StdioClientTransport',
    'StreamableHTTPClientTransport',
    'Client versionNegotiation'
]);

const ENTRY = path.join(PROJECT_ROOT, 'src/server/academic/main.ts');
const PORT = 3911;
const URL_MCP = `http://127.0.0.1:${PORT}/mcp`;
const CALLS = 20;

async function measure(transportName: string, mode: 'legacy' | 'auto', makeTransport: () => Transport) {
    const client = new Client({ name: 's8', version: '1.0.0' }, mode === 'auto' ? { versionNegotiation: { mode: 'auto' } } : {});
    let t = performance.now();
    await client.connect(makeTransport());
    const connectMs = performance.now() - t;

    t = performance.now();
    await client.callTool({ name: 'calculate_gpa', arguments: { student_id: '2201001' } });
    const firstCallMs = performance.now() - t;

    t = performance.now();
    for (let i = 0; i < CALLS; i++) await client.callTool({ name: 'calculate_gpa', arguments: { student_id: '2201001', semester: '2024-1' } });
    const avgCallMs = (performance.now() - t) / CALLS;

    const tools = (await client.listTools()).tools.length;
    const era = client.getProtocolEra();
    await client.close();
    const r = (n: number) => Math.round(n * 10) / 10;
    return { transport: transportName, negotiation: mode, era, tools, connectMs: r(connectMs), firstCallMs: r(firstCallMs), [`avgOf${CALLS}CallsMs`]: r(avgCallMs) };
}

const results: Record<string, unknown>[] = [];

ex.section('stdio — the client spawns `node --import tsx src/server/academic/main.ts`');
for (const mode of ['legacy', 'auto'] as const) {
    const row = await ex.run(`stdio, negotiation=${mode}`, 'new StdioClientTransport({ command, args })', { command: 'node', args: ['--import', 'tsx', 'src/server/academic/main.ts'] }, () =>
        measure('stdio', mode, () => new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', ENTRY], cwd: PROJECT_ROOT, stderr: 'ignore' }))
    );
    if (row) results.push(row);
}

ex.section(`Streamable HTTP — server started separately with --http --port ${PORT}`);
const server: ChildProcess = spawn(process.execPath, ['--import', 'tsx', ENTRY, '--http', '--port', String(PORT)], { cwd: PROJECT_ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('HTTP server did not start')), 15_000);
    server.stderr!.on('data', chunk => String(chunk).includes('listening') && (clearTimeout(timer), resolve()));
});
try {
    for (const mode of ['legacy', 'auto'] as const) {
        const row = await ex.run(`HTTP, negotiation=${mode}`, 'new StreamableHTTPClientTransport(url)', { url: URL_MCP }, () =>
            measure('http', mode, () => new StreamableHTTPClientTransport(new URL(URL_MCP)))
        );
        if (row) results.push(row);
    }

    ex.section('HTTP endpoint hardening (localhost Host/Origin validation)');
    const raw = (headers: Record<string, string>, urlPath = '/mcp') =>
        new Promise<{ status?: number; body: string }>(resolve => {
            const req = request({ host: '127.0.0.1', port: PORT, path: urlPath, method: 'POST', headers: { 'content-type': 'application/json', ...headers } }, res => {
                let body = '';
                res.on('data', c => (body += c));
                res.on('end', () => resolve({ status: res.statusCode, body: body.slice(0, 160) }));
            });
            req.end('{}');
        });
    await ex.run('Wrong path', 'POST /other', {}, () => raw({}, '/other'));
    await ex.run('Foreign Host header (DNS-rebinding attempt)', 'POST /mcp', { Host: 'evil.example' }, () => raw({ Host: 'evil.example' }));
    await ex.run('Foreign Origin header (browser page on another site)', 'POST /mcp', { Origin: 'https://evil.example' }, () => raw({ Origin: 'https://evil.example' }));
} finally {
    server.kill('SIGTERM');
}

ex.section('Comparison');
console.table(results);
ex.save({ comparison: results, note: `Timings from one run on the presenter's machine; ${CALLS} sequential calculate_gpa calls per row.` });
