/**
 * Minimal MCP server used only by the environment check (npm run doctor).
 * The real servers live in src/server/.
 */
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod';

function createServer(): McpServer {
    const server = new McpServer({ name: 'smoke', version: '0.1.0' });

    server.registerTool(
        'greet',
        {
            description: 'Greet someone by name',
            inputSchema: z.object({ name: z.string().describe('Name of the person to greet') })
        },
        async ({ name }) => ({
            content: [{ type: 'text', text: `Hello ${name}! The MCP server is working.` }]
        })
    );

    return server;
}

void serveStdio(createServer);
