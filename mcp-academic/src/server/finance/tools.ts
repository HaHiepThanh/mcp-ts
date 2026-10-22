/**
 * Tools of the `finance` server — sensitive data (tuition, scholarships, teacher payroll).
 *
 *   tuition_status, outstanding_tuition        student tuition
 *   check_scholarship_eligibility,
 *   rank_scholarship_candidates                 scholarship rules — computed here, never by the LLM
 *   calculate_teacher_pay, payroll_summary      teacher pay from payroll.csv + sections.csv
 *   approve_payroll                             the only tool that changes state — always asks the user (elicitation)
 *
 * Students, grades, teachers, sections and conduct are read from the academic dataset.
 */
import type { CallToolResult, InputRequiredResult, McpServer, ProtocolEra } from '@modelcontextprotocol/server';
import * as z from 'zod';

import { confirmWithUser } from '../../lib/interaction';
import { fail, fold, structured, text } from '../../lib/results';
import type { AcademicData, Student } from '../academic/data';
import { type FinanceData, todayIso } from './data';
import { calculatePay, conductOf, evaluateScholarship, hasConductData, owedCourses, type PayBreakdown, semesterOfMonth, tuitionView } from './rules';

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;

const studentId = z.string().min(1).describe('Student ID, e.g. "2201001"');
const semester = z.string().regex(/^\d{4}-\d$/, 'Semester must look like 2024-1').describe('Semester code "YYYY-N", e.g. "2024-1"');
const teacherId = z.string().min(1).describe('Teacher ID, e.g. "T001"');
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must look like 2024-10').describe('Month "YYYY-MM", e.g. "2024-10"');

const tuitionRecord = z.object({
    semester: z.string(),
    credits_registered: z.number(),
    fee_per_credit: z.number(),
    discount_pct: z.number(),
    amount_due: z.number(),
    amount_paid: z.number(),
    balance: z.number().describe('amount_due - amount_paid'),
    status: z.enum(['paid', 'partial', 'unpaid']),
    overdue: z.boolean().describe('Balance > 0 and the due date has passed'),
    due_date: z.string(),
    paid_date: z.string().nullable()
});

const payFields = {
    periods: z.number().describe('Teaching periods in the month'),
    rate_per_period: z.number(),
    base_salary: z.number(),
    teaching_pay: z.number(),
    overtime_periods: z.number(),
    overtime_bonus: z.number(),
    bonus: z.number(),
    deductions: z.number(),
    gross: z.number(),
    net: z.number()
};

interface Teacher {
    teacher_id: string;
    full_name: string;
    faculty: string;
    title: string;
}

interface PayrollRow {
    teacher_id: string;
    full_name: string;
    faculty: string;
    periods: number;
    overtime_bonus: number;
    gross: number;
    net: number;
    status: 'draft' | 'approved';
}

const NO_HR_DATA = 'Teacher data is not loaded: teachers.csv and sections.csv must exist in the academic data directory.';
const vnd = (n: number): string => n.toLocaleString('en-US');

