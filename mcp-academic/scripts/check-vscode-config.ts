/**
 * Starts every stdio server in a VS Code mcp.json exactly as VS Code would (same command, args, cwd)
 * and lists what it offers — so a broken config is caught before opening VS Code.
 * Run: npm run check:vscode            (checks ../.vscode/mcp.json and .vscode/mcp.json)
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

import { PROJECT_ROOT } from '../src/lib/env';

interface VsCodeServer {
    type?: 'stdio' | 'http';
    command?: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    url?: string;
}

/** mcp.json is JSONC: drop // and /* *\/ comments that are outside strings, then trailing commas. */
function parseJsonc(text: string): unknown {
    let out = '';
    for (let i = 0, inString = false; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
            out += ch;
            if (ch === '\\') out += text[++i];
            else if (ch === '"') inString = false;
        } else if (ch === '"') {
            inString = true;
            out += ch;
        } else if (ch === '/' && text[i + 1] === '/') {
            while (i < text.length && text[i] !== '\n') i++;
            out += '\n';
        } else if (ch === '/' && text[i + 1] === '*') {
            i = text.indexOf('*/', i + 2) + 1;
        } else {
            out += ch;
        }
    }
    return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

const configs = [
    { file: path.join(PROJECT_ROOT, '..', '.vscode', 'mcp.json'), workspaceFolder: path.join(PROJECT_ROOT, '..') },
    { file: path.join(PROJECT_ROOT, '.vscode', 'mcp.json'), workspaceFolder: PROJECT_ROOT }
].filter(c => existsSync(c.file));

let failures = 0;
for (const { file, workspaceFolder } of configs) {
    console.log(`\n${path.relative(path.join(PROJECT_ROOT, '..'), file)}  (\${workspaceFolder} = ${path.basename(workspaceFolder)})`);
    const { servers } = parseJsonc(readFileSync(file, 'utf8')) as { servers: Record<string, VsCodeServer> };
    const expand = (s: string) => s.replaceAll('${workspaceFolder}', workspaceFolder);

    for (const [name, server] of Object.entries(servers)) {
        if (server.type === 'http' || server.url) {
            console.log(`  • ${name}: http ${server.url} (not started by this check)`);
            continue;
        }
        const client = new Client({ name: 'vscode-config-check', version: '1.0.0' }); // 2025 handshake, like most hosts today
        try {
            const started = performance.now();
            await client.connect(
                new StdioClientTransport({ command: server.command!, args: (server.args ?? []).map(expand), cwd: server.cwd ? expand(server.cwd) : workspaceFolder, env: server.env, stderr: 'ignore' })
            );
            const ms = Math.round(performance.now() - started);
            const caps = client.getServerCapabilities() ?? {};
            const [tools, resources, prompts] = await Promise.all([
                client.listTools(),
                caps.resources ? client.listResources() : Promise.resolve({ resources: [] }),
                caps.prompts ? client.listPrompts() : Promise.resolve({ prompts: [] })
            ]);
            console.log(`  ✔ ${name}: started in ${ms}ms — ${tools.tools.length} tools, ${resources.resources.length} resources, ${prompts.prompts.length} prompts`);
            console.log(`      tools: ${tools.tools.map(t => t.name).join(', ')}`);
        } catch (error) {
            failures++;
            console.log(`  ✖ ${name}: ${(error as Error).message}`);
        } finally {
            await client.close();
        }
    }
}
process.exitCode = failures ? 1 : 0;
