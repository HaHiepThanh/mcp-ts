/**
 * Generates the TEMPORARY finance dataset in data/sample-finance/ (deliberately NOT in data/sample/:
 * the academic server loads every CSV of its own data dir, so money data there would leak through it).
 *
 * Reads the academic dataset (students, courses, grades; teachers + sections + conduct when present),
 * so the money data stays consistent with it. Same seed → same files every time.
 * Run: npm run data:finance        (re-run after teachers.csv / sections.csv / conduct.csv appear)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { toCsv } from '../src/lib/csv';
import { PROJECT_ROOT } from '../src/lib/env';
import { getAcademicData } from '../src/server/academic/data';
import { getFinanceConfig, type Scholarship, todayIso } from '../src/server/finance/data';
import { conductOf, evaluateScholarship, hasConductData, owedCourses, tuitionView } from '../src/server/finance/rules';

// Deterministic PRNG (mulberry32).
let seed = 3003;
function random(): number {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const roundTo = (value: number, step: number): number => Math.round(value / step) * step;
const addDays = (iso: string, days: number): string => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

const academic = getAcademicData();
const finance = getFinanceConfig();
const semesters = academic.semesters();
const latest = semesters.at(-1)!;

// ── tuition.csv ───────────────────────────────────────────────────────
const FEE_PER_CREDIT: Record<string, number> = { 'Information Technology': 1_050_000, 'Business Administration': 950_000 };

/** First payment deadline of a semester "YYYY-N". */
function dueDateOf(semester: string): string {
    const [year, n] = semester.split('-').map(Number);
    return n === 1 ? `${year}-10-15` : n === 2 ? `${year + 1}-03-15` : `${year + 1}-08-15`;
}

const tuition: Record<string, unknown>[] = [];
for (const student of academic.students.values()) {
    for (const semester of semesters) {
        const records = academic.grades.filter(g => g.student_id === student.student_id && g.semester === semester);
        if (records.length === 0) continue;
        const credits = records.reduce((sum, g) => sum + academic.courses.get(g.course_id)!.credits, 0);
        const fee = FEE_PER_CREDIT[student.faculty] ?? 900_000;
        const discountRoll = random();
        const discount = discountRoll < 0.05 ? 20 : discountRoll < 0.2 ? 10 : 0;
        const due = roundTo(credits * fee * (1 - discount / 100), 1000);
        const dueDate = dueDateOf(semester);

        // Payment behaviour: the latest semester has more people who have not paid yet.
        const [fullBelow, lateBelow, partialBelow] = semester === latest ? [0.55, 0.65, 0.8] : [0.8, 0.88, 0.95];
        const roll = random();
        let paid = 0;
        let paidDate = '';
        if (roll < fullBelow) {
            paid = due;
            paidDate = addDays(dueDate, -Math.floor(random() * 20));
        } else if (roll < lateBelow) {
            paid = due;
            paidDate = addDays(dueDate, 5 + Math.floor(random() * 30));
        } else if (roll < partialBelow) {
            paid = roundTo(due * (0.4 + random() * 0.3), 1000);
            paidDate = addDays(dueDate, -Math.floor(random() * 10));
        }
        tuition.push({
            student_id: student.student_id,
            semester,
            credits_registered: credits,
            fee_per_credit: fee,
            discount_pct: discount,
            amount_due: due,
            amount_paid: paid,
            due_date: dueDate,
            paid_date: paidDate
        });
    }
}

// ── scholarships.csv ──────────────────────────────────────────────────
const scholarships: Scholarship[] = [
    { scholarship_id: 'SCH01', name: 'Excellence Scholarship', type: 'merit', amount: 10_000_000, min_gpa: 3.6, min_conduct: 90, slots_per_faculty: 2 },
    { scholarship_id: 'SCH02', name: 'Merit Scholarship', type: 'merit', amount: 5_000_000, min_gpa: 3.2, min_conduct: 80, slots_per_faculty: 4 },
    { scholarship_id: 'SCH03', name: 'Student Support Grant', type: 'need', amount: 4_000_000, min_gpa: 2.5, min_conduct: 65, slots_per_faculty: 3 }
];

