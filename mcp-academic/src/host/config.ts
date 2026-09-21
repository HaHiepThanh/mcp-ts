import { readFileSync } from 'node:fs';
import path from 'node:path';

import { PROJECT_ROOT } from '../lib/env';

export type ProtocolChoice = 'auto' | 'legacy' | '2026-07-28';

export type ServerConfig =
    | { command: string; args?: string[]; env?: Record<string, string>; cwd?: string; protocol?: ProtocolChoice; disabled?: boolean }
    | { url: string; protocol?: ProtocolChoice; disabled?: boolean };

export interface HostConfig {
    llm: { provider: 'gemini' | 'openai-compatible'; model?: string; temperature?: number; baseUrl?: string };
    mcpServers: Record<string, ServerConfig>;
    agent: { maxToolRounds: number; systemPrompt: string };
    sampling: { approval: 'auto' | 'ask' | 'deny'; maxTokens: number };
    elicitation: { nonInteractive: 'accept' | 'decline' };
    logDir: string;
}

export function loadHostConfig(file = 'config/host.json'): { config: HostConfig; file: string } {
    const resolved = path.resolve(PROJECT_ROOT, file);
    return { config: JSON.parse(readFileSync(resolved, 'utf8')) as HostConfig, file: path.relative(PROJECT_ROOT, resolved) };
}
