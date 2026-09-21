/**
 * Runs an MCP server factory over stdio (default) or Streamable HTTP (--http [--port N]).
 * Both entry points serve 2026-07-28 ("modern") and 2025 ("legacy") clients.
 *
 * stdio: stdout carries the JSON-RPC stream, so every log line goes to stderr.
 */
import { createServer } from 'node:http';

import { localhostHostValidation, localhostOriginValidation, toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler, type McpServerFactory } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';

export interface ServeOptions {
    name: string;
    defaultPort: number;
}

export function parseServeArgs(argv: string[], defaultPort: number): { transport: 'stdio' | 'http'; port: number } {
    const portIndex = argv.indexOf('--port');
    const port = portIndex >= 0 ? Number(argv[portIndex + 1]) : Number(process.env.PORT ?? defaultPort);
    return { transport: argv.includes('--http') ? 'http' : 'stdio', port };
}

export function runServer(factory: McpServerFactory, { name, defaultPort }: ServeOptions): void {
    const { transport, port } = parseServeArgs(process.argv.slice(2), defaultPort);

    if (transport === 'stdio') {
        void serveStdio(factory);
        console.error(`[${name}] serving over stdio`);
        return;
    }

    const handler = createMcpHandler(factory);
    const handle = toNodeHandler(handler);
    // Reject requests whose Host/Origin is not localhost (DNS-rebinding protection).
    const hostOk = localhostHostValidation();
    const originOk = localhostOriginValidation();

    const http = createServer((req, res) => {
        if (!hostOk(req, res) || !originOk(req, res)) return;
        if (new URL(req.url ?? '/', 'http://localhost').pathname !== '/mcp') {
            res.writeHead(404, { 'content-type': 'text/plain' }).end('MCP endpoint is /mcp');
            return;
        }
        void handle(req, res);
    });
    http.listen(port, '127.0.0.1', () => console.error(`[${name}] listening on http://127.0.0.1:${port}/mcp`));

    const shutdown = async () => {
        await handler.close();
        http.close(() => process.exit(0));
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
}
