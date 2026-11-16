/**
 * The `finance` server — tuition, scholarships and lecturer pay (FAKE amounts).
 * Kept apart from `academic` on purpose: a host that should not see money matters simply does not
 * connect it (least privilege). Every tool is read-only, and every decision is computed in code.
 *
 *   tuition_status                 amount due / paid / outstanding per semester
 *   check_scholarship_eligibility  each condition checked, with required vs actual values
 *   rank_scholarship_candidates    eligible students of a faculty, best first, within the slots
 *   calculate_teacher_pay          base + teaching periods + overtime + bonus − deductions
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { type McpRequestContext, McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';

import { parseCsv } from '../../lib/csv';
import { PROJECT_ROOT } from '../../lib/env';
import { fail, fold, structured } from '../../lib/results';
import { getAcademicData } from '../academic/data';

interface FinanceConfig {
    dataDir: string;
    tables: { tuition: string; scholarships: string; payroll: string };
    currency: string;
    scholarshipRules: { requireNoFailedCourse: boolean; requireTuitionPaid: boolean };
    teachingRatePerPeriod: Record<string, number>;
    overtimeRatePerPeriod: number;
    semesterMonths: Record<string, string[]>;
}

const config = JSON.parse(readFileSync(path.join(PROJECT_ROOT, 'config/finance.json'), 'utf8')) as FinanceConfig;
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
const semester = z
    .string()
    .regex(/^\d{4}-\d$/, 'Semester must look like 2025-1')
    .describe('Semester code "YYYY-N", e.g. "2025-1"');

type Row = Record<string, string>;
let tables: Map<string, Row[]> | undefined;
/** Finance CSVs, loaded once per process. */
function financeTables(): Map<string, Row[]> {
    if (!tables) {
        const dir = path.resolve(PROJECT_ROOT, process.env.FINANCE_DATA_DIR ?? config.dataDir);
        tables = new Map(readdirSync(dir).filter(f => f.endsWith('.csv')).map(f => [path.basename(f, '.csv'), parseCsv(readFileSync(path.join(dir, f), 'utf8')).rows]));
    }
    return tables;
}
const rows = (name: keyof FinanceConfig['tables']) => financeTables().get(path.basename(config.tables[name], '.csv')) ?? [];

/** Tuition of one student in one semester (undefined when there is no row). */
function tuitionOf(studentId: string, sem: string) {
    const r = rows('tuition').find(t => t.student_id === studentId && t.semester === sem);
    if (!r) return undefined;
    const amount_due = Number(r.amount_due);
    const amount_paid = Number(r.amount_paid);
    return {
        semester: sem,
        credits_registered: Number(r.credits_registered),
        fee_per_credit: Number(r.fee_per_credit),
        discount_pct: Number(r.discount_pct),
        amount_due,
        amount_paid,
        outstanding: amount_due - amount_paid,
        due_date: r.due_date,
        paid_in_full: amount_paid >= amount_due
    };
}

/** Every scholarship condition for one student, computed in code (the LLM only reports it). */
function eligibility(studentId: string, sem: string, scholarship: Row) {
    const data = getAcademicData();
    const gpa = data.gpaOf(studentId, sem).gpa;
    const conduct = data.conductOf(studentId, sem).score;
    const failed = data.gradedCourses(studentId, sem).filter(c => !c.passed).map(c => c.course_id);
    const tuition = tuitionOf(studentId, sem);
    const conditions = [
        { condition: 'semester GPA', required: `≥ ${scholarship.min_gpa}`, actual: String(gpa ?? 'no grades'), ok: gpa !== null && gpa >= Number(scholarship.min_gpa) },
        { condition: 'conduct score', required: `≥ ${scholarship.min_conduct}`, actual: String(conduct ?? 'no score'), ok: conduct !== null && conduct >= Number(scholarship.min_conduct) }
    ];
    if (config.scholarshipRules.requireNoFailedCourse) {
        conditions.push({ condition: 'no failed course in the semester', required: '0 F', actual: failed.length ? `F in ${failed.join(', ')}` : '0 F', ok: failed.length === 0 });
    }
    if (config.scholarshipRules.requireTuitionPaid) {
        conditions.push({
            condition: 'tuition paid in full',
            required: 'outstanding = 0',
            actual: tuition ? `outstanding ${tuition.outstanding.toLocaleString('en-US')} ${config.currency}` : 'no tuition record',
            ok: !!tuition?.paid_in_full
        });
    }
    return { scholarship_id: scholarship.scholarship_id, name: scholarship.name, amount: Number(scholarship.amount), eligible: conditions.every(c => c.ok), gpa, conduct, conditions };
}

