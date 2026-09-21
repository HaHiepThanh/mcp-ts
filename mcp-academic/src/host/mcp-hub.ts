/**
 * Holds one MCP Client per configured server and presents them to the LLM as ONE tool list.
 * Tool names are qualified as "<server>__<tool>" so two servers may use the same tool name.
 * Server → client requests (elicitation, sampling) are delegated to the host's callbacks.
 */
import type { CallToolResult, CreateMessageRequest, CreateMessageResult, ElicitRequest, ElicitResult, Tool } from '@modelcontextprotocol/client';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

import { PROJECT_ROOT } from '../lib/env';
import type { ServerConfig } from './config';
import type { ToolSpec } from './providers/provider';

export const SEPARATOR = '__';

export interface HubCallbacks {
    onElicit: (server: string, params: ElicitRequest['params']) => Promise<ElicitResult>;
    onSample: (server: string, params: CreateMessageRequest['params']) => Promise<CreateMessageResult>;
    onLog?: (server: string, level: string, data: unknown) => void;
    onToolsChanged?: (server: string) => void;
}

export interface ConnectedServer {
    name: string;
    client: Client;
    transport: 'stdio' | 'http';
    tools: Tool[];
}

export interface ToolCallRecord {
    server: string;
    tool: string;
    args: Record<string, unknown>;
    ms: number;
    isError: boolean;
    result: CallToolResult;
}

export class McpHub {
    readonly servers = new Map<string, ConnectedServer>();

    constructor(private readonly callbacks: HubCallbacks) {}

    async connect(name: string, config: ServerConfig): Promise<ConnectedServer> {
        const protocol = config.protocol ?? 'auto';
        const client = new Client(
            { name: 'mcp-academic-host', version: '1.0.0' },
            {
                capabilities: { elicitation: { form: {} }, sampling: {} },
                ...(protocol === 'legacy' ? {} : { versionNegotiation: { mode: protocol === 'auto' ? ('auto' as const) : { pin: protocol } } })
            }
        );
        client.setRequestHandler('elicitation/create', request => this.callbacks.onElicit(name, request.params));
        client.setRequestHandler('sampling/createMessage', async request => this.callbacks.onSample(name, request.params));
        client.setNotificationHandler('notifications/message', n => this.callbacks.onLog?.(name, n.params.level, n.params.data));
        client.setNotificationHandler('notifications/tools/list_changed', async () => {
            const entry = this.servers.get(name);
            if (entry) entry.tools = (await client.listTools()).tools;
            this.callbacks.onToolsChanged?.(name);
        });

        const transport =
            'url' in config
                ? new StreamableHTTPClientTransport(new URL(config.url))
                : new StdioClientTransport({
                      command: config.command === 'node' ? process.execPath : config.command,
                      args: config.args ?? [],
                      env: config.env ? { ...(process.env as Record<string, string>), ...config.env } : undefined,
                      cwd: config.cwd ?? PROJECT_ROOT,
                      stderr: 'ignore'
                  });
        await client.connect(transport);
        const entry: ConnectedServer = { name, client, transport: 'url' in config ? 'http' : 'stdio', tools: (await client.listTools()).tools };
        this.servers.set(name, entry);
        return entry;
    }

    /** Every tool of every server, in the shape the LLM provider expects. */
    toolSpecs(): ToolSpec[] {
        return [...this.servers.values()].flatMap(s =>
            s.tools.map(t => ({ name: `${s.name}${SEPARATOR}${t.name}`, description: `[${s.name}] ${t.description ?? t.title ?? t.name}`, parameters: cleanSchema(t.inputSchema) }))
        );
    }

    instructions(): string {
        return [...this.servers.values()]
            .map(s => s.client.getInstructions() && `Server "${s.name}": ${s.client.getInstructions()}`)
            .filter(Boolean)
            .join('\n');
    }

    async callTool(qualified: string, args: Record<string, unknown>, onprogress?: (p: { progress: number; total?: number; message?: string }) => void): Promise<ToolCallRecord> {
        const index = qualified.indexOf(SEPARATOR);
        const [server, tool] = index > 0 ? [qualified.slice(0, index), qualified.slice(index + SEPARATOR.length)] : ['', qualified];
        const entry = this.servers.get(server);
        const start = performance.now();
        if (!entry) {
            const result: CallToolResult = { content: [{ type: 'text', text: `Unknown tool "${qualified}".` }], isError: true };
            return { server, tool, args, ms: 0, isError: true, result };
        }
        let result: CallToolResult;
        try {
            // Human-in-the-loop tools (elicitation) can take a while — allow 5 minutes.
            result = (await entry.client.callTool({ name: tool, arguments: args }, { onprogress, timeout: 300_000 })) as CallToolResult;
        } catch (error) {
            result = { content: [{ type: 'text', text: `Tool call failed: ${(error as Error).message}` }], isError: true };
        }
        return { server, tool, args, ms: Math.round(performance.now() - start), isError: result.isError === true, result };
    }

    async close(): Promise<void> {
        await Promise.allSettled([...this.servers.values()].map(s => s.client.close()));
        this.servers.clear();
    }
}

/** Drop JSON-Schema meta keys some LLM APIs reject. */
function cleanSchema(schema: Record<string, unknown>): Record<string, unknown> {
    const { $schema: _ignored, ...rest } = schema;
    return rest;
}

/** What the LLM receives back for one tool call. */
export function toolOutputForModel(result: CallToolResult): Record<string, unknown> {
    const text = result.content
        .map(block => (block.type === 'text' ? block.text : `[${block.type} content]`))
        .join('\n');
    if (result.isError) return { error: text };
    return result.structuredContent ? { result: result.structuredContent } : { result: text };
}
