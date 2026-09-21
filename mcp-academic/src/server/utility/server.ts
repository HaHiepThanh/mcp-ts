/**
 * The `utility` server — small general-purpose tools the LLM combines with the academic server.
 * It knows nothing about the academic server: the HOST (and its LLM) connects the two.
 *
 *   get_current_time   the LLM does not know today's date or the current semester
 *   convert_score      deterministic 10-point → letter / 4-point conversion (LLMs mis-compute)
 *   save_report        write a Markdown/CSV report into outputs/reports/ (asks before overwriting)
 *   utility://reports/{filename}   read a saved report back
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { type CallToolResult, type InputRequiredResult, type McpRequestContext, McpServer, ResourceNotFoundError, ResourceTemplate } from '@modelcontextprotocol/server';
import * as z from 'zod';

import { PROJECT_ROOT } from '../../lib/env';
import { confirmWithUser } from '../../lib/interaction';
import { fail, structured } from '../../lib/results';
import { Grading, loadGradingConfig } from '../academic/grading';

interface UtilityConfig {
    reportsDir: string;
    timezone: string;
    academicYearStartMonth: number;
    semesterByMonth: Record<string, number>;
}

const config = JSON.parse(readFileSync(path.join(PROJECT_ROOT, 'config/utility.json'), 'utf8')) as UtilityConfig;
const REPORTS_DIR = path.resolve(PROJECT_ROOT, config.reportsDir);
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,59}$/;

let grading: Grading | undefined;
const getGrading = () => (grading ??= new Grading(loadGradingConfig()));

/** Academic semester code ("2026-1") for a date, using the configured calendar. */
export function semesterOf(date: Date, timezone = config.timezone): string {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: 'numeric' }).formatToParts(date);
    const year = Number(parts.find(p => p.type === 'year')!.value);
    const month = Number(parts.find(p => p.type === 'month')!.value);
    const academicYear = month >= config.academicYearStartMonth ? year : year - 1;
    return `${academicYear}-${config.semesterByMonth[String(month)]}`;
}

function reportPath(filename: string): string | undefined {
    // Only plain names are accepted, and the resolved path must stay inside REPORTS_DIR.
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,70}$/.test(filename) || filename.includes('..')) return undefined;
    const resolved = path.resolve(REPORTS_DIR, filename);
    return resolved.startsWith(REPORTS_DIR + path.sep) ? resolved : undefined;
}

export function createUtilityServer(ctx: McpRequestContext): McpServer {
    const server = new McpServer(
        { name: 'utility', title: 'Utility Tools', version: '1.0.0' },
        { instructions: 'General helpers: current date/semester, score conversion, and saving reports to files. Save a report only when the user asks for a file.' }
    );

    server.registerTool(
        'get_current_time',
        {
            title: 'Current date, time and semester',
            description: 'Current date and time in a timezone, plus the current academic semester code (e.g. "2026-1"). Use it whenever the user says "now", "this semester", "today".',
            inputSchema: z.object({ timezone: z.string().default(config.timezone).describe('IANA timezone, e.g. "Asia/Ho_Chi_Minh"') }),
            outputSchema: z.object({ iso: z.string(), local: z.string(), timezone: z.string(), current_semester: z.string() }),
            annotations: { readOnlyHint: true, openWorldHint: false }
        },
        async ({ timezone }) => {
            const now = new Date();
            let local: string;
            try {
                local = now.toLocaleString('en-GB', { timeZone: timezone, dateStyle: 'full', timeStyle: 'short' });
            } catch {
                return fail(`Unknown timezone "${timezone}". Use an IANA name such as "Asia/Ho_Chi_Minh".`);
            }
            return structured({ iso: now.toISOString(), local, timezone, current_semester: semesterOf(now, timezone) });
        }
    );

    server.registerTool(
        'convert_score',
        {
            title: 'Convert a score',
            description: 'Convert a course total on the 10-point scale to the letter grade (A–F) and 4-point value, using the university rules.',
            inputSchema: z.object({ score: z.number().min(0).max(10).describe('Course total, 0–10') }),
            outputSchema: z.object({ score: z.number(), letter: z.string(), point: z.number(), passed: z.boolean() }),
            annotations: { readOnlyHint: true, openWorldHint: false }
        },
        async ({ score }) => {
            const { letter, point } = getGrading().letterOf(score);
            return structured({ score, letter, point, passed: !getGrading().config.failingLetters.includes(letter) });
        }
    );

    server.registerTool(
        'save_report',
        {
            title: 'Save a report to a file',
            description: `Save Markdown or CSV text as a file in ${config.reportsDir}/. If the file exists, the user is asked before it is overwritten.`,
            inputSchema: z.object({
                filename: z.string().regex(SAFE_NAME, 'Use letters, digits, "-" or "_" only (no extension, no folders)').describe('File name without extension, e.g. "IT01-report-2024-1"'),
                content: z.string().min(1).max(200_000).describe('Full file content'),
                format: z.enum(['md', 'csv']).default('md')
            }),
            annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
        },
        async ({ filename, content, format }, reqCtx): Promise<CallToolResult | InputRequiredResult> => {
            const file = reportPath(`${filename}.${format}`);
            if (!file) return fail(`Invalid file name "${filename}".`);
            if (existsSync(file)) {
                let answer;
                try {
                    answer = await confirmWithUser(ctx.era, reqCtx, 'confirm_overwrite', `${path.basename(file)} already exists. Overwrite it?`);
                } catch (error) {
                    return fail(`${path.basename(file)} already exists and the user could not be asked (${String(error)}). Choose another file name.`);
                }
                if (answer.kind === 'pending') return answer.result;
                if (!answer.confirmed) return fail(`${path.basename(file)} already exists and the user chose not to overwrite it. Choose another file name.`);
            }
            mkdirSync(REPORTS_DIR, { recursive: true });
            writeFileSync(file, content, 'utf8');
            return structured({ saved: path.relative(PROJECT_ROOT, file), bytes: Buffer.byteLength(content), uri: `utility://reports/${path.basename(file)}` });
        }
    );

    server.registerResource(
        'report',
        new ResourceTemplate('utility://reports/{filename}', {
            list: async () => ({
                resources: (existsSync(REPORTS_DIR) ? readdirSync(REPORTS_DIR) : [])
                    .filter(f => /\.(md|csv)$/.test(f))
                    .map(f => ({ uri: `utility://reports/${f}`, name: f, mimeType: f.endsWith('.csv') ? 'text/csv' : 'text/markdown' }))
            })
        }),
        { title: 'Saved report', description: 'A report previously written by save_report' },
        async (uri, { filename }) => {
            const file = reportPath(String(filename));
            if (!file || !existsSync(file)) throw new ResourceNotFoundError(uri.href, `No report named "${filename}"`);
            return { contents: [{ uri: uri.href, mimeType: file.endsWith('.csv') ? 'text/csv' : 'text/markdown', text: readFileSync(file, 'utf8') }] };
        }
    );

    return server;
}
