/**
 * C4 — response caching, configured on the server (config/academic.json → cacheHints, SEP-2549)
 * and honoured by the client. We count how many requests actually reach the server.
 *   Client knobs: cacheMode per call ('use' | 'refresh' | 'bypass'), defaultCacheTtlMs.
 */
import { Client } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';

import { getAcademicConfig } from '../../src/server/academic/data';
import { createAcademicServer } from '../../src/server/academic/server';
import { Example, inProcessHttpTransport } from '../_harness';

const ex = new Example('c4-caching', 'C4 · Response cache: server cacheHints + client cacheMode', [
    'ServerOptions.cacheHints',
    "listTools(params, { cacheMode })",
    "readResource(params, { cacheMode })",
    'ClientOptions.defaultCacheTtlMs'
]);

ex.section('Server configuration');
ex.note(`config/academic.json → cacheHints = ${JSON.stringify(getAcademicConfig().cacheHints)}`);

const handler = createMcpHandler(createAcademicServer);
const rows: Record<string, unknown>[] = [];

async function scenario(label: string, clientOptions: ConstructorParameters<typeof Client>[1], calls: [string, (c: Client) => Promise<unknown>][]) {
    const counter = new Map<string, number>();
    const client = new Client({ name: 'c4', version: '1.0.0' }, clientOptions);
    await client.connect(inProcessHttpTransport(handler, counter));
    counter.clear(); // ignore the handshake
    await ex.run(label, calls.map(([name]) => name).join(' → '), clientOptions, async () => {
        for (const [, call] of calls) await call(client);
        const reached = Object.fromEntries(counter);
        rows.push({ scenario: label, era: client.getProtocolEra(), calls: calls.length, requestsReachingServer: [...counter.values()].reduce((a, b) => a + b, 0) });
        return { era: client.getProtocolEra(), callsMade: calls.length, requestsReachingServer: reached };
    });
    await client.close();
}

const modern = { versionNegotiation: { mode: 'auto' as const } };
const listTools = (mode?: 'use' | 'refresh' | 'bypass'): [string, (c: Client) => Promise<unknown>] => [
    `listTools${mode ? `(${mode})` : ''}`,
    c => c.listTools(undefined, mode ? { cacheMode: mode } : undefined)
];
const readRules = (mode?: 'use' | 'refresh' | 'bypass'): [string, (c: Client) => Promise<unknown>] => [
    `readResource(rules${mode ? `, ${mode}` : ''})`,
    c => c.readResource({ uri: 'academic://rules/grading' }, mode ? { cacheMode: mode } : undefined)
];

ex.section('2026-07-28 connection — the server sends ttlMs/cacheScope with each cacheable result');
await scenario('A. listTools × 3 (default cacheMode "use")', modern, [listTools(), listTools(), listTools()]);
await scenario('B. listTools, then cacheMode "refresh"', modern, [listTools(), listTools('refresh'), listTools()]);
await scenario('C. readResource × 3', modern, [readRules(), readRules(), readRules()]);
await scenario('D. readResource with cacheMode "bypass"', modern, [readRules(), readRules('bypass'), readRules('bypass')]);

ex.section('2025 connection — no cache hints on the wire');
await scenario('E. listTools × 3', {}, [listTools(), listTools(), listTools()]);
await scenario('F. listTools × 3 with defaultCacheTtlMs: 60000 (client opts in)', { defaultCacheTtlMs: 60_000 }, [listTools(), listTools(), listTools()]);

ex.section('Summary');
console.table(rows);
await handler.close();
ex.save({ cacheHints: getAcademicConfig().cacheHints, summary: rows });
