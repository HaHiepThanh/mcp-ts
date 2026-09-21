/**
 * Tools of the `academic` server — actions the LLM decides to call.
 *
 *   Domain tools : search_students, get_transcript, calculate_gpa, class_statistics,
 *                  rank_students, update_grade (elicitation), generate_student_feedback (sampling)
 *   Generic tools: list_tables, describe_table, query_table — work on ANY CSV, so the
 *                  server still works if the team switches to another dataset.
 */
import type { CallToolResult, InputRequiredResult, McpServer, ProtocolEra } from '@modelcontextprotocol/server';
import * as z from 'zod';

import { askHostModel, confirmWithUser } from '../../lib/interaction';
import { fail, fold, structured, text } from '../../lib/results';
import type { AcademicData, Student } from './data';

const studentId = z.string().min(1).describe('Student ID, e.g. "2201001"');
const semester = z
    .string()
    .regex(/^\d{4}-\d$/, 'Semester must look like 2024-1')
    .describe('Semester code "YYYY-N", e.g. "2024-1". Omit for all semesters.');
const score = (name: string) => z.number().min(0).max(10).describe(`${name} on the 10-point scale (0–10)`);

const gpaFields = {
    gpa: z.number().nullable().describe('GPA on the 4-point scale, null when no graded course'),
    classification: z.string().nullable(),
    credits_attempted: z.number(),
    credits_earned: z.number(),
    courses_counted: z.number()
};

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;

