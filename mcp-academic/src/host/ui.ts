/** Terminal presentation for the chat host (ANSI colours, prompts). */
import { createInterface, type Interface } from 'node:readline/promises';

const tty = process.stdout.isTTY;
const paint = (code: number) => (s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
export const c = { dim: paint(2), bold: paint(1), cyan: paint(36), green: paint(32), yellow: paint(33), red: paint(31), magenta: paint(35) };

let rl: Interface | undefined;

/** Ask the user a question on the terminal; undefined when there is no interactive terminal. */
export async function ask(question: string): Promise<string | undefined> {
    if (!process.stdin.isTTY) return undefined;
    rl ??= createInterface({ input: process.stdin, output: process.stdout });
    return (await rl.question(question)).trim();
}

export function closeInput(): void {
    rl?.close();
    rl = undefined;
}

export function preview(value: unknown, max = 140): string {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    const flat = text.replace(/\s+/g, ' ');
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
