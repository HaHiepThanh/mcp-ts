import { existsSync } from 'node:fs';
import path from 'node:path';

/** Thư mục gốc của project mcp-hocvu. */
export const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');

/**
 * Nạp biến môi trường từ `.env`. Ưu tiên `mcp-hocvu/.env`, sau đó `seminar-emt/.env`.
 * Biến đã có sẵn trong môi trường (vd. export từ terminal) không bị ghi đè.
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
