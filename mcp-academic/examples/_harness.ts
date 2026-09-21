/**
 * Shared plumbing for the method examples.
 *
 * - connectInProcess(): real Client ↔ real server, no network. "modern" (2026-07-28) goes
 *   through createMcpHandler's fetch face; "legacy" (2025) uses an in-memory transport pair.
 * - Example: prints every step (method, parameters, result, time) and saves the whole run to
 *   outputs/examples/<name>.json for the slides.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { Client, type ClientOptions, InMemoryTransport, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler, type McpServerFactory } from '@modelcontextprotocol/server';

import { PROJECT_ROOT } from '../src/lib/env';

export type Era = 'modern' | 'legacy';

export interface Connection {
    client: Client;
    era: Era;
    close: () => Promise<void>;
}

export interface ConnectOptions {
    era?: Era;
    capabilities?: NonNullable<ClientOptions>['capabilities'];
    /** Register client-side handlers (elicitation, sampling, notifications) before connecting. */
    setup?: (client: Client) => void;
}

export async function connectInProcess(factory: McpServerFactory, options: ConnectOptions = {}): Promise<Connection> {
    const era = options.era ?? 'modern';
    const client = new Client(
        { name: 'example-client', version: '1.0.0' },
        { capabilities: options.capabilities ?? {}, ...(era === 'modern' ? { versionNegotiation: { mode: 'auto' as const } } : {}) }
    );
    options.setup?.(client);

    if (era === 'modern') {
        const handler = createMcpHandler(factory);
        await client.connect(
            new StreamableHTTPClientTransport(new URL('http://in-process.local/mcp'), { fetch: (url, init) => handler.fetch(new Request(url, init)) })
        );
        return { client, era, close: async () => (await client.close(), await handler.close()) };
    }

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = await factory({ era: 'legacy' });
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    return { client, era, close: async () => (await client.close(), await server.close()) };
}

interface Step {
    step: string;
    method: string;
    params?: unknown;
    ok: boolean;
    ms: number;
    result?: unknown;
    error?: { name: string; code?: unknown; message: string };
}

export class Example {
    private readonly steps: Step[] = [];
    private readonly started = new Date();

    constructor(
        readonly name: string,
        readonly title: string,
        readonly sdkMethods: string[]
    ) {
        console.log(`\n${'═'.repeat(78)}\n${title}\nSDK: ${sdkMethods.join(', ')}\n${'═'.repeat(78)}`);
    }

    section(heading: string): void {
        console.log(`\n── ${heading} ${'─'.repeat(Math.max(0, 74 - heading.length))}`);
    }

    note(message: string): void {
        console.log(`   ℹ ${message}`);
    }

    /** Run one call, print params + result (or error), and record it. Errors never stop the example. */
    async run<T>(step: string, method: string, params: unknown, call: () => Promise<T>, view?: (result: T) => unknown): Promise<T | undefined> {
        const start = performance.now();
        console.log(`\n▶ ${step}\n  ${method}(${params === undefined ? '' : compact(params)})`);
        try {
            const result = await call();
            const ms = Math.round(performance.now() - start);
            const shown = view ? view(result) : result;
            console.log(`  ✔ ${ms}ms →`, indent(pretty(shown)));
            this.steps.push({ step, method, params, ok: true, ms, result: shown });
            return result;
        } catch (error) {
            const ms = Math.round(performance.now() - start);
            const e = error as { name?: string; code?: unknown; message?: string };
            const info = { name: e.name ?? 'Error', code: e.code, message: e.message ?? String(error) };
            console.log(`  ✖ ${ms}ms → ${info.name}${info.code !== undefined ? ` (code ${String(info.code)})` : ''}: ${info.message}`);
            this.steps.push({ step, method, params, ok: false, ms, error: info });
            return undefined;
        }
    }

    save(extra: Record<string, unknown> = {}): string {
        const dir = path.join(PROJECT_ROOT, 'outputs', 'examples');
        mkdirSync(dir, { recursive: true });
        const file = path.join(dir, `${this.name}.json`);
        writeFileSync(
            file,
            JSON.stringify({ example: this.name, title: this.title, sdkMethods: this.sdkMethods, ranAt: this.started.toISOString(), ...extra, steps: this.steps }, null, 2)
        );
        const failed = this.steps.filter(s => !s.ok).length;
        console.log(`\n✔ ${this.steps.length} steps (${failed} expected/unexpected errors) — saved ${path.relative(PROJECT_ROOT, file)}`);
        return file;
    }
}

function pretty(value: unknown): string {
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function compact(value: unknown): string {
    const s = JSON.stringify(value);
    return s.length > 160 ? `${s.slice(0, 157)}...` : s;
}

function indent(s: string): string {
    return s.includes('\n') ? '\n' + s.replace(/^/gm, '    ') : s;
}

/** First text block of a tool/prompt result, for readable output. */
export function firstText(result: { content?: unknown[] }): string {
    const block = result.content?.find((b): b is { type: 'text'; text: string } => (b as { type?: string }).type === 'text');
    return block?.text ?? '';
}
