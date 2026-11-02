/**
 * Business rules of the finance server — pure functions, no I/O, so the numbers are computed by code
 * and never guessed by the LLM. Thresholds come from config/finance.json and scholarships.csv.
 */
import type { AcademicData } from '../academic/data';
import type { FinanceConfig, PayrollRecord, Scholarship, TuitionRecord } from './data';

// ── Tuition ───────────────────────────────────────────────────────────

export type TuitionState = 'paid' | 'partial' | 'unpaid';

export interface TuitionView {
    semester: string;
    credits_registered: number;
    fee_per_credit: number;
    discount_pct: number;
    amount_due: number;
    amount_paid: number;
    balance: number;
    status: TuitionState;
    overdue: boolean;
    due_date: string;
    paid_date: string | null;
}

/** `today` is an ISO date (YYYY-MM-DD); ISO dates compare correctly as strings. */
export function tuitionView(record: TuitionRecord, today: string): TuitionView {
    const balance = Math.max(0, record.amount_due - record.amount_paid);
    const status: TuitionState = balance === 0 ? 'paid' : record.amount_paid > 0 ? 'partial' : 'unpaid';
    return {
        semester: record.semester,
        credits_registered: record.credits_registered,
        fee_per_credit: record.fee_per_credit,
        discount_pct: record.discount_pct,
        amount_due: record.amount_due,
        amount_paid: record.amount_paid,
        balance,
        status,
        overdue: balance > 0 && record.due_date < today,
        due_date: record.due_date,
        paid_date: record.paid_date
    };
}

// ── Scholarship eligibility ───────────────────────────────────────────

export interface EligibilityInput {
    /** Semester GPA (4-point), null when the student has no grade in the semester. */
    gpa: number | null;
    /** Conduct score 0–100 of the semester, null when there is no record. */
    conduct: number | null;
    /** Tuition state of the semester, null when there is no tuition record. */
    tuition: TuitionState | null;
    /** Courses still failing after the best attempt, up to the semester. */
    owedCourses: string[];
}

export interface Criterion {
    name: 'gpa' | 'conduct' | 'tuition_paid' | 'no_owed_courses';
    passed: boolean;
    detail: string;
}

export function evaluateScholarship(
    input: EligibilityInput,
    scholarship: Scholarship,
    rules: FinanceConfig['scholarship']
): { eligible: boolean; criteria: Criterion[] } {
    const criteria: Criterion[] = [
        {
            name: 'gpa',
            passed: input.gpa !== null && input.gpa >= scholarship.min_gpa,
            detail: input.gpa === null ? 'no grades in this semester' : `GPA ${input.gpa} (minimum ${scholarship.min_gpa})`
        },
        {
            name: 'conduct',
            passed: input.conduct !== null && input.conduct >= scholarship.min_conduct,
            detail: input.conduct === null ? 'no conduct score for this semester' : `conduct ${input.conduct} (minimum ${scholarship.min_conduct})`
        }
    ];
    if (rules.requirePaidTuition) {
        criteria.push({
            name: 'tuition_paid',
            passed: input.tuition === 'paid',
            detail: input.tuition === null ? 'no tuition record for this semester' : `tuition ${input.tuition}`
        });
    }
    if (rules.requireNoOwedCourses) {
        criteria.push({
            name: 'no_owed_courses',
            passed: input.owedCourses.length === 0,
            detail: input.owedCourses.length === 0 ? 'no owed courses' : `owes ${input.owedCourses.join(', ')}`
        });
    }
    return { eligible: criteria.every(c => c.passed), criteria };
}

/** Courses a student still fails after the best attempt, counting every semester up to `semester`. */
export function owedCourses(academic: AcademicData, studentId: string, semester: string): string[] {
    const attempts = academic.gradedCourses(studentId).filter(g => g.semester <= semester); // "YYYY-N" sorts chronologically
    return academic.grading
        .bestAttempts(attempts)
        .filter(g => !g.passed)
        .map(g => g.course_id)
        .sort();
}

const conductIndexes = new WeakMap<AcademicData, Map<string, number>>();

/** True when the academic dataset contains conduct.csv. */
export function hasConductData(academic: AcademicData): boolean {
    return academic.tables.has('conduct');
}

/** Conduct score (0–100) of a student in a semester, null when there is no record. */
export function conductOf(academic: AcademicData, studentId: string, semester: string): number | null {
    let index = conductIndexes.get(academic);
    if (!index) {
        index = new Map();
        for (const row of academic.tables.get('conduct')?.rows ?? []) {
            const score = Number(row.score);
            if (row.score !== '' && Number.isFinite(score)) index.set(`${row.student_id}|${row.semester}`, score);
        }
        conductIndexes.set(academic, index);
    }
    return index.get(`${studentId}|${semester}`) ?? null;
}

// ── Teacher pay ───────────────────────────────────────────────────────

/** Semester code ("2024-1") a calendar month ("2024-10") belongs to, using config/finance.json → calendar. */
export function semesterOfMonth(month: string, calendar: FinanceConfig['calendar']): string | undefined {
    const [yearText, monthText] = month.split('-');
    const year = Number(yearText);
    const m = Number(monthText);
    const number = calendar.semesterByMonth[String(m)];
    if (number === undefined) return undefined;
    return `${m >= calendar.academicYearStartMonth ? year : year - 1}-${number}`;
}

export interface PayBreakdown {
    periods: number;
    rate_per_period: number;
    base_salary: number;
    teaching_pay: number;
    overtime_periods: number;
    overtime_bonus: number;
    bonus: number;
    deductions: number;
    gross: number;
    net: number;
}

/** `periods` are the teacher's teaching periods in the month. Returns undefined when the title has no configured rate. */
export function calculatePay(title: string, periods: number, payroll: PayrollRecord, rules: FinanceConfig['teaching']): PayBreakdown | undefined {
    const rate = rules.ratePerPeriodByTitle[title];
    if (rate === undefined) return undefined;
    const teaching_pay = periods * rate;
    const overtime_periods = Math.max(0, periods - rules.standardPeriodsPerMonth);
    const overtime_bonus = Math.round(overtime_periods * rate * rules.overtimeBonusRatio);
    const gross = payroll.base_salary + teaching_pay + overtime_bonus + payroll.bonus;
    return {
        periods,
        rate_per_period: rate,
        base_salary: payroll.base_salary,
        teaching_pay,
        overtime_periods,
        overtime_bonus,
        bonus: payroll.bonus,
        deductions: payroll.deductions,
        gross,
        net: gross - payroll.deductions
    };
}
