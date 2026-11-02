/**
 * Loads the finance CSVs (tuition, scholarships, awards, payroll) once per process and validates them.
 * Invalid rows are kept out of every calculation and reported through `issues`, like the academic server.
 *
 * Students, grades, teachers, sections and conduct are NOT loaded here — they belong to the academic
 * dataset; the finance tools read them through getAcademicData().
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { type CsvTable, parseCsv } from '../../lib/csv';
import { PROJECT_ROOT } from '../../lib/env';

export interface FinanceConfig {
    dataDir: string;
    currency: string;
    tables: { tuition: string; scholarships: string; awards: string; payroll: string };
    calendar: { academicYearStartMonth: number; semesterByMonth: Record<string, number> };
    tuition: { amountToleranceVnd: number };
    scholarship: { requirePaidTuition: boolean; requireNoOwedCourses: boolean };
    teaching: {
        ratePerPeriodByTitle: Record<string, number>;
        weeksPerMonth: number;
        standardPeriodsPerMonth: number;
        overtimeBonusRatio: number;
    };
}

export interface TuitionRecord {
    student_id: string;
    semester: string;
    credits_registered: number;
    fee_per_credit: number;
    discount_pct: number;
    amount_due: number;
    amount_paid: number;
    due_date: string;
    paid_date: string | null;
}

export interface Scholarship {
    scholarship_id: string;
    name: string;
    type: 'merit' | 'need';
    amount: number;
    min_gpa: number;
    min_conduct: number;
    slots_per_faculty: number;
}

export interface ScholarshipAward {
    student_id: string;
    semester: string;
    scholarship_id: string;
    amount: number;
}

export interface PayrollRecord {
    teacher_id: string;
    month: string;
    base_salary: number;
    bonus: number;
    deductions: number;
}

export interface FinanceIssue {
    table: string;
    line: number;
    problem: string;
    row: Record<string, string>;
}

const SEMESTER = /^\d{4}-\d$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Number from a CSV cell; an empty cell is NaN (Number('') would silently be 0). */
const num = (value: string | undefined): number => (value === undefined || value === '' ? Number.NaN : Number(value));

/** Today as YYYY-MM-DD. Override with env FINANCE_AS_OF to make "overdue" reproducible in tests. */
export function todayIso(): string {
    return process.env.FINANCE_AS_OF ?? new Date().toISOString().slice(0, 10);
}

export class FinanceData {
    readonly tuition: TuitionRecord[] = [];
    readonly scholarships = new Map<string, Scholarship>();
    readonly awards: ScholarshipAward[] = [];
    readonly payroll = new Map<string, PayrollRecord>();
    readonly issues: FinanceIssue[] = [];
    /** "teacher_id|month" → ISO time of approval. In memory only — the CSV on disk is never modified. */
    private readonly approvals = new Map<string, string>();

    constructor(
        readonly dataDir: string,
        readonly config: FinanceConfig
    ) {
        const tuition = this.read(config.tables.tuition);
        const scholarships = this.read(config.tables.scholarships);
        const awards = this.read(config.tables.awards);
        const payroll = this.read(config.tables.payroll);
        if (tuition) this.loadTuition(tuition);
        if (scholarships) this.loadScholarships(scholarships);
        if (awards) this.loadAwards(awards);
        if (payroll) this.loadPayroll(payroll);
    }

    private read(file: string): CsvTable | undefined {
        const full = path.join(this.dataDir, file);
        if (!existsSync(full)) {
            this.issues.push({ table: path.basename(file, '.csv'), line: 0, problem: `${file} not found in ${this.dataDir}`, row: {} });
            return undefined;
        }
        return parseCsv(readFileSync(full, 'utf8'));
    }

    private issue(table: string, index: number, problem: string, row: Record<string, string>): void {
        // +2: header is line 1, data starts at line 2
        this.issues.push({ table, line: index + 2, problem, row });
    }

    private loadTuition({ rows }: CsvTable): void {
        const seen = new Set<string>();
        const tolerance = this.config.tuition.amountToleranceVnd;
        rows.forEach((row, i) => {
            const credits = num(row.credits_registered);
            const fee = num(row.fee_per_credit);
            const discount = num(row.discount_pct);
            const due = num(row.amount_due);
            const paid = num(row.amount_paid);
            if (!row.student_id || !SEMESTER.test(row.semester)) return this.issue('tuition', i, 'missing student_id or invalid semester', row);
            if (![credits, fee, discount, due, paid].every(Number.isFinite)) return this.issue('tuition', i, 'missing or non-numeric amount/credit column', row);
            if (!Number.isInteger(credits) || credits <= 0 || fee <= 0) return this.issue('tuition', i, 'credits_registered and fee_per_credit must be positive', row);
            if (discount < 0 || discount > 100) return this.issue('tuition', i, `discount_pct ${discount} outside 0–100`, row);
            if (due < 0 || paid < 0) return this.issue('tuition', i, 'negative amount', row);
            if (paid > due) return this.issue('tuition', i, 'amount_paid exceeds amount_due', row);
            if (!ISO_DATE.test(row.due_date)) return this.issue('tuition', i, 'invalid due_date (expected YYYY-MM-DD)', row);
            if (row.paid_date !== '' && !ISO_DATE.test(row.paid_date)) return this.issue('tuition', i, 'invalid paid_date (expected YYYY-MM-DD or empty)', row);
            if (paid > 0 && row.paid_date === '') return this.issue('tuition', i, 'amount_paid > 0 but paid_date is empty', row);
            const expected = credits * fee * (1 - discount / 100);
            if (Math.abs(expected - due) > tolerance) return this.issue('tuition', i, `amount_due ${due} does not match credits x fee x discount (${Math.round(expected)})`, row);
            const key = `${row.student_id}|${row.semester}`;
            if (seen.has(key)) return this.issue('tuition', i, 'duplicate tuition row (same student, semester)', row);
            seen.add(key);
            this.tuition.push({
                student_id: row.student_id,
                semester: row.semester,
                credits_registered: credits,
                fee_per_credit: fee,
                discount_pct: discount,
                amount_due: due,
                amount_paid: paid,
                due_date: row.due_date,
                paid_date: row.paid_date === '' ? null : row.paid_date
            });
        });
    }

