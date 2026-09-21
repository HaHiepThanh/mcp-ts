/**
 * S1 — new McpServer(serverInfo, options)
 * Four parameter sets; for each, a client connects and reads what the server advertised.
 */
import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';

import { createAcademicServer } from '../../src/server/academic/server';
import { connectInProcess, Example } from '../_harness';

const ex = new Example('s1-mcp-server', 'S1 · Creating a server: new McpServer(serverInfo, options)', [
    'new McpServer()',
    'client.getServerVersion()',
    'client.getInstructions()',
    'client.getServerCapabilities()'
]);

const variants: { label: string; params: unknown; build: () => McpServer }[] = [
    {
        label: 'A. serverInfo only (name + version)',
        params: { serverInfo: { name: 'demo-a', version: '1.0.0' } },
        build: () => new McpServer({ name: 'demo-a', version: '1.0.0' })
    },
    {
        label: 'B. + title + instructions',
        params: { serverInfo: { name: 'demo-b', title: 'Demo B', version: '1.1.0' }, options: { instructions: 'Call search_students before any other tool.' } },
        build: () => new McpServer({ name: 'demo-b', title: 'Demo B', version: '1.1.0' }, { instructions: 'Call search_students before any other tool.' })
    },
    {
        label: 'C. + capabilities.logging + one tool',
        params: { serverInfo: { name: 'demo-c', version: '1.0.0' }, options: { capabilities: { logging: {} } }, tools: ['echo'] },
        build: () => {
            const server = new McpServer({ name: 'demo-c', version: '1.0.0' }, { capabilities: { logging: {} } });
            server.registerTool('echo', { description: 'Echo text back', inputSchema: z.object({ text: z.string() }) }, async ({ text }) => ({
                content: [{ type: 'text', text }]
            }));
            return server;
        }
    },
    {
        label: 'D. the real academic server (tools + resources + prompts + logging)',
        params: { factory: 'createAcademicServer' },
        build: () => createAcademicServer({ era: 'modern' })
    }
];

const summary = [];
for (const variant of variants) {
    ex.section(variant.label);
    ex.note(`parameters: ${JSON.stringify(variant.params)}`);
    const { client, close } = await connectInProcess(() => variant.build());
    const info = await ex.run('What the client sees after connecting', 'getServerVersion / getInstructions / getServerCapabilities', undefined, async () => ({
        serverVersion: client.getServerVersion(),
        instructions: client.getInstructions() ?? null,
        capabilities: client.getServerCapabilities(),
        protocolEra: client.getProtocolEra()
    }));
    summary.push({ variant: variant.label, capabilities: Object.keys(info?.capabilities ?? {}) });
    await close();
}

ex.section('Summary — capabilities are derived from what you register');
console.table(summary.map(s => ({ variant: s.variant.slice(0, 40), capabilities: s.capabilities.join(', ') || '(none)' })));
ex.save({ summary });