// ── scholarship_awards.csv (history: every semester except the latest, so there is something left to rank) ──
const tuitionByKey = new Map(tuition.map(t => [`${t.student_id}|${t.semester}`, t]));
const conductAvailable = hasConductData(academic);
const today = todayIso();
const awards: Record<string, unknown>[] = [];
for (const semester of semesters.filter(s => s !== latest)) {
    const awardedThisSemester = new Set<string>();
    for (const faculty of academic.faculties()) {
        for (const scholarship of [...scholarships].sort((a, b) => b.amount - a.amount)) {
            const ranked = [...academic.students.values()]
                .filter(s => s.faculty === faculty && !awardedThisSemester.has(s.student_id))
                .map(s => {
                    const row = tuitionByKey.get(`${s.student_id}|${semester}`);
                    const input = {
                        gpa: academic.gpaOf(s.student_id, semester).gpa,
                        // Without conduct.csv the conduct condition is skipped (score 100) — re-run the generator once it exists.
                        conduct: conductAvailable ? conductOf(academic, s.student_id, semester) : 100,
                        tuition: row ? tuitionView(row as never, today).status : null,
                        owedCourses: owedCourses(academic, s.student_id, semester)
                    };
                    return { student: s, input, eligible: evaluateScholarship(input, scholarship, finance.scholarship).eligible };
                })
                .filter(c => c.eligible)
                .sort((a, b) => b.input.gpa! - a.input.gpa! || (b.input.conduct ?? 0) - (a.input.conduct ?? 0) || a.student.student_id.localeCompare(b.student.student_id));
            for (const { student } of ranked.slice(0, scholarship.slots_per_faculty)) {
                awardedThisSemester.add(student.student_id);
                awards.push({ student_id: student.student_id, semester, scholarship_id: scholarship.scholarship_id, amount: scholarship.amount });
            }
        }
    }
}

// ── payroll.csv (needs teachers.csv + sections.csv from the academic data) ──
const teachers = academic.tables.get('teachers')?.rows ?? [];
const sectionSemesters = [...new Set((academic.tables.get('sections')?.rows ?? []).map(s => s.semester))].sort();
const BASE_SALARY: Record<string, number> = { Lecturer: 8_000_000, 'Senior Lecturer': 10_000_000, 'Associate Professor': 13_000_000, Professor: 16_000_000 };

function monthsOfSemester(semester: string): string[] {
    const [year, n] = semester.split('-').map(Number);
    return Object.entries(finance.calendar.semesterByMonth)
        .filter(([, number]) => number === n)
        .map(([m]) => {
            const month = Number(m);
            return `${month >= finance.calendar.academicYearStartMonth ? year : year + 1}-${String(month).padStart(2, '0')}`;
        })
        .sort();
}

const payroll: Record<string, unknown>[] = [];
const months = [...new Set(sectionSemesters.flatMap(monthsOfSemester))].sort();
for (const teacher of teachers) {
    const base = roundTo((BASE_SALARY[teacher.title] ?? 8_000_000) + (random() - 0.5) * 1_000_000, 100_000);
    for (const month of months) {
        payroll.push({
            teacher_id: teacher.teacher_id,
            month,
            base_salary: base,
            bonus: random() < 0.12 ? (5 + Math.floor(random() * 15)) * 100_000 : 0,
            deductions: roundTo(base * 0.105, 1000) // fake: 10.5 % insurance-style deduction
        });
    }
}

// ── Deliberately invalid rows — the server must skip and report them (see README_data.md) ──
const injectedTuition = [
    { ...tuition[0] }, // duplicate (student, semester)
    { ...tuition[1], student_id: '2299998', amount_due: 1_234_567, amount_paid: 0, paid_date: '' }, // amount_due ≠ credits x fee x discount
    { ...tuition[2], student_id: '2299997', discount_pct: 150 },
    { ...tuition[3], student_id: '2299996', amount_paid: Number(tuition[3].amount_due) + 1_000_000 }, // paid more than due
    { ...tuition[4], student_id: '2299995', due_date: '15/10/2024' }
];
const injectedPayroll = teachers.length > 0 ? [{ teacher_id: teachers[0].teacher_id, month: '2025-13', base_salary: 9_000_000, bonus: 0, deductions: 0 }, { teacher_id: teachers[1 % teachers.length].teacher_id, month: months[0] ?? '2024-09', base_salary: -5, bonus: 0, deductions: 0 }] : [];

