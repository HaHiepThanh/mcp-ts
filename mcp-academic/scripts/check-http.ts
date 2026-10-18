/**
 * Checks that the three MCP servers are reachable over Streamable HTTP and lists their tools.
 * Start them first (one terminal each): npm run academic:http · npm run utility:http · npm run finance:http
 * Usage: npm run check:http
 */
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const SERVERS = [
    ['academic', 3001],
    ['utility', 3002],
    ['finance', 3003]
] as const;

let failed = 0;
for (const [name, port] of SERVERS) {
    const url = `http://127.0.0.1:${port}/mcp`;
    const client = new Client({ name: 'check-http', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
    try {
        const started = performance.now();
        await client.connect(new StreamableHTTPClientTransport(new URL(url)));
        const { tools } = await client.listTools();
        console.log(`✔ ${name.padEnd(8)} ${url} — ${tools.length} tools, protocol era ${client.getProtocolEra()}, connected in ${Math.round(performance.now() - started)} ms`);
        console.log(`    ${tools.map(t => t.name).join(', ')}`);
        await client.close();
    } catch (error) {
        failed++;
        console.log(`✖ ${name.padEnd(8)} ${url} — not reachable (${(error as Error).message.split('\n')[0]}). Start it with: npm run ${name}:http`);
    }
}
process.exitCode = failed ? 1 : 0;