export function registerFinanceTools(server: McpServer, data: FinanceData, academic: AcademicData, era: ProtocolEra): void {
    const currency = data.config.currency;
    const findStudent = (id: string): Student | undefined => academic.students.get(id.trim());
    const studentNotFound = (id: string) => fail(`No student with student_id "${id}". Use search_students on the academic server to find the right ID.`);

    const findTeacher = (id: string): Teacher | undefined =>
        academic.tables.get('teachers')?.rows.find(r => r.teacher_id === id.trim()) as unknown as Teacher | undefined;

    type PayResult = { ok: true; teacher: Teacher; semester: string; sections: number; pay: PayBreakdown } | { ok: false; message: string };

    /** Pay of one teacher for one month: payroll.csv row + periods from sections.csv + rules of config/finance.json. */
    function computePay(id: string, monthCode: string): PayResult {
        const teachers = academic.tables.get('teachers');
        const sections = academic.tables.get('sections');
        if (!teachers || !sections) return { ok: false, message: NO_HR_DATA };
        const teacher = findTeacher(id);
        if (!teacher) return { ok: false, message: `No teacher with teacher_id "${id}".` };
        const payroll = data.payrollOf(teacher.teacher_id, monthCode);
        if (!payroll) return { ok: false, message: `No payroll record for ${teacher.teacher_id} in ${monthCode}.` };
        const semesterCode = semesterOfMonth(monthCode, data.config.calendar);
        if (!semesterCode) return { ok: false, message: `Month ${monthCode} is not in the configured calendar (config/finance.json → calendar).` };

        const mine = sections.rows.filter(s => s.teacher_id === teacher.teacher_id && s.semester === semesterCode);
        const periods = mine.reduce((sum, s) => sum + (Number(s.periods) || 0), 0) * data.config.teaching.weeksPerMonth;
        const pay = calculatePay(teacher.title, periods, payroll, data.config.teaching);
        if (!pay) return { ok: false, message: `No per-period rate configured for title "${teacher.title}" (config/finance.json → teaching.ratePerPeriodByTitle).` };
        return { ok: true, teacher, semester: semesterCode, sections: mine.length, pay };
    }

    /** Everything the scholarship rules need for one student and semester. */
    function eligibilityInputs(student: Student, semesterCode: string) {
        const record = data.tuitionOf(student.student_id, semesterCode)[0];
        return {
            gpa: academic.gpaOf(student.student_id, semesterCode).gpa,
            conduct: conductOf(academic, student.student_id, semesterCode),
            tuition: record ? tuitionView(record, todayIso()).status : null,
            owedCourses: owedCourses(academic, student.student_id, semesterCode)
        };
    }

    // ── tuition_status ─────────────────────────────────────────────────
    server.registerTool(
        'tuition_status',
        {
            title: 'Tuition status of a student',
            description: 'Tuition of one student: amount due, paid, balance, paid/partial/unpaid and overdue, per semester. Omit semester for all semesters.',
            inputSchema: z.object({ student_id: studentId, semester: semester.optional() }),
            outputSchema: z.object({
                student_id: z.string(),
                full_name: z.string(),
                currency: z.string(),
                total_balance: z.number(),
                records: z.array(tuitionRecord)
            }),
            annotations: READ_ONLY
        },
        async ({ student_id, semester }) => {
            const student = findStudent(student_id);
            if (!student) return studentNotFound(student_id);
            const today = todayIso();
            const records = data.tuitionOf(student.student_id, semester).map(r => tuitionView(r, today));
            if (records.length === 0) return fail(`No tuition record for ${student.student_id}${semester ? ` in semester ${semester}` : ''}.`);
            records.sort((a, b) => a.semester.localeCompare(b.semester));
            return structured({ student_id: student.student_id, full_name: student.full_name, currency, total_balance: records.reduce((sum, r) => sum + r.balance, 0), records });
        }
    );

    // ── outstanding_tuition ────────────────────────────────────────────
    server.registerTool(
        'outstanding_tuition',
        {
            title: 'Outstanding tuition of a class or faculty',
            description: 'Students with unpaid tuition balance in one class OR one faculty (pass exactly one), largest balance first. Omit semester for all semesters.',
            inputSchema: z.object({
                class_id: z.string().optional().describe('Class ID, e.g. "IT01"'),
                faculty: z.string().optional().describe('Faculty name, e.g. "Information Technology"'),
                semester: semester.optional(),
                limit: z.number().int().min(1).max(50).default(10).describe('Maximum number of students to list')
            }),
            outputSchema: z.object({
                scope: z.string(),
                semester: z.string().nullable(),
                currency: z.string(),
                students_in_scope: z.number(),
                students_with_balance: z.number(),
                total_balance: z.number(),
                overdue_balance: z.number(),
                students: z.array(z.object({ student_id: z.string(), full_name: z.string(), class_id: z.string(), balance: z.number(), overdue_balance: z.number() }))
            }),
            annotations: READ_ONLY
        },
        async ({ class_id, faculty, semester, limit }) => {
            if (!class_id === !faculty) return fail('Pass exactly one of class_id or faculty.');
            const pool = [...academic.students.values()].filter(s => (class_id ? s.class_id.toLowerCase() === class_id.toLowerCase() : fold(s.faculty).includes(fold(faculty!))));
            if (pool.length === 0) {
                return fail(class_id ? `Unknown class "${class_id}". Known classes: ${academic.classes().join(', ')}.` : `Unknown faculty "${faculty}". Known faculties: ${academic.faculties().join(', ')}.`);
            }
            const today = todayIso();
            const rows = pool
                .map(s => {
                    const views = data.tuitionOf(s.student_id, semester).map(r => tuitionView(r, today));
                    return {
                        student_id: s.student_id,
                        full_name: s.full_name,
                        class_id: s.class_id,
                        balance: views.reduce((sum, v) => sum + v.balance, 0),
                        overdue_balance: views.filter(v => v.overdue).reduce((sum, v) => sum + v.balance, 0)
                    };
                })
                .filter(r => r.balance > 0)
                .sort((a, b) => b.balance - a.balance || a.student_id.localeCompare(b.student_id));
            return structured({
                scope: class_id ? `class ${class_id}` : `faculty ${faculty}`,
                semester: semester ?? null,
                currency,
                students_in_scope: pool.length,
                students_with_balance: rows.length,
                total_balance: rows.reduce((sum, r) => sum + r.balance, 0),
                overdue_balance: rows.reduce((sum, r) => sum + r.overdue_balance, 0),
                students: rows.slice(0, limit)
            });
        }
    );

    // ── check_scholarship_eligibility ──────────────────────────────────
    server.registerTool(
        'check_scholarship_eligibility',
        {
            title: 'Check scholarship eligibility',
            description:
                'Which scholarships one student qualifies for in a semester. Checks GPA, conduct score, tuition fully paid and no owed courses — ' +
                'computed by code; report the result as returned, with the failed conditions.',
            inputSchema: z.object({ student_id: studentId, semester }),
            outputSchema: z.object({
                student_id: z.string(),
                full_name: z.string(),
                faculty: z.string(),
                semester: z.string(),
                semester_gpa: z.number().nullable(),
                conduct_score: z.number().nullable(),
                tuition: z.enum(['paid', 'partial', 'unpaid', 'no_record']),
                owed_courses: z.array(z.string()),
                scholarships: z.array(
                    z.object({
                        scholarship_id: z.string(),
                        name: z.string(),
                        type: z.enum(['merit', 'need']),
                        amount: z.number(),
                        eligible: z.boolean(),
                        already_awarded: z.boolean(),
                        failed: z.array(z.string()).describe('Conditions that are not met')
                    })
                ),
                eligible_for: z.array(z.string()).describe('scholarship_id values the student qualifies for'),
                notes: z.array(z.string())
            }),
            annotations: READ_ONLY
        },
        async ({ student_id, semester }) => {
            const student = findStudent(student_id);
            if (!student) return studentNotFound(student_id);
            if (data.scholarships.size === 0) return fail('No scholarships are loaded (scholarships.csv missing or empty).');
            if (!academic.semesters().includes(semester)) return fail(`No grades exist for semester ${semester}. Known semesters: ${academic.semesters().join(', ')}.`);

            const input = eligibilityInputs(student, semester);
            const awarded = new Set(data.awardsOf(student.student_id, semester).map(a => a.scholarship_id));
            const scholarships = [...data.scholarships.values()].map(s => {
                const result = evaluateScholarship(input, s, data.config.scholarship);
                return {
                    scholarship_id: s.scholarship_id,
                    name: s.name,
                    type: s.type,
                    amount: s.amount,
                    eligible: result.eligible,
                    already_awarded: awarded.has(s.scholarship_id),
                    failed: result.criteria.filter(c => !c.passed).map(c => c.detail)
                };
            });
            const notes: string[] = [];
            if (!hasConductData(academic)) notes.push('conduct.csv is not loaded, so the conduct condition cannot be met for any scholarship.');
            if (input.gpa === null) notes.push(`${student.student_id} has no grades in ${semester}.`);

            return structured({
                student_id: student.student_id,
                full_name: student.full_name,
                faculty: student.faculty,
                semester,
                semester_gpa: input.gpa,
                conduct_score: input.conduct,
                tuition: input.tuition ?? ('no_record' as const),
                owed_courses: input.owedCourses,
                scholarships,
                eligible_for: scholarships.filter(s => s.eligible).map(s => s.scholarship_id),
                notes
            });
        }
    );

    // ── rank_scholarship_candidates ────────────────────────────────────
    server.registerTool(
        'rank_scholarship_candidates',
        {
            title: 'Rank scholarship candidates',
            description:
                'Eligible students of one faculty for one scholarship in a semester, ranked by semester GPA, then conduct score. ' +
                'The first slots_per_faculty candidates are within the quota.',
            inputSchema: z.object({
                faculty: z.string().describe('Faculty name, e.g. "Information Technology"'),
                semester,
                scholarship_id: z.string().describe('Scholarship ID, e.g. "SCH01"'),
                limit: z.number().int().min(1).max(50).default(10).describe('Maximum number of candidates to list')
            }),
            outputSchema: z.object({
                faculty: z.string(),
                semester: z.string(),
                scholarship: z.object({ scholarship_id: z.string(), name: z.string(), type: z.enum(['merit', 'need']), amount: z.number(), min_gpa: z.number(), min_conduct: z.number() }),
                slots: z.number(),
                students_in_faculty: z.number(),
                eligible_count: z.number(),
                ranking: z.array(
                    z.object({
                        rank: z.number(),
                        student_id: z.string(),
                        full_name: z.string(),
                        class_id: z.string(),
                        semester_gpa: z.number(),
                        conduct_score: z.number().nullable(),
                        within_slots: z.boolean(),
                        already_awarded: z.boolean()
                    })
                )
            }),
            annotations: READ_ONLY
        },
        async ({ faculty, semester, scholarship_id, limit }) => {
            const scholarship = data.scholarships.get(scholarship_id.trim().toUpperCase()) ?? data.scholarships.get(scholarship_id.trim());
            if (!scholarship) return fail(`Unknown scholarship "${scholarship_id}". Known: ${[...data.scholarships.keys()].join(', ') || '(none loaded)'}.`);
            if (!academic.semesters().includes(semester)) return fail(`No grades exist for semester ${semester}. Known semesters: ${academic.semesters().join(', ')}.`);
            const pool = [...academic.students.values()].filter(s => fold(s.faculty).includes(fold(faculty)));
            if (pool.length === 0) return fail(`Unknown faculty "${faculty}". Known faculties: ${academic.faculties().join(', ')}.`);

            const candidates = pool
                .map(student => {
                    const input = eligibilityInputs(student, semester);
                    return { student, input, eligible: evaluateScholarship(input, scholarship, data.config.scholarship).eligible };
                })
                .filter(c => c.eligible)
                .sort(
                    (a, b) =>
                        b.input.gpa! - a.input.gpa! ||
                        (b.input.conduct ?? -1) - (a.input.conduct ?? -1) ||
                        a.student.student_id.localeCompare(b.student.student_id)
                );
            const ranking = candidates.slice(0, limit).map((c, i) => ({
                rank: i + 1,
                student_id: c.student.student_id,
                full_name: c.student.full_name,
                class_id: c.student.class_id,
                semester_gpa: c.input.gpa!,
                conduct_score: c.input.conduct,
                within_slots: i < scholarship.slots_per_faculty,
                already_awarded: data.awardsOf(c.student.student_id, semester).some(a => a.scholarship_id === scholarship.scholarship_id)
            }));
            return structured({
                faculty: pool[0].faculty,
                semester,
                scholarship: {
                    scholarship_id: scholarship.scholarship_id,
                    name: scholarship.name,
                    type: scholarship.type,
                    amount: scholarship.amount,
                    min_gpa: scholarship.min_gpa,
                    min_conduct: scholarship.min_conduct
                },
                slots: scholarship.slots_per_faculty,
                students_in_faculty: pool.length,
                eligible_count: candidates.length,
                ranking
            });
        }
    );

    // ── calculate_teacher_pay ──────────────────────────────────────────
    server.registerTool(
        'calculate_teacher_pay',
        {
            title: 'Calculate teacher pay',
            description:
                'Monthly pay of one teacher: base salary + periods x rate(title) + overtime bonus + bonus - deductions. ' +
                'Periods come from the teacher\'s sections; all amounts are computed by code.',
            inputSchema: z.object({ teacher_id: teacherId, month }),
            outputSchema: z.object({
                teacher_id: z.string(),
                full_name: z.string(),
                faculty: z.string(),
                title: z.string(),
                month: z.string(),
                semester: z.string(),
                sections: z.number(),
                currency: z.string(),
                status: z.enum(['draft', 'approved']),
                ...payFields
            }),
            annotations: READ_ONLY
        },
        async ({ teacher_id, month }) => {
            const result = computePay(teacher_id, month);
            if (!result.ok) return fail(result.message);
            const { teacher, pay } = result;
            return structured({
                teacher_id: teacher.teacher_id,
                full_name: teacher.full_name,
                faculty: teacher.faculty,
                title: teacher.title,
                month,
                semester: result.semester,
                sections: result.sections,
                currency,
                status: data.isApproved(teacher.teacher_id, month) ? ('approved' as const) : ('draft' as const),
                ...pay
            });
        }
    );

    // ── payroll_summary ────────────────────────────────────────────────
    server.registerTool(
        'payroll_summary',
        {
            title: 'Payroll summary of a month',
            description: 'Total teacher payroll of one month, optionally for one faculty, with a per-teacher list (highest net pay first).',
            inputSchema: z.object({
                month,
                faculty: z.string().optional().describe('Faculty name, e.g. "Information Technology"; omit for all faculties'),
                limit: z.number().int().min(1).max(100).default(25).describe('Maximum number of teachers to list')
            }),
            outputSchema: z.object({
                month: z.string(),
                faculty: z.string().nullable(),
                currency: z.string(),
                teachers: z.number(),
                approved: z.number(),
                total_periods: z.number(),
                total_overtime_bonus: z.number(),
                total_gross: z.number(),
                total_net: z.number(),
                skipped: z.number().describe('Payroll rows that could not be calculated (unknown teacher or missing rate)'),
                rows: z.array(z.object({ teacher_id: z.string(), full_name: z.string(), faculty: z.string(), periods: z.number(), net: z.number(), status: z.enum(['draft', 'approved']) }))
            }),
            annotations: READ_ONLY
        },
        async ({ month, faculty, limit }) => {
            if (!academic.tables.has('teachers') || !academic.tables.has('sections')) return fail(NO_HR_DATA);
            const ids = [...data.payroll.values()].filter(p => p.month === month).map(p => p.teacher_id);
            if (ids.length === 0) return fail(`No payroll rows for ${month}.`);

            let skipped = 0;
            const rows: PayrollRow[] = [];
            for (const id of ids) {
                const result = computePay(id, month);
                if (!result.ok) {
                    skipped++;
                    continue;
                }
                if (faculty && !fold(result.teacher.faculty).includes(fold(faculty))) continue;
                rows.push({
                    teacher_id: result.teacher.teacher_id,
                    full_name: result.teacher.full_name,
                    faculty: result.teacher.faculty,
                    periods: result.pay.periods,
                    overtime_bonus: result.pay.overtime_bonus,
                    gross: result.pay.gross,
                    net: result.pay.net,
                    status: data.isApproved(result.teacher.teacher_id, month) ? ('approved' as const) : ('draft' as const)
                });
            }
            if (rows.length === 0) return fail(faculty ? `No payroll rows for faculty "${faculty}" in ${month}.` : `No payroll could be calculated for ${month}.`);
            rows.sort((a, b) => b.net - a.net || a.teacher_id.localeCompare(b.teacher_id));
            const sum = (pick: (r: PayrollRow) => number) => rows.reduce((total, r) => total + pick(r), 0);
            return structured({
                month,
                faculty: faculty ?? null,
                currency,
                teachers: rows.length,
                approved: rows.filter(r => r.status === 'approved').length,
                total_periods: sum(r => r.periods),
                total_overtime_bonus: sum(r => r.overtime_bonus),
                total_gross: sum(r => r.gross),
                total_net: sum(r => r.net),
                skipped,
                rows: rows.slice(0, limit).map(({ teacher_id, full_name, faculty, periods, net, status }) => ({ teacher_id, full_name, faculty, periods, net, status }))
            });
        }
    );

    // ── approve_payroll (elicitation) ──────────────────────────────────
    server.registerTool(
        'approve_payroll',
        {
            title: 'Approve a teacher payroll',
            description:
                'Mark one teacher\'s payroll of a month as approved. The server ALWAYS asks the end user to confirm. ' +
                'The approval is kept in memory for this server run only; the CSV file is never modified.',
            inputSchema: z.object({ teacher_id: teacherId, month }),
            annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
        },
        async ({ teacher_id, month }, ctx): Promise<CallToolResult | InputRequiredResult> => {
            const result = computePay(teacher_id, month);
            if (!result.ok) return fail(result.message);
            const { teacher, pay } = result;
            if (data.isApproved(teacher.teacher_id, month)) return text(`${teacher.full_name} (${teacher.teacher_id}) is already approved for ${month}. Nothing changed.`);

            const message =
                `Approve payroll of ${teacher.full_name} (${teacher.teacher_id}) for ${month}? ` +
                `${pay.periods} periods → gross ${vnd(pay.gross)} ${currency}, deductions ${vnd(pay.deductions)}, net ${vnd(pay.net)} ${currency}.`;

            let answer;
            try {
                answer = await confirmWithUser(era, ctx, 'confirm_approve', message);
            } catch (error) {
                return fail(`Cannot ask the user for confirmation (${String(error)}). The payroll was NOT approved.`);
            }
            if (answer.kind === 'pending') return answer.result;
            if (!answer.confirmed) {
                const why = { accept: 'did not tick confirm', decline: 'declined', cancel: 'cancelled the dialog' }[answer.action];
                return text(`The user ${why} — the payroll was NOT approved.`);
            }
            data.approve(teacher.teacher_id, month);
            return text(`Payroll approved: ${teacher.full_name} (${teacher.teacher_id}), ${month}, net ${vnd(pay.net)} ${currency}.`);
        }
    );
}