const dir = path.join(PROJECT_ROOT, 'data', 'sample-finance');
mkdirSync(dir, { recursive: true });
const write = (file: string, rows: Record<string, unknown>[]) => writeFileSync(path.join(dir, file), toCsv(Object.keys(rows[0]), rows));
write('tuition.csv', [...tuition, ...injectedTuition]);
write('scholarships.csv', scholarships as unknown as Record<string, unknown>[]);
write('scholarship_awards.csv', awards);
if (payroll.length > 0) write('payroll.csv', [...payroll, ...injectedPayroll]);

const firstInjected = tuition.length + 2;
const firstInjectedPayroll = payroll.length + 2;
writeFileSync(
    path.join(dir, 'README_data.md'),
    `# SAMPLE finance dataset (temporary — generated by scripts/generate-finance-data.ts)

Kept in its own folder on purpose: the academic server loads every CSV of its data dir, so money data must not live there.
All data is fake. Re-run \`npm run data:finance\` after teachers.csv / sections.csv / conduct.csv change.

| File | Rows | Columns |
| --- | --- | --- |
| tuition.csv | ${tuition.length} (+${injectedTuition.length} injected) | student_id, semester, credits_registered, fee_per_credit, discount_pct, amount_due, amount_paid, due_date, paid_date |
| scholarships.csv | ${scholarships.length} | scholarship_id, name, type, amount, min_gpa, min_conduct, slots_per_faculty |
| scholarship_awards.csv | ${awards.length} | student_id, semester, scholarship_id, amount |
| payroll.csv | ${payroll.length > 0 ? `${payroll.length} (+${injectedPayroll.length} injected)` : 'NOT generated — teachers.csv / sections.csv not found in the academic data dir'} | teacher_id, month, base_salary, bonus, deductions |

- tuition: one row per student and semester that has grades; credits = sum of the credits of that semester's grade rows (retakes included). The latest semester (${latest}) has more unpaid rows.
- awards: history of every semester except ${latest}, picked with the same rules as the tools (GPA, tuition paid, no owed courses${conductAvailable ? ', conduct' : '; conduct.csv was NOT found, so the conduct condition was skipped'}).
- payroll: one row per teacher and month of every semester in sections.csv; deductions are a fake 10.5 % of base_salary.

## Injected invalid rows (the server must skip and report them)

| File | Line | Problem |
| --- | --- | --- |
| tuition.csv | ${firstInjected} | duplicate of line 2 |
| tuition.csv | ${firstInjected + 1} | amount_due 1234567 does not match credits x fee x discount |
| tuition.csv | ${firstInjected + 2} | discount_pct 150 (> 100) |
| tuition.csv | ${firstInjected + 3} | amount_paid exceeds amount_due |
| tuition.csv | ${firstInjected + 4} | due_date 15/10/2024 is not YYYY-MM-DD |
${payroll.length > 0 ? `| payroll.csv | ${firstInjectedPayroll} | month 2025-13 is not a month |\n| payroll.csv | ${firstInjectedPayroll + 1} | negative base_salary |\n` : ''}`
);

console.log(
    `Finance data written to ${path.relative(PROJECT_ROOT, dir)}: ${tuition.length} tuition rows, ${scholarships.length} scholarships, ${awards.length} awards, ${payroll.length} payroll rows`
);
if (payroll.length === 0) console.log('  ! payroll.csv skipped: teachers.csv / sections.csv not found in the academic data dir yet.');
if (!conductAvailable) console.log('  ! conduct.csv not found: the awards history ignores the conduct condition.');
