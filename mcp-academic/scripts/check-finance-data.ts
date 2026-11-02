/**
 * Consistency check of the finance data against the finance rules — run after `npm run data:finance`.
 *   1. every scholarship award in scholarship_awards.csv must be one the eligibility rules would grant
 *      (GPA, conduct, tuition paid, no owed course) — the tools and the data must never contradict each other
 *   2. payroll.csv must cover every teacher for every month of every semester that has sections,
 *      and every teacher's title must have a per-period rate in config/finance.json
 *   3. rows skipped while loading (data-quality issues) are listed — the generator injects a few on purpose
 * Exit code 1 when 1 or 2 fail.   Usage: npm run check:finance
 */
import { getAcademicData } from '../src/server/academic/data';
import { getFinanceData, todayIso } from '../src/server/finance/data';
import { conductOf, evaluateScholarship, owedCourses, semesterOfMonth, tuitionView } from '../src/server/finance/rules';

const academic = getAcademicData();
const finance = getFinanceData();
let failures = 0;
const fail = (message: string) => {
    failures++;
    console.log(`  ✖ ${message}`);
};

// ── 1. awards vs eligibility rules ───────────────────────────────────
console.log(`\n1. Awards vs eligibility rules (${finance.awards.length} awards)`);
const today = todayIso();
for (const award of finance.awards) {
    const scholarship = finance.scholarships.get(award.scholarship_id);
    const student = academic.students.get(award.student_id);
    if (!scholarship || !student) {
        fail(`${award.student_id} ${award.semester} ${award.scholarship_id}: unknown ${scholarship ? 'student' : 'scholarship'}`);
        continue;
    }
    const record = finance.tuitionOf(award.student_id, award.semester)[0];
    const result = evaluateScholarship(
        {
            gpa: academic.gpaOf(award.student_id, award.semester).gpa,
            conduct: conductOf(academic, award.student_id, award.semester),
            tuition: record ? tuitionView(record, today).status : null,
            owedCourses: owedCourses(academic, award.student_id, award.semester)
        },
        scholarship,
        finance.config.scholarship
    );
    if (!result.eligible) {
        fail(`${award.student_id} ${award.semester} ${award.scholarship_id}: ${result.criteria.filter(c => !c.passed).map(c => c.detail).join('; ')}`);
    }
}
if (failures === 0) console.log('  ✔ every award is consistent with the rules');

// ── 2. payroll coverage ──────────────────────────────────────────────
const before = failures;
const teachers = academic.tables.get('teachers')?.rows ?? [];
const sections = academic.tables.get('sections')?.rows ?? [];
console.log(`\n2. Payroll coverage (${finance.payroll.size} rows, ${teachers.length} teachers)`);
if (teachers.length === 0 || sections.length === 0) {
    fail('teachers.csv / sections.csv not found in the academic data dir');
} else {
    const semesters = new Set(sections.map(s => s.semester));
    const months = new Set<string>();
    for (const p of finance.payroll.values()) {
        const semester = semesterOfMonth(p.month, finance.config.calendar);
        if (semester && semesters.has(semester)) months.add(p.month);
    }
    let missing = 0;
    for (const teacher of teachers) {
        if (finance.config.teaching.ratePerPeriodByTitle[teacher.title] === undefined) fail(`${teacher.teacher_id}: no rate for title "${teacher.title}"`);
        for (const month of months) if (!finance.payrollOf(teacher.teacher_id, month)) missing++;
    }
    for (const semester of semesters) {
        const covered = [...months].some(m => semesterOfMonth(m, finance.config.calendar) === semester);
        if (!covered) fail(`no payroll month falls in semester ${semester}`);
    }
    if (missing > 0) fail(`${missing} teacher/month combinations have no payroll row (${teachers.length} teachers × ${months.size} months)`);
    if (failures === before) console.log(`  ✔ all ${teachers.length} teachers have a payroll row for each of the ${months.size} months of semesters ${[...semesters].sort().join(', ')}`);
}

// ── 3. skipped rows ──────────────────────────────────────────────────
console.log(`\n3. Rows skipped while loading: ${finance.issues.length}`);
for (const issue of finance.issues) console.log(`  · ${issue.table} line ${issue.line}: ${issue.problem}`);

console.log(failures === 0 ? '\n✔ finance data is consistent' : `\n✖ ${failures} problem(s) — re-run: npm run data:finance`);
process.exitCode = failures === 0 ? 0 : 1;
