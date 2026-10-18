/**
 * Tools of the `academic` server — actions the LLM decides to call.
 *
 *   Domain tools : search_students, get_transcript, calculate_gpa, class_statistics,
 *                  rank_students, update_grade (elicitation), generate_student_feedback (sampling)
 *   Generic tools: list_tables, describe_table, query_table — work on ANY CSV, so the
 *                  server still works if the team switches to another dataset.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { CallToolResult, InputRequiredResult, McpServer, ProtocolEra } from '@modelcontextprotocol/server';
import * as z from 'zod';

import { PROJECT_ROOT } from '../../lib/env';
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

    // ── Hoàng's Phase 2 Tools ──────────────────────────────────────────

    function getAcademicRules() {
        try {
            return JSON.parse(readFileSync(path.join(PROJECT_ROOT, 'config/academic-rules.json'), 'utf8'));
        } catch {
            return {
                attendance: { maxAbsenceRatio: 0.20, countedStatuses: ['absent'] },
                conduct: {
                    grades: [
                        { label: 'Excellent', minScore: 90 },
                        { label: 'Good', minScore: 80 },
                        { label: 'Fairly good', minScore: 65 },
                        { label: 'Average', minScore: 50 },
                        { label: 'Weak', minScore: 0 }
                    ]
                },
                atRisk: { lowGpaThreshold: 2.0, highAbsenceRatio: 0.20, lowConductScore: 50 }
            };
        }
    }

    // ── attendance_summary ─────────────────────────────────────────────
    server.registerTool(
        'attendance_summary',
        {
            title: 'Attendance summary',
            description:
                'Summary of attendance for a student (across all or one semester) or for a specific course section. ' +
                'Calculates total sessions, presents, absences, lates, excused, absence rate, and whether student is banned from exam (>20% absences).',
            inputSchema: z.object({
                student_id: z.string().optional().describe('Student ID, e.g. "2201001"'),
                section_id: z.string().optional().describe('Section ID, e.g. "SEC001"'),
                semester: semester.optional()
            }),
            outputSchema: z.object({
                student_id: z.string().optional(),
                section_id: z.string().optional(),
                semester: z.string().optional(),
                total_sessions: z.number(),
                present: z.number(),
                absent: z.number(),
                late: z.number(),
                excused: z.number(),
                absence_rate_pct: z.number(),
                banned_from_exam: z.boolean().describe('True if absence rate exceeds the configured maximum allowable threshold (e.g. 20%)')
            }),
            annotations: READ_ONLY
        },
        async ({ student_id, section_id, semester: sem }) => {
            if (!student_id && !section_id) return fail('Must specify at least student_id or section_id.');
            if (student_id && !findStudent(student_id)) return notFound(student_id);

            const attendanceTable = data.tables.get('attendance');
            if (!attendanceTable) return fail('attendance.csv not found in dataset. Run: npm run data:sample');

            const sectionTable = data.tables.get('sections');

            let rows = attendanceTable.rows;
            if (student_id) rows = rows.filter(r => r['student_id'] === student_id);
            if (section_id) rows = rows.filter(r => r['section_id'] === section_id);

            if (sem && sectionTable) {
                const validSectionIds = new Set(sectionTable.rows.filter(s => s['semester'] === sem).map(s => s['section_id']));
                rows = rows.filter(r => validSectionIds.has(r['section_id']));
            }

            if (rows.length === 0) {
                return fail(`No attendance records found for ${student_id ? `student ${student_id}` : ''} ${section_id ? `section ${section_id}` : ''}${sem ? ` in semester ${sem}` : ''}.`);
            }

            const present = rows.filter(r => r['status'] === 'present').length;
            const absent = rows.filter(r => r['status'] === 'absent').length;
            const late = rows.filter(r => r['status'] === 'late').length;
            const excused = rows.filter(r => r['status'] === 'excused').length;
            const total = rows.length;

            const rules = getAcademicRules();
            const absenceRate = total > 0 ? Math.round((absent / total) * 1000) / 10 : 0;
            const maxAbsenceRatio = rules.attendance?.maxAbsenceRatio ?? 0.20;
            const banned = (absent / total) > maxAbsenceRatio;

            return structured({
                student_id,
                section_id,
                semester: sem,
                total_sessions: total,
                present,
                absent,
                late,
                excused,
                absence_rate_pct: absenceRate,
                banned_from_exam: banned
            });
        }
    );

    // ── conduct_score ──────────────────────────────────────────────────
    server.registerTool(
        'conduct_score',
        {
            title: 'Conduct score',
            description:
                'Returns the behavioural and extracurricular conduct score and classification for a student (0–100 scale). ' +
                'Classified into: Excellent(≥90), Good(≥80), Fairly good(≥65), Average(≥50), Weak(<50).',
            inputSchema: z.object({
                student_id: studentId,
                semester: semester.optional()
            }),
            outputSchema: z.object({
                student_id: z.string(),
                full_name: z.string(),
                class_id: z.string(),
                records: z.array(
                    z.object({
                        semester: z.string(),
                        score: z.number(),
                        grade: z.string()
                    })
                ),
                average_score: z.number()
            }),
            annotations: READ_ONLY
        },
        async ({ student_id, semester: sem }) => {
            const student = findStudent(student_id);
            if (!student) return notFound(student_id);

            const conductTable = data.tables.get('conduct');
            if (!conductTable) return fail('conduct.csv not found in dataset. Run: npm run data:sample');

            const rows = conductTable.rows.filter(
                r => r['student_id'] === student_id && (!sem || r['semester'] === sem)
            );

            if (rows.length === 0) return fail(`No conduct records for student ${student_id}${sem ? ` in semester ${sem}` : ''}.`);

            const rules = getAcademicRules();
            const gradesList: { label: string; minScore: number }[] = rules.conduct?.grades ?? [
                { label: 'Excellent', minScore: 90 },
                { label: 'Good', minScore: 80 },
                { label: 'Fairly good', minScore: 65 },
                { label: 'Average', minScore: 50 },
                { label: 'Weak', minScore: 0 }
            ];

            const records = rows.map(r => {
                const sc = Number(r['score']);
                const foundGrade = gradesList.find(g => sc >= g.minScore)?.label ?? 'Weak';
                return {
                    semester: r['semester'],
                    score: sc,
                    grade: foundGrade
                };
            });

            const avgScore = Math.round((records.reduce((acc, cur) => acc + cur.score, 0) / records.length) * 10) / 10;

            return structured({
                student_id: student.student_id,
                full_name: student.full_name,
                class_id: student.class_id,
                records,
                average_score: avgScore
            });
        }
    );

    // ── at_risk_students ───────────────────────────────────────────────
    server.registerTool(
        'at_risk_students',
        {
            title: 'At risk students identification',
            description:
                'Identifies students at risk of academic probation or failure based on multiple criteria: ' +
                'low cumulative/semester GPA (< 2.0), high absence rate (> 20%), or poor conduct score (< 50). ' +
                'Filters by class_id or faculty, optionally for a specific semester.',
            inputSchema: z.object({
                class_id: z.string().optional().describe('Class ID, e.g. "IT01"'),
                faculty: z.string().optional().describe('Faculty name, e.g. "Information Technology"'),
                semester: semester.optional()
            }),
            outputSchema: z.object({
                filter: z.object({ class_id: z.string().optional(), faculty: z.string().optional(), semester: z.string().optional() }),
                total_evaluated: z.number(),
                at_risk_count: z.number(),
                students: z.array(
                    z.object({
                        student_id: z.string(),
                        full_name: z.string(),
                        class_id: z.string(),
                        gpa: z.number().nullable(),
                        absence_rate_pct: z.number(),
                        conduct_score: z.number().nullable(),
                        reasons: z.array(z.string())
                    })
                )
            }),
            annotations: READ_ONLY
        },
        async ({ class_id, faculty, semester: sem }) => {
            let candidateStudents = [...data.students.values()];
            if (class_id) candidateStudents = candidateStudents.filter(s => s.class_id.toLowerCase() === class_id.toLowerCase());
            if (faculty) candidateStudents = candidateStudents.filter(s => s.faculty.toLowerCase() === faculty.toLowerCase());

            if (candidateStudents.length === 0) {
                return fail(`No students found matching class="${class_id ?? ''}", faculty="${faculty ?? ''}".`);
            }

            const rules = getAcademicRules();
            const lowGpaThreshold = rules.atRisk?.lowGpaThreshold ?? 2.0;
            const highAbsenceRatio = rules.atRisk?.highAbsenceRatio ?? 0.20;
            const lowConductScore = rules.atRisk?.lowConductScore ?? 50;

            const attendanceTable = data.tables.get('attendance');
            const conductTable = data.tables.get('conduct');
            const sectionTable = data.tables.get('sections');

            const validSectionIds = sem && sectionTable
                ? new Set(sectionTable.rows.filter(s => s['semester'] === sem).map(s => s['section_id']))
                : undefined;

            const atRiskList = [];

            for (const st of candidateStudents) {
                const reasons: string[] = [];
                const gpaSummary = data.gpaOf(st.student_id, sem);
                const gpa = gpaSummary.gpa;

                if (gpa !== null && gpa < lowGpaThreshold) {
                    reasons.push(`Low GPA: ${gpa.toFixed(2)} (< ${lowGpaThreshold})`);
                }

                // Attendance
                let absenceRate = 0;
                if (attendanceTable) {
                    let attRows = attendanceTable.rows.filter(r => r['student_id'] === st.student_id);
                    if (validSectionIds) {
                        attRows = attRows.filter(r => validSectionIds.has(r['section_id']));
                    }
                    if (attRows.length > 0) {
                        const absCount = attRows.filter(r => r['status'] === 'absent').length;
                        const ratio = absCount / attRows.length;
                        absenceRate = Math.round(ratio * 1000) / 10;
                        if (ratio > highAbsenceRatio) {
                            reasons.push(`High absence rate: ${absenceRate}% (> ${(highAbsenceRatio * 100).toFixed(0)}%)`);
                        }
                    }
                }

                // Conduct
                let condScore: number | null = null;
                if (conductTable) {
                    const cRows = conductTable.rows.filter(
                        r => r['student_id'] === st.student_id && (!sem || r['semester'] === sem)
                    );
                    if (cRows.length > 0) {
                        condScore = Math.round((cRows.reduce((acc, cur) => acc + Number(cur['score']), 0) / cRows.length) * 10) / 10;
                        if (condScore < lowConductScore) {
                            reasons.push(`Poor conduct score: ${condScore} (< ${lowConductScore})`);
                        }
                    }
                }

                if (reasons.length > 0) {
                    atRiskList.push({
                        student_id: st.student_id,
                        full_name: st.full_name,
                        class_id: st.class_id,
                        gpa,
                        absence_rate_pct: absenceRate,
                        conduct_score: condScore,
                        reasons
                    });
                }
            }

            return structured({
                filter: { class_id, faculty, semester: sem },
                total_evaluated: candidateStudents.length,
                at_risk_count: atRiskList.length,
                students: atRiskList
            });
        }
    );

    // ── Phú's Phase 2 Tools ────────────────────────────────────────────

    const teacherId = z.string().describe('Teacher ID, e.g. "T001"');

    // ── search_teachers ────────────────────────────────────────────────
    server.registerTool(
        'search_teachers',
        {
            title: 'Search teachers',
            description:
                'Search teachers by keyword (name, ID, or email, accent- and case-insensitive), ' +
                'optionally filtered by faculty or academic title.',
            inputSchema: z.object({
                keyword: z.string().optional().describe('Part of name, ID or email, e.g. "Lan" or "T001"'),
                faculty: z.string().optional().describe('Faculty name, e.g. "Information Technology"'),
                title: z.string().optional().describe('Academic title, e.g. "Lecturer" or "Associate Professor"'),
                limit: z.number().int().min(1).max(50).default(20).describe('Maximum number of teachers to return')
            }),
            outputSchema: z.object({
                total_matches: z.number(),
                returned: z.number(),
                teachers: z.array(
                    z.object({
                        teacher_id: z.string(),
                        full_name: z.string(),
                        faculty: z.string(),
                        title: z.string(),
                        degree: z.string(),
                        email: z.string()
                    })
                )
            }),
            annotations: READ_ONLY
        },
        async ({ keyword, faculty, title, limit }) => {
            const needle = keyword ? fold(keyword) : undefined;
            const matches = [...data.teachers.values()].filter(t => {
                if (needle && !fold(t.full_name).includes(needle) && !fold(t.teacher_id).includes(needle) && !fold(t.email).includes(needle)) {
                    return false;
                }
                if (faculty && t.faculty.toLowerCase() !== faculty.toLowerCase()) return false;
                if (title && t.title.toLowerCase() !== title.toLowerCase()) return false;
                return true;
            });

            const returned = matches.slice(0, limit).map(t => ({
                teacher_id: t.teacher_id,
                full_name: t.full_name,
                faculty: t.faculty,
                title: t.title,
                degree: t.degree,
                email: t.email
            }));

            return structured({ total_matches: matches.length, returned: returned.length, teachers: returned });
        }
    );

    // ── class_timetable ────────────────────────────────────────────────
    server.registerTool(
        'class_timetable',
        {
            title: 'Class timetable',
            description: 'Returns the weekly timetable/schedule of course sections for a class in a given semester.',
            inputSchema: z.object({
                class_id: z.string().describe('Class ID, e.g. "IT01"'),
                semester: semester
            }),
            outputSchema: z.object({
                class_id: z.string(),
                semester: z.string(),
                total_sections: z.number(),
                schedule: z.array(
                    z.object({
                        section_id: z.string(),
                        course_id: z.string(),
                        course_name: z.string(),
                        teacher_id: z.string(),
                        teacher_name: z.string(),
                        room: z.string(),
                        weekday: z.string(),
                        start_period: z.number(),
                        periods: z.number()
                    })
                )
            }),
            annotations: READ_ONLY
        },
        async ({ class_id, semester: sem }) => {
            const sectionsForClass = [...data.sections.values()].filter(
                s => s.class_id.toLowerCase() === class_id.toLowerCase() && s.semester === sem
            );

            if (sectionsForClass.length === 0) {
                return fail(`No schedule found for class "${class_id}" in semester "${sem}".`);
            }

            const dayOrder: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

            const schedule = sectionsForClass
                .sort((a, b) => (dayOrder[a.weekday] ?? 99) - (dayOrder[b.weekday] ?? 99) || a.start_period - b.start_period)
                .map(s => {
                    const course = data.courses.get(s.course_id);
                    const teacher = data.teachers.get(s.teacher_id);
                    return {
                        section_id: s.section_id,
                        course_id: s.course_id,
                        course_name: course ? course.course_name : s.course_id,
                        teacher_id: s.teacher_id,
                        teacher_name: teacher ? teacher.full_name : s.teacher_id,
                        room: s.room,
                        weekday: s.weekday,
                        start_period: s.start_period,
                        periods: s.periods
                    };
                });

            return structured({
                class_id: class_id.toUpperCase(),
                semester: sem,
                total_sections: schedule.length,
                schedule
            });
        }
    );

    // ── teacher_workload ───────────────────────────────────────────────
    server.registerTool(
        'teacher_workload',
        {
            title: 'Teacher workload',
            description:
                'Computes the teaching workload (number of assigned sections, courses, and total weekly teaching periods) ' +
                'for a teacher in a specified semester.',
            inputSchema: z.object({
                teacher_id: teacherId,
                semester: semester
            }),
            outputSchema: z.object({
                teacher_id: z.string(),
                full_name: z.string(),
                title: z.string(),
                faculty: z.string(),
                semester: z.string(),
                total_sections: z.number(),
                total_periods_per_week: z.number(),
                sections: z.array(
                    z.object({
                        section_id: z.string(),
                        course_id: z.string(),
                        course_name: z.string(),
                        class_id: z.string(),
                        weekday: z.string(),
                        start_period: z.number(),
                        periods: z.number(),
                        room: z.string()
                    })
                )
            }),
            annotations: READ_ONLY
        },
        async ({ teacher_id, semester: sem }) => {
            const teacher = data.teachers.get(teacher_id.trim());
            if (!teacher) return fail(`Teacher with teacher_id "${teacher_id}" not found.`);

            const assigned = [...data.sections.values()].filter(
                s => s.teacher_id === teacher.teacher_id && s.semester === sem
            );

            const totalPeriods = assigned.reduce((sum, s) => sum + s.periods, 0);

            const sectionDetails = assigned.map(s => {
                const course = data.courses.get(s.course_id);
                return {
                    section_id: s.section_id,
                    course_id: s.course_id,
                    course_name: course ? course.course_name : s.course_id,
                    class_id: s.class_id,
                    weekday: s.weekday,
                    start_period: s.start_period,
                    periods: s.periods,
                    room: s.room
                };
            });

            return structured({
                teacher_id: teacher.teacher_id,
                full_name: teacher.full_name,
                title: teacher.title,
                faculty: teacher.faculty,
                semester: sem,
                total_sections: assigned.length,
                total_periods_per_week: totalPeriods,
                sections: sectionDetails
            });
        }
    );

    // ── teacher_grade_report ───────────────────────────────────────────
    server.registerTool(
        'teacher_grade_report',
        {
            title: 'Teacher grade report',
            description:
                'Calculates grade metrics for courses/sections taught by a teacher: ' +
                'number of students graded, average score (10-point scale), pass rate, and grade breakdown. ' +
                'Optionally filtered by semester.',
            inputSchema: z.object({
                teacher_id: teacherId,
                semester: semester.optional()
            }),
            outputSchema: z.object({
                teacher_id: z.string(),
                full_name: z.string(),
                faculty: z.string(),
                semester: z.string().optional(),
                sections_taught: z.number(),
                students_graded: z.number(),
                overall_average_score: z.number().nullable(),
                overall_pass_rate_pct: z.number().nullable(),
                by_section: z.array(
                    z.object({
                        section_id: z.string(),
                        course_id: z.string(),
                        course_name: z.string(),
                        class_id: z.string(),
                        semester: z.string(),
                        students_count: z.number(),
                        average_score: z.number(),
                        pass_rate_pct: z.number()
                    })
                )
            }),
            annotations: READ_ONLY
        },
        async ({ teacher_id, semester: sem }) => {
            const teacher = data.teachers.get(teacher_id.trim());
            if (!teacher) return fail(`Teacher with teacher_id "${teacher_id}" not found.`);

            let assigned = [...data.sections.values()].filter(s => s.teacher_id === teacher.teacher_id);
            if (sem) assigned = assigned.filter(s => s.semester === sem);

            if (assigned.length === 0) {
                return fail(`No sections found for teacher "${teacher_id}"${sem ? ` in semester ${sem}` : ''}.`);
            }

            const bySection = [];
            let totalStudents = 0;
            let sumTotalScores = 0;
            let totalPassCount = 0;

            for (const s of assigned) {
                // Students belonging to class enrolled in course & semester
                const classStudentIds = new Set(
                    [...data.students.values()].filter(st => st.class_id === s.class_id).map(st => st.student_id)
                );
                const sectionGrades = data.grades.filter(
                    g => g.course_id === s.course_id && g.semester === s.semester && classStudentIds.has(g.student_id)
                );

                const course = data.courses.get(s.course_id);
                if (sectionGrades.length === 0) {
                    bySection.push({
                        section_id: s.section_id,
                        course_id: s.course_id,
                        course_name: course ? course.course_name : s.course_id,
                        class_id: s.class_id,
                        semester: s.semester,
                        students_count: 0,
                        average_score: 0,
                        pass_rate_pct: 0
                    });
                    continue;
                }

                const totals = sectionGrades.map(g => Math.round((g.process_score * 0.4 + g.final_score * 0.6) * 10) / 10);
                const secAvg = Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10;
                const passCount = totals.filter(t => t >= 4.0).length;
                const passRate = Math.round((passCount / totals.length) * 1000) / 10;

                totalStudents += totals.length;
                sumTotalScores += totals.reduce((a, b) => a + b, 0);
                totalPassCount += passCount;

                bySection.push({
                    section_id: s.section_id,
                    course_id: s.course_id,
                    course_name: course ? course.course_name : s.course_id,
                    class_id: s.class_id,
                    semester: s.semester,
                    students_count: totals.length,
                    average_score: secAvg,
                    pass_rate_pct: passRate
                });
            }

            const overallAvg = totalStudents > 0 ? Math.round((sumTotalScores / totalStudents) * 10) / 10 : null;
            const overallPassRate = totalStudents > 0 ? Math.round((totalPassCount / totalStudents) * 1000) / 10 : null;

            return structured({
                teacher_id: teacher.teacher_id,
                full_name: teacher.full_name,
                faculty: teacher.faculty,
                semester: sem,
                sections_taught: assigned.length,
                students_graded: totalStudents,
                overall_average_score: overallAvg,
                overall_pass_rate_pct: overallPassRate,
                by_section: bySection
            });
        }
    );
}