export function registerAcademicTools(server: McpServer, data: AcademicData, era: ProtocolEra): void {
    const findStudent = (id: string): Student | undefined => data.students.get(id.trim());
    const notFound = (id: string) => fail(`No student with student_id "${id}". Use search_students to find the right ID.`);

    // ── search_students ────────────────────────────────────────────────
    server.registerTool(
        'search_students',
        {
            title: 'Search students',
            description:
                'Find students by name or ID (case- and accent-insensitive), optionally filtered by class or faculty. ' +
                'Use this first when the user gives a name instead of a student ID.',
            inputSchema: z.object({
                keyword: z.string().optional().describe('Part of the full name or student ID, e.g. "hai" or "2201"'),
                class_id: z.string().optional().describe('Class ID, e.g. "IT01"'),
                faculty: z.string().optional().describe('Faculty name, e.g. "Information Technology"'),
                limit: z.number().int().min(1).max(50).default(10).describe('Maximum number of students to return')
            }),
            outputSchema: z.object({
                total_matches: z.number(),
                returned: z.number(),
                students: z.array(z.object({ student_id: z.string(), full_name: z.string(), class_id: z.string(), faculty: z.string() }))
            }),
            annotations: READ_ONLY
        },
        async ({ keyword, class_id, faculty, limit }) => {
            const needle = keyword ? fold(keyword) : undefined;
            const matches = [...data.students.values()].filter(
                s =>
                    (!needle || fold(s.full_name).includes(needle) || s.student_id.includes(needle)) &&
                    (!class_id || s.class_id.toLowerCase() === class_id.toLowerCase()) &&
                    (!faculty || fold(s.faculty).includes(fold(faculty)))
            );
            const students = matches.slice(0, limit).map(({ student_id, full_name, class_id, faculty }) => ({ student_id, full_name, class_id, faculty }));
            return structured({ total_matches: matches.length, returned: students.length, students });
        }
    );

    // ── get_transcript ─────────────────────────────────────────────────
    server.registerTool(
        'get_transcript',
        {
            title: 'Get transcript',
            description: 'List every graded course of one student with process/final scores, course total, letter grade (A–F) and 4-point value.',
            inputSchema: z.object({ student_id: studentId, semester: semester.optional() }),
            outputSchema: z.object({
                student_id: z.string(),
                full_name: z.string(),
                class_id: z.string(),
                semester: z.string().nullable(),
                courses: z.array(
                    z.object({
                        course_id: z.string(),
                        course_name: z.string(),
                        semester: z.string(),
                        credits: z.number(),
                        process_score: z.number(),
                        final_score: z.number(),
                        total: z.number(),
                        letter: z.string(),
                        point: z.number(),
                        passed: z.boolean()
                    })
                )
            }),
            annotations: READ_ONLY
        },
        async ({ student_id, semester }) => {
            const student = findStudent(student_id);
            if (!student) return notFound(student_id);
            const raw = data.grades.filter(g => g.student_id === student.student_id && (!semester || g.semester === semester));
            if (raw.length === 0) return fail(`No grades for ${student.student_id}${semester ? ` in semester ${semester}` : ''}. Known semesters: ${data.semesters().join(', ')}.`);
            const courses = raw.map(g => {
                const graded = data.grading.grade(g.course_id, g.semester, data.courses.get(g.course_id)!.credits, g.process_score, g.final_score);
                return {
                    course_id: g.course_id,
                    course_name: data.courses.get(g.course_id)!.course_name,
                    semester: g.semester,
                    credits: graded.credits,
                    process_score: g.process_score,
                    final_score: g.final_score,
                    total: graded.total,
                    letter: graded.letter,
                    point: graded.point,
                    passed: graded.passed
                };
            });
            courses.sort((a, b) => a.semester.localeCompare(b.semester) || a.course_id.localeCompare(b.course_id));
            return structured({ student_id: student.student_id, full_name: student.full_name, class_id: student.class_id, semester: semester ?? null, courses });
        }
    );

    // ── calculate_gpa ──────────────────────────────────────────────────
    server.registerTool(
        'calculate_gpa',
        {
            title: 'Calculate GPA',
            description:
                'Credit-weighted GPA on the 4-point scale plus classification (Excellent / Very good / Good / Average / Weak). ' +
                'With semester: that semester only. Without: cumulative GPA, keeping the best attempt of retaken courses.',
            inputSchema: z.object({ student_id: studentId, semester: semester.optional() }),
            outputSchema: z.object({
                student_id: z.string(),
                full_name: z.string(),
                scope: z.enum(['semester', 'cumulative']),
                semester: z.string().nullable(),
                ...gpaFields
            }),
            annotations: READ_ONLY
        },
        async ({ student_id, semester }) => {
            const student = findStudent(student_id);
            if (!student) return notFound(student_id);
            const summary = data.gpaOf(student.student_id, semester);
            if (summary.gpa === null) return fail(`No grades for ${student.student_id}${semester ? ` in semester ${semester}` : ''}. Known semesters: ${data.semesters().join(', ')}.`);
            return structured({
                student_id: student.student_id,
                full_name: student.full_name,
                scope: semester ? ('semester' as const) : ('cumulative' as const),
                semester: semester ?? null,
                ...summary
            });
        }
    );

    // ── class_statistics ───────────────────────────────────────────────
    server.registerTool(
        'class_statistics',
        {
            title: 'Class statistics',
            description:
                'Statistics for one class: average/highest/lowest course total, pass rate, letter-grade distribution and average GPA. ' +
                'Optionally restrict to one course and/or one semester.',
            inputSchema: z.object({
                class_id: z.string().describe('Class ID, e.g. "IT01"'),
                course_id: z.string().optional().describe('Course ID, e.g. "CS201"'),
                semester: semester.optional()
            }),
            outputSchema: z.object({
                class_id: z.string(),
                course_id: z.string().nullable(),
                semester: z.string().nullable(),
                students: z.number(),
                grade_records: z.number(),
                average_total: z.number(),
                highest_total: z.number(),
                lowest_total: z.number(),
                pass_rate: z.number().describe('Share of grade records with a passing letter, 0–1'),
                letter_distribution: z.record(z.string(), z.number()),
                average_gpa: z.number().nullable().describe('Mean GPA of the class in the same scope')
            }),
            annotations: READ_ONLY
        },
        async ({ class_id, course_id, semester }) => {
            const members = [...data.students.values()].filter(s => s.class_id.toLowerCase() === class_id.toLowerCase());
            if (members.length === 0) return fail(`Unknown class "${class_id}". Known classes: ${data.classes().join(', ')}.`);
            if (course_id && !data.courses.has(course_id)) return fail(`Unknown course "${course_id}". Known courses: ${[...data.courses.keys()].join(', ')}.`);

            const ids = new Set(members.map(m => m.student_id));
            const graded = data.grades
                .filter(g => ids.has(g.student_id) && (!course_id || g.course_id === course_id) && (!semester || g.semester === semester))
                .map(g => data.grading.grade(g.course_id, g.semester, data.courses.get(g.course_id)!.credits, g.process_score, g.final_score));
            if (graded.length === 0) return fail(`No grades for class ${class_id} with these filters.`);

            const totals = graded.map(g => g.total);
            const letter_distribution = Object.fromEntries(data.grading.config.letterScale.map(b => [b.letter, graded.filter(g => g.letter === b.letter).length]));
            const gpas = members.map(m => data.gpaOf(m.student_id, semester).gpa).filter((g): g is number => g !== null);
            const round2 = (n: number) => Math.round(n * 100) / 100;

            return structured({
                class_id: members[0].class_id,
                course_id: course_id ?? null,
                semester: semester ?? null,
                students: members.length,
                grade_records: graded.length,
                average_total: round2(totals.reduce((a, b) => a + b, 0) / totals.length),
                highest_total: Math.max(...totals),
                lowest_total: Math.min(...totals),
                pass_rate: round2(graded.filter(g => g.passed).length / graded.length),
                letter_distribution,
                average_gpa: gpas.length ? round2(gpas.reduce((a, b) => a + b, 0) / gpas.length) : null
            });
        }
    );

    // ── rank_students ──────────────────────────────────────────────────
    server.registerTool(
        'rank_students',
        {
            title: 'Rank students by GPA',
            description: 'Top students by GPA (4-point) within a class, a faculty, or the whole school. Reports progress while it works.',
            inputSchema: z.object({
                scope: z.enum(['class', 'faculty', 'all']).describe('Ranking scope'),
                value: z.string().optional().describe('Class ID or faculty name; required unless scope is "all"'),
                semester: semester.optional(),
                top: z.number().int().min(1).max(50).default(5).describe('How many students to return')
            }),
            outputSchema: z.object({
                scope: z.string(),
                value: z.string().nullable(),
                semester: z.string().nullable(),
                ranked: z.number(),
                ranking: z.array(z.object({ rank: z.number(), student_id: z.string(), full_name: z.string(), class_id: z.string(), ...gpaFields }))
            }),
            annotations: READ_ONLY
        },
        async ({ scope, value, semester, top }, ctx) => {
            if (scope !== 'all' && !value) return fail(`"value" is required when scope is "${scope}".`);
            const pool = [...data.students.values()].filter(s =>
                scope === 'class' ? s.class_id.toLowerCase() === value!.toLowerCase() : scope === 'faculty' ? fold(s.faculty).includes(fold(value!)) : true
            );
            if (pool.length === 0) {
                const known = scope === 'class' ? data.classes() : data.faculties();
                return fail(`No students for ${scope} "${value}". Known: ${known.join(', ')}.`);
            }
            await ctx.mcpReq.log('info', `Ranking ${pool.length} students (${scope}${value ? ` ${value}` : ''}${semester ? `, ${semester}` : ''})`);

            const progressToken = ctx.mcpReq._meta?.progressToken;
            const scored = [];
            for (const [i, s] of pool.entries()) {
                if (ctx.mcpReq.signal.aborted) return fail(`Ranking cancelled after ${i} of ${pool.length} students.`);
                const summary = data.gpaOf(s.student_id, semester);
                if (summary.gpa !== null) scored.push({ student_id: s.student_id, full_name: s.full_name, class_id: s.class_id, ...summary });
                if (progressToken !== undefined && ((i + 1) % 10 === 0 || i === pool.length - 1)) {
                    await ctx.mcpReq.notify({
                        method: 'notifications/progress',
                        params: { progressToken, progress: i + 1, total: pool.length, message: `Scored ${i + 1}/${pool.length} students` }
                    });
                }
            }
            scored.sort((a, b) => b.gpa! - a.gpa! || b.credits_earned - a.credits_earned);
            const ranking = scored.slice(0, top).map((s, i) => ({ rank: i + 1, ...s }));
            return structured({ scope, value: value ?? null, semester: semester ?? null, ranked: scored.length, ranking });
        }
    );

    // ── update_grade (elicitation) ─────────────────────────────────────
    server.registerTool(
        'update_grade',
        {
            title: 'Update a grade',
            description:
                'Insert or correct one grade row. Pass ONLY the scores the user wants to change — an omitted score keeps its ' +
                'current value (both are required only for a brand-new grade). The server ALWAYS asks the end user to confirm. ' +
                'Changes are kept in memory for this server run only; the CSV file is never modified.',
            inputSchema: z.object({
                student_id: studentId,
                course_id: z.string().describe('Course ID, e.g. "CS201"'),
                semester,
                process_score: score('New process score').optional(),
                final_score: score('New final exam score').optional()
            }),
            annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
        },
        async ({ student_id, course_id, semester, process_score: newProcess, final_score: newFinal }, ctx): Promise<CallToolResult | InputRequiredResult> => {
            const student = findStudent(student_id);
            if (!student) return notFound(student_id);
            const course = data.courses.get(course_id);
            if (!course) return fail(`Unknown course "${course_id}". Known courses: ${[...data.courses.keys()].join(', ')}.`);
            if (newProcess === undefined && newFinal === undefined) return fail('Nothing to change: pass process_score and/or final_score.');

            const previous = data.grades.find(g => g.student_id === student.student_id && g.course_id === course_id && g.semester === semester);
            const process_score = newProcess ?? previous?.process_score;
            const final_score = newFinal ?? previous?.final_score;
            if (process_score === undefined || final_score === undefined) {
                return fail(`${student.student_id} has no ${course_id} grade in ${semester} yet, so both process_score and final_score are required.`);
            }
            const next = data.grading.grade(course_id, semester, course.credits, process_score, final_score);
            const before = previous ? `currently process ${previous.process_score}, final ${previous.final_score}` : 'no existing grade';
            const message =
                `Update ${course.course_name} (${course_id}, ${semester}) for ${student.full_name} (${student.student_id})? ` +
                `New: process ${process_score}, final ${final_score} → total ${next.total} (${next.letter}). Before: ${before}.`;

            let answer;
            try {
                answer = await confirmWithUser(era, ctx, 'confirm_update', message);
            } catch (error) {
                return fail(`Cannot ask the user for confirmation (${String(error)}). The grade was NOT changed.`);
            }
            if (answer.kind === 'pending') return answer.result;
            if (!answer.confirmed) {
                const why = { accept: 'did not tick confirm', decline: 'declined', cancel: 'cancelled the dialog' }[answer.action];
                return text(`The user ${why} — the grade was NOT changed.`);
            }

            const gpaBefore = data.gpaOf(student.student_id).gpa;
            const outcome = data.upsertGrade({ student_id: student.student_id, course_id, semester, process_score, final_score });
            const gpaAfter = data.gpaOf(student.student_id).gpa;
            return text(`Grade ${outcome}: ${course_id} ${semester} → total ${next.total} (${next.letter}). Cumulative GPA ${gpaBefore} → ${gpaAfter}.`);
        }
    );

    // ── generate_student_feedback (sampling) ───────────────────────────
    server.registerTool(
        'generate_student_feedback',
        {
            title: 'Generate student feedback',
            description:
                "Write a short personalised feedback paragraph for a student from their transcript. The server borrows the host's LLM (MCP sampling) to write it.",
            inputSchema: z.object({
                student_id: studentId,
                tone: z.enum(['encouraging', 'formal']).default('encouraging').describe('Writing tone')
            }),
            annotations: READ_ONLY
        },
        async ({ student_id, tone }, ctx): Promise<CallToolResult | InputRequiredResult> => {
            const student = findStudent(student_id);
            if (!student) return notFound(student_id);
            const courses = data.gradedCourses(student.student_id);
            const summary = data.gpaOf(student.student_id);
            const lines = courses.map(c => `- ${data.courses.get(c.course_id)!.course_name} (${c.semester}): ${c.total} → ${c.letter}`);
            const prompt =
                `Write a ${tone} feedback paragraph (max 120 words, English) for student ${student.full_name}.\n` +
                `Cumulative GPA: ${summary.gpa} (${summary.classification}), credits earned ${summary.credits_earned}/${summary.credits_attempted}.\n` +
                `Courses:\n${lines.join('\n')}\nMention one strength, one area to improve, and one concrete next step.`;

            let answer;
            try {
                answer = await askHostModel(era, ctx, 'feedback', prompt, { systemPrompt: 'You are a supportive academic advisor.', maxTokens: 400 });
            } catch (error) {
                return fail(`The host did not provide an LLM for sampling (${String(error)}).`);
            }
            if (answer.kind === 'pending') return answer.result;
            return text(`Feedback for ${student.full_name} (written by ${answer.model}):\n\n${answer.text}`);
        }
    );

    // ── Generic CSV tools ──────────────────────────────────────────────
    server.registerTool(
        'list_tables',
        {
            title: 'List data tables',
            description: 'List every CSV table the server loaded, with row counts and column names.',
            outputSchema: z.object({ tables: z.array(z.object({ table: z.string(), rows: z.number(), columns: z.array(z.string()) })) }),
            annotations: READ_ONLY
        },
        async () => structured({ tables: [...data.tables].map(([table, t]) => ({ table, rows: t.rows.length, columns: t.headers })) })
    );

    server.registerTool(
        'describe_table',
        {
            title: 'Describe a table',
            description: 'Column-by-column profile of one table: non-empty count, distinct values, numeric min/max and sample values.',
            inputSchema: z.object({ table: z.string().describe('Table name from list_tables, e.g. "grades"') }),
            annotations: READ_ONLY
        },
        async ({ table }) => {
            const t = data.tables.get(table);
            if (!t) return fail(`Unknown table "${table}". Known tables: ${[...data.tables.keys()].join(', ')}.`);
            const columns = t.headers.map(column => {
                const values = t.rows.map(r => r[column]).filter(v => v !== '');
                const numbers = values.map(Number).filter(n => !Number.isNaN(n));
                const numeric = values.length > 0 && numbers.length === values.length;
                return {
                    column,
                    non_empty: values.length,
                    distinct: new Set(values).size,
                    ...(numeric ? { min: Math.min(...numbers), max: Math.max(...numbers) } : {}),
                    samples: [...new Set(values)].slice(0, 3)
                };
            });
            return structured({ table, rows: t.rows.length, columns });
        }
    );

    server.registerTool(
        'query_table',
        {
            title: 'Query a table',
            description: 'Filter rows of any table. Filters are AND-ed. Numeric operators (gt/gte/lt/lte) compare numbers; "contains" is accent-insensitive.',
            inputSchema: z.object({
                table: z.string().describe('Table name from list_tables'),
                filters: z
                    .array(
                        z.object({
                            column: z.string(),
                            operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains']),
                            value: z.string().describe('Value to compare with (as text; numbers are parsed for gt/gte/lt/lte)')
                        })
                    )
                    .default([]),
                columns: z.array(z.string()).optional().describe('Columns to return; omit for all'),
                limit: z.number().int().min(1).max(100).default(20)
            }),
            annotations: READ_ONLY
        },
        async ({ table, filters, columns, limit }, ctx) => {
            const t = data.tables.get(table);
            if (!t) return fail(`Unknown table "${table}". Known tables: ${[...data.tables.keys()].join(', ')}.`);
            const unknown = [...filters.map(f => f.column), ...(columns ?? [])].filter(c => !t.headers.includes(c));
            if (unknown.length) return fail(`Unknown column(s) ${unknown.join(', ')} in "${table}". Columns: ${t.headers.join(', ')}.`);

            const test = (cell: string, op: string, value: string): boolean => {
                if (op === 'eq') return cell === value;
                if (op === 'ne') return cell !== value;
                if (op === 'contains') return fold(cell).includes(fold(value));
                const [a, b] = [Number(cell), Number(value)];
                if (cell === '' || Number.isNaN(a) || Number.isNaN(b)) return false;
                return op === 'gt' ? a > b : op === 'gte' ? a >= b : op === 'lt' ? a < b : a <= b;
            };
            const matches = t.rows.filter(row => filters.every(f => test(row[f.column], f.operator, f.value)));
            await ctx.mcpReq.log('info', `query_table ${table}: ${matches.length} of ${t.rows.length} rows match`);
            const rows = matches.slice(0, limit).map(row => (columns ? Object.fromEntries(columns.map(c => [c, row[c]])) : row));
            return structured({ table, total_matches: matches.length, returned: rows.length, rows });
        }
    );
}
