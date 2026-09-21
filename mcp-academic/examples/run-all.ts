/**
 * Runs every example in examples/<group>/ (default: all groups) one after another.
 * Each run's console output is saved next to its JSON: outputs/examples/<name>.log
 * Usage: npm run examples            (all)
 *        npm run examples -- server  (one group)
 */
import { spawn } from 'node:child_process';
import { createWriteStream, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { PROJECT_ROOT } from '../src/lib/env';

const groups = process.argv.slice(2).length ? process.argv.slice(2) : ['server', 'client'];
const outDir = path.join(PROJECT_ROOT, 'outputs', 'examples');
const summary: { group: string; example: string; ok: boolean; seconds: number }[] = [];

for (const group of groups) {
    const dir = path.join(PROJECT_ROOT, 'examples', group);
    let files: string[];
    try {
        files = readdirSync(dir).filter(f => /^[a-z]\d.*\.ts$/.test(f)).sort();
    } catch {
        continue;
    }
    for (const file of files) {
        const name = path.basename(file, '.ts');
        const started = performance.now();
        const log = createWriteStream(path.join(outDir, `${name}.log`));
        const code = await new Promise<number | null>(resolve => {
            const child = spawn(process.execPath, ['--import', 'tsx', path.join(dir, file)], { cwd: PROJECT_ROOT });
            child.stdout.pipe(log);
            child.stderr.pipe(log);
            child.on('close', resolve);
        });
        const seconds = Math.round((performance.now() - started) / 100) / 10;
        summary.push({ group, example: name, ok: code === 0, seconds });
        console.log(`${code === 0 ? '✔' : '✖'} ${group}/${name} (${seconds}s) → outputs/examples/${name}.{json,log}`);
    }
}

writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify({ ranAt: new Date().toISOString(), summary }, null, 2));
const failed = summary.filter(s => !s.ok);
console.log(`\n${summary.length - failed.length}/${summary.length} examples passed`);
process.exitCode = failed.length ? 1 : 0;
