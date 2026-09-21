/**
 * Server MCP tối giản chỉ dùng để kiểm tra môi trường (npm run doctor).
 * Server thật nằm ở src/server/.
 */
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod';

function createServer(): McpServer {
    const server = new McpServer({ name: 'smoke', version: '0.1.0' });

    server.registerTool(
        'xin_chao',
        {
            description: 'Chào một người theo tên',
            inputSchema: z.object({ ten: z.string().describe('Tên người cần chào') })
        },
        async ({ ten }) => ({
            content: [{ type: 'text', text: `Xin chào ${ten}! MCP server đang hoạt động.` }]
        })
    );

    return server;
}

void serveStdio(createServer);