    private loadScholarships({ rows }: CsvTable): void {
        rows.forEach((row, i) => {
            const amount = num(row.amount);
            const minGpa = num(row.min_gpa);
            const minConduct = num(row.min_conduct);
            const slots = num(row.slots_per_faculty);
            if (!row.scholarship_id || !row.name) return this.issue('scholarships', i, 'missing scholarship_id or name', row);
            if (row.type !== 'merit' && row.type !== 'need') return this.issue('scholarships', i, `type must be merit or need, got "${row.type}"`, row);
            if (!(amount > 0)) return this.issue('scholarships', i, 'amount must be positive', row);
            if (!(minGpa >= 0 && minGpa <= 4)) return this.issue('scholarships', i, 'min_gpa must be 0–4', row);
            if (!(minConduct >= 0 && minConduct <= 100)) return this.issue('scholarships', i, 'min_conduct must be 0–100', row);
            if (!Number.isInteger(slots) || slots <= 0) return this.issue('scholarships', i, 'slots_per_faculty must be a positive integer', row);
            if (this.scholarships.has(row.scholarship_id)) return this.issue('scholarships', i, `duplicate scholarship_id ${row.scholarship_id}`, row);
            this.scholarships.set(row.scholarship_id, {
                scholarship_id: row.scholarship_id,
                name: row.name,
                type: row.type,
                amount,
                min_gpa: minGpa,
                min_conduct: minConduct,
                slots_per_faculty: slots
            });
        });
    }

    private loadAwards({ rows }: CsvTable): void {
        const seen = new Set<string>();
        rows.forEach((row, i) => {
            const amount = num(row.amount);
            if (!row.student_id || !SEMESTER.test(row.semester) || !row.scholarship_id) return this.issue('scholarship_awards', i, 'missing student_id, scholarship_id or invalid semester', row);
            if (this.scholarships.size > 0 && !this.scholarships.has(row.scholarship_id)) return this.issue('scholarship_awards', i, `unknown scholarship_id ${row.scholarship_id}`, row);
            if (!(amount > 0)) return this.issue('scholarship_awards', i, 'amount must be positive', row);
            const key = `${row.student_id}|${row.semester}|${row.scholarship_id}`;
            if (seen.has(key)) return this.issue('scholarship_awards', i, 'duplicate award (same student, semester, scholarship)', row);
            seen.add(key);
            this.awards.push({ student_id: row.student_id, semester: row.semester, scholarship_id: row.scholarship_id, amount });
        });
    }

    private loadPayroll({ rows }: CsvTable): void {
        rows.forEach((row, i) => {
            const base = num(row.base_salary);
            const bonus = num(row.bonus);
            const deductions = num(row.deductions);
            if (!row.teacher_id || !MONTH.test(row.month)) return this.issue('payroll', i, 'missing teacher_id or month is not YYYY-MM', row);
            if (![base, bonus, deductions].every(Number.isFinite) || base < 0 || bonus < 0 || deductions < 0) {
                return this.issue('payroll', i, 'base_salary, bonus and deductions must be non-negative numbers', row);
            }
            const key = `${row.teacher_id}|${row.month}`;
            if (this.payroll.has(key)) return this.issue('payroll', i, 'duplicate payroll row (same teacher, month)', row);
            this.payroll.set(key, { teacher_id: row.teacher_id, month: row.month, base_salary: base, bonus, deductions });
        });
    }

    /** Tuition rows of one student, optionally limited to one semester. */
    tuitionOf(studentId: string, semester?: string): TuitionRecord[] {
        return this.tuition.filter(t => t.student_id === studentId && (!semester || t.semester === semester));
    }

    awardsOf(studentId: string, semester: string): ScholarshipAward[] {
        return this.awards.filter(a => a.student_id === studentId && a.semester === semester);
    }

    payrollOf(teacherId: string, month: string): PayrollRecord | undefined {
        return this.payroll.get(`${teacherId}|${month}`);
    }

    isApproved(teacherId: string, month: string): boolean {
        return this.approvals.has(`${teacherId}|${month}`);
    }

    approve(teacherId: string, month: string): void {
        this.approvals.set(`${teacherId}|${month}`, new Date().toISOString());
    }
}

let config: FinanceConfig | undefined;

export function getFinanceConfig(): FinanceConfig {
    config ??= JSON.parse(readFileSync(path.join(PROJECT_ROOT, 'config/finance.json'), 'utf8')) as FinanceConfig;
    return config;
}

let shared: FinanceData | undefined;

/** One dataset per process, so per-request HTTP server instances share data and approvals. */
export function getFinanceData(): FinanceData {
    if (!shared) {
        const cfg = getFinanceConfig();
        shared = new FinanceData(path.resolve(PROJECT_ROOT, process.env.FINANCE_DATA_DIR ?? cfg.dataDir), cfg);
    }
    return shared;
}
