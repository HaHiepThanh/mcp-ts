import { existsSync } from 'node:fs';
import path from 'node:path';

/** Root folder of the mcp-academic project. */
export const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');

/**
 * Loads environment variables from `.env`: first `mcp-academic/.env`, then `seminar-emt/.env`.
 * Variables already set in the environment (e.g. exported in the terminal) are not overwritten.
 */
export function loadEnv(): string[] {
    const candidates = [path.join(PROJECT_ROOT, '.env'), path.join(PROJECT_ROOT, '..', '.env')];
    const loaded: string[] = [];
    for (const file of candidates) {
        if (existsSync(file)) {
            process.loadEnvFile(file);
            loaded.push(file);
        }
    }
    return loaded;
}
