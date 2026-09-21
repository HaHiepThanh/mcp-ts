/**
 * C1 — new Client(clientInfo, options) + client.connect(transport, connectOptions)
 * Parameter sets for versionNegotiation (default / auto / pin), a cached discovery verdict
 * (connect({ prior })), era mismatches, ping, and close().
 */
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';

import { createAcademicServer } from '../../src/server/academic/server';
import { Example, inProcessHttpTransport } from '../_harness';

const ex = new Example('c1-client-connect', 'C1 · Connecting: new Client(info, options) + connect(transport, options)', [
    'new Client()',
    'client.connect()',
    'client.getProtocolEra()',
    'client.getDiscoverResult()',
    'client.ping()',
    'client.close()'
]);

const handler = createMcpHandler(createAcademicServer); // serves 2026 requests AND 2025 requests (stateless fallback)
const info = { name: 'c1-client', version: '1.0.0' };

async function connectAndDescribe(label: string, options: ConstructorParameters<typeof Client>[1], connectOptions?: Parameters<Client['connect']>[1]) {
    const counter = new Map<string, number>();
    const client = new Client(info, options);
    const start = performance.now();
    const result = await ex.run(label, 'new Client(info, options) → connect(transport, connectOptions)', { options, connectOptions }, async () => {
        await client.connect(inProcessHttpTransport(handler, counter), connectOptions);
        const discover = client.getDiscoverResult();
        return {
            era: client.getProtocolEra(),
            server: client.getServerVersion()?.name,
            discoverResult: discover ? { supportedVersions: (discover as { supportedVersions?: string[] }).supportedVersions, keys: Object.keys(discover) } : undefined,
            connectMs: Math.round(performance.now() - start),
            requestsDuringConnect: Object.fromEntries(counter)
        };
    });
    return { client, result };
}

ex.section('versionNegotiation parameter sets');
const legacy = await connectAndDescribe('A. default options → 2025 "initialize" handshake', {});
const auto = await connectAndDescribe('B. versionNegotiation: { mode: "auto" } → probes server/discover', { versionNegotiation: { mode: 'auto' } });
const pinned = await connectAndDescribe('C. versionNegotiation: { mode: { pin: "2026-07-28" } }', { versionNegotiation: { mode: { pin: '2026-07-28' } } });

ex.section('Cached verdict: connect(transport, { prior })');
const discover = auto.client.getDiscoverResult();
if (discover) {
    await connectAndDescribe('D. prior: { kind: "modern", discover } → zero-round-trip connect', { versionNegotiation: { mode: 'auto' } }, { prior: { kind: 'modern', discover } });
}

ex.section('ping() on each era');
await ex.run('ping on a 2025 connection', 'ping', { timeout: 2000 }, () => legacy.client.ping({ timeout: 2000 }));
await ex.run('ping on a 2026-07-28 connection (ping is a 2025-era method)', 'ping', { timeout: 2000 }, () => auto.client.ping({ timeout: 2000 }));

ex.section('Era mismatches');
await ex.run('E. pin 2026-07-28 against a 2025-only server → no fallback', 'connect', { versionNegotiation: { mode: { pin: '2026-07-28' }, probe: { timeoutMs: 1500 } } }, async () => {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair(); // in-memory pairs speak the 2025 era only
    await createAcademicServer({ era: 'legacy' }).connect(serverSide);
    const client = new Client(info, { versionNegotiation: { mode: { pin: '2026-07-28' }, probe: { timeoutMs: 1500 } } });
    await client.connect(clientSide);
    return client.getProtocolEra();
});
await ex.run('F. default (2025) client against a 2026-only endpoint (legacy: "reject")', 'connect', { serverOptions: { legacy: 'reject' } }, async () => {
    const strict = createMcpHandler(createAcademicServer, { legacy: 'reject' });
    const client = new Client(info);
    await client.connect(inProcessHttpTransport(strict));
    return client.getProtocolEra();
});

ex.section('close()');
await ex.run('close() then call a tool → rejected locally', 'close + callTool', { name: 'list_tables' }, async () => {
    await pinned.client.close();
    return pinned.client.callTool({ name: 'list_tables', arguments: {} });
});

for (const c of [legacy.client, auto.client]) await c.close();
await handler.close();
ex.save({ legacyConnect: legacy.result, autoConnect: auto.result });