export function createFinanceServer(_ctx: McpRequestContext): McpServer {
    const data = getAcademicData();
    const server = new McpServer(
        { name: 'finance', title: 'Finance (tuition, scholarships, payroll)', version: '1.0.0' },
        {
            instructions:
                `Finance server. Amounts are in ${config.currency} and are FAKE demo data. Scholarship eligibility and pay are computed by the tools — ` +
                'report their numbers, never estimate them. Semesters look like "2025-1"; payroll months look like "2025-10".'
        }
    );
    const findStudent = (id: string) => data.students.get(id.trim());
    const noStudent = (id: string) => fail(`No student with student_id "${id}".`);
    const scholarshipById = (id: string) => rows('scholarships').find(s => s.scholarship_id.toLowerCase() === id.trim().toLowerCase());
    const knownScholarships = () => rows('scholarships').map(s => `${s.scholarship_id} (${s.name})`).join(', ');

    server.registerTool(
        'tuition_status',
        {
            title: 'Tuition status',
            description: 'Tuition of one student: amount due, paid and outstanding per semester (all semesters when semester is omitted).',
            inputSchema: z.object({ student_id: z.string().describe('Student ID, e.g. "2201001"'), semester: semester.optional() }),
            outputSchema: z.object({
                student_id: z.string(),
                full_name: z.string(),
                currency: z.string(),
                semesters: z.array(
                    z.object({
                        semester: z.string(),
                        credits_registered: z.number(),
                        fee_per_credit: z.number(),
                        discount_pct: z.number(),
                        amount_due: z.number(),
                        amount_paid: z.number(),
                        outstanding: z.number(),
                        due_date: z.string(),
                        paid_in_full: z.boolean()
                    })
                ),
                total_outstanding: z.number()
            }),
            annotations: READ_ONLY
        },
        async ({ student_id, semester: sem }) => {
            const student = findStudent(student_id);
            if (!student) return noStudent(student_id);
            const semesters = [...new Set(rows('tuition').filter(t => t.student_id === student.student_id).map(t => t.semester))]
                .filter(s => !sem || s === sem)
                .sort()
                .map(s => tuitionOf(student.student_id, s)!);
            if (sem && semesters.length === 0) return fail(`No tuition record for ${student.student_id} in ${sem}.`);
            return structured({ student_id: student.student_id, full_name: student.full_name, currency: config.currency, semesters, total_outstanding: semesters.reduce((a, s) => a + s.outstanding, 0) });
        }
    );

    const conditionSchema = z.object({ condition: z.string(), required: z.string(), actual: z.string(), ok: z.boolean() });
    server.registerTool(
        'check_scholarship_eligibility',
        {
            title: 'Check scholarship eligibility',
            description:
                'Check whether a student qualifies for a scholarship in a semester. Every condition (semester GPA, conduct, no failed course, tuition paid) ' +
                'is checked in code and returned with the required and actual value. Omit scholarship_id to check all scholarships.',
            inputSchema: z.object({
                student_id: z.string().describe('Student ID, e.g. "2201001"'),
                semester,
                scholarship_id: z.string().optional().describe('e.g. "MERIT-A"; omit for all')
            }),
            outputSchema: z.object({
                student_id: z.string(),
                full_name: z.string(),
                semester: z.string(),
                results: z.array(z.object({ scholarship_id: z.string(), name: z.string(), amount: z.number(), eligible: z.boolean(), gpa: z.number().nullable(), conduct: z.number().nullable(), conditions: z.array(conditionSchema) }))
            }),
            annotations: READ_ONLY
        },
        async ({ student_id, semester: sem, scholarship_id }) => {
            const student = findStudent(student_id);
            if (!student) return noStudent(student_id);
            if (!data.semesters().includes(sem)) return fail(`No data for semester "${sem}". Known semesters: ${data.semesters().join(', ')}.`);
            const chosen = scholarship_id ? [scholarshipById(scholarship_id)].filter((s): s is Row => !!s) : rows('scholarships');
            if (chosen.length === 0) return fail(`Unknown scholarship "${scholarship_id}". Known: ${knownScholarships()}.`);
            return structured({ student_id: student.student_id, full_name: student.full_name, semester: sem, results: chosen.map(s => eligibility(student.student_id, sem, s)) });
        }
    );

    server.registerTool(
        'rank_scholarship_candidates',
        {
            title: 'Rank scholarship candidates',
            description:
                'Eligible students of one faculty for one scholarship in a semester, ranked by semester GPA then conduct. ' +
                'Returns the winners (up to the slots per faculty) and how many students were eligible.',
            inputSchema: z.object({
                faculty: z.string().describe('Faculty, e.g. "Information Technology"'),
                semester,
                scholarship_id: z.string().describe('e.g. "MERIT-A"')
            }),
            outputSchema: z.object({
                faculty: z.string(),
                semester: z.string(),
                scholarship_id: z.string(),
                slots: z.number(),
                eligible_count: z.number(),
                winners: z.array(z.object({ rank: z.number(), student_id: z.string(), full_name: z.string(), class_id: z.string(), gpa: z.number().nullable(), conduct: z.number().nullable() }))
            }),
            annotations: READ_ONLY
        },
        async ({ faculty, semester: sem, scholarship_id }) => {
            const scholarship = scholarshipById(scholarship_id);
            if (!scholarship) return fail(`Unknown scholarship "${scholarship_id}". Known: ${knownScholarships()}.`);
            const pool = [...data.students.values()].filter(s => fold(s.faculty).includes(fold(faculty)));
            if (pool.length === 0) return fail(`Unknown faculty "${faculty}". Known: ${data.faculties().join(', ')}.`);
            if (!data.semesters().includes(sem)) return fail(`No data for semester "${sem}". Known semesters: ${data.semesters().join(', ')}.`);
            const eligible = pool
                .map(s => ({ s, e: eligibility(s.student_id, sem, scholarship) }))
                .filter(x => x.e.eligible)
                .sort((a, b) => b.e.gpa! - a.e.gpa! || b.e.conduct! - a.e.conduct!);
            const slots = Number(scholarship.slots_per_faculty);
            return structured({
                faculty: pool[0].faculty,
                semester: sem,
                scholarship_id: scholarship.scholarship_id,
                slots,
                eligible_count: eligible.length,
                winners: eligible.slice(0, slots).map((x, i) => ({ rank: i + 1, student_id: x.s.student_id, full_name: x.s.full_name, class_id: x.s.class_id, gpa: x.e.gpa, conduct: x.e.conduct }))
            });
        }
    );

    server.registerTool(
        'calculate_teacher_pay',
        {
            title: 'Calculate lecturer pay',
            description:
                'Monthly pay of a lecturer: base salary + teaching pay (periods this month × rate for their title) + overtime pay ' +
                '(periods above the semester quota, spread over the semester months) + bonus − deductions.',
            inputSchema: z.object({
                teacher_id: z.string().describe('Teacher ID, e.g. "T02"'),
                month: z
                    .string()
                    .regex(/^\d{4}-\d{2}$/, 'Month must look like 2025-10')
                    .describe('Payroll month "YYYY-MM", e.g. "2025-10"')
            }),
            outputSchema: z.object({
                teacher_id: z.string(),
                full_name: z.string(),
                title: z.string(),
                month: z.string(),
                semester: z.string(),
                currency: z.string(),
                base_salary: z.number(),
                teaching_periods: z.number(),
                rate_per_period: z.number(),
                teaching_pay: z.number(),
                overtime_periods: z.number(),
                overtime_pay: z.number(),
                bonus: z.number(),
                deductions: z.number(),
                net_pay: z.number()
            }),
            annotations: READ_ONLY
        },
        async ({ teacher_id, month }) => {
            const teacher = data.teachers.get(teacher_id.trim().toUpperCase());
            if (!teacher) return fail(`No lecturer with teacher_id "${teacher_id}".`);
            const pay = rows('payroll').find(p => p.teacher_id === teacher.teacher_id && p.month === month);
            const sem = Object.entries(config.semesterMonths).find(([, months]) => months.includes(month))?.[0];
            if (!pay || !sem) {
                const months = rows('payroll').filter(p => p.teacher_id === teacher.teacher_id).map(p => p.month);
                return fail(`No payroll for ${teacher.teacher_id} in ${month}. Payroll months available: ${months.join(', ')}.`);
            }
            const months = config.semesterMonths[sem].length;
            const workload = data.workloadOf(teacher.teacher_id, sem);
            const rate = config.teachingRatePerPeriod[teacher.title] ?? 0;
            const teaching_periods = Math.round((workload.total_periods / months) * 100) / 100;
            const overtime_periods = Math.round((workload.overtime_periods / months) * 100) / 100;
            const teaching_pay = Math.round(teaching_periods * rate);
            const overtime_pay = Math.round(overtime_periods * config.overtimeRatePerPeriod);
            const [base_salary, bonus, deductions] = [pay.base_salary, pay.bonus, pay.deductions].map(Number);
            return structured({
                teacher_id: teacher.teacher_id,
                full_name: teacher.full_name,
                title: teacher.title,
                month,
                semester: sem,
                currency: config.currency,
                base_salary,
                teaching_periods,
                rate_per_period: rate,
                teaching_pay,
                overtime_periods,
                overtime_pay,
                bonus,
                deductions,
                net_pay: base_salary + teaching_pay + overtime_pay + bonus - deductions
            });
        }
    );

    return server;
}
