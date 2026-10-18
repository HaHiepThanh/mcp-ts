/**
 * Loads the academic CSV dataset once per process, validates it, and answers queries.
 * Invalid rows are kept out of calculations and reported through `issues`
 * (served as the academic://data-quality resource).
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { type CsvTable, parseCsv } from '../../lib/csv';
import { PROJECT_ROOT } from '../../lib/env';
import { type GradedCourse, Grading, loadGradingConfig } from './grading';

export interface Student {
    student_id: string;
    full_name: string;
    gender: string;
    date_of_birth: string;
    class_id: string;
    faculty: string;
    enrollment_year: string;
    email: string;
}

export interface Course {
    course_id: string;
    course_name: string;
    credits: number;
    faculty: string;
}

export interface GradeRecord {
    student_id: string;
    course_id: string;
    semester: string;
    process_score: number;
    final_score: number;
}

export interface Teacher {
    teacher_id: string;
    full_name: string;
    faculty: string;
    title: string;
    degree: string;
    hire_date: string;
    email: string;
}

export interface Section {
    section_id: string;
    course_id: string;
    semester: string;
    class_id: string;
    teacher_id: string;
    room: string;
    weekday: string;
    start_period: number;
    periods: number;
}

export interface AttendanceRecord {
    student_id: string;
    section_id: string;
    week: number;
    status: 'present' | 'absent' | 'late' | 'excused';
}

export interface AcademicRules {
    attendance: { weeksPerSection: number; maxAbsencePct: number; countAsAbsent: string[] };
    conduct: { scale: { min: number; label: string }[] };
    atRisk: { gpaBelow: number; conductBelow: number; anyExamBan: boolean };
    teachingQuotaPeriodsPerSemester: number;
}

export interface DataIssue {
    table: string;
    line: number;
    problem: string;
    row: Record<string, string>;
}

export interface AcademicConfig {
    dataDir: string;
    gradingConfig: string;
    rulesConfig?: string;
    tables: { students: string; courses: string; grades: string; teachers?: string; sections?: string; attendance?: string; conduct?: string };
    /** Freshness hints attached to cacheable results (2026-07-28, SEP-2549). */
    cacheHints?: Record<string, { ttlMs: number; cacheScope: 'public' | 'private' }>;
}

const SCORE_MIN = 0;
const SCORE_MAX = 10;

export class AcademicData {
    readonly students = new Map<string, Student>();
    readonly courses = new Map<string, Course>();
    readonly grades: GradeRecord[] = [];
    readonly issues: DataIssue[] = [];
    readonly teachers = new Map<string, Teacher>();
    readonly sections = new Map<string, Section>();
    readonly attendance: AttendanceRecord[] = [];
    /** conduct score keyed by "student_id|semester" */
    readonly conduct = new Map<string, number>();
    /** Every CSV in dataDir, unvalidated — backs the generic table tools. */
    readonly tables = new Map<string, CsvTable>();
    private readonly gradeListeners = new Set<(studentId: string) => void>();

    constructor(
        readonly dataDir: string,
        readonly grading: Grading,
        tableFiles: AcademicConfig['tables'],
        readonly rules?: AcademicRules
    ) {
        for (const file of readdirSync(dataDir).filter(f => f.toLowerCase().endsWith('.csv')).sort()) {
            this.tables.set(path.basename(file, '.csv'), parseCsv(readFileSync(path.join(dataDir, file), 'utf8')));
        }
        this.loadStudents(this.table(tableFiles.students));
        this.loadCourses(this.table(tableFiles.courses));
        this.loadGrades(this.table(tableFiles.grades));
        // Phase-2 tables are optional: a phase-1 dataset still loads.
        if (tableFiles.teachers && this.has(tableFiles.teachers)) this.loadTeachers(this.table(tableFiles.teachers));
        if (tableFiles.sections && this.has(tableFiles.sections)) this.loadSections(this.table(tableFiles.sections));
        if (tableFiles.attendance && this.has(tableFiles.attendance)) this.loadAttendance(this.table(tableFiles.attendance));
        if (tableFiles.conduct && this.has(tableFiles.conduct)) this.loadConduct(this.table(tableFiles.conduct));
    }

    private has(file: string): boolean {
        return this.tables.has(path.basename(file, '.csv'));
    }

    private table(file: string): CsvTable {
        const table = this.tables.get(path.basename(file, '.csv'));
        if (!table) throw new Error(`Missing ${file} in ${this.dataDir}`);
        return table;
    }

    private issue(table: string, index: number, problem: string, row: Record<string, string>): void {
        // +2: header is line 1, data starts at line 2
        this.issues.push({ table, line: index + 2, problem, row });
    }

    private loadStudents({ rows }: CsvTable): void {
        rows.forEach((row, i) => {
            if (!row.student_id || !row.full_name || !row.class_id) {
                return this.issue('students', i, 'missing student_id, full_name or class_id', row);
            }
            if (this.students.has(row.student_id)) {
                return this.issue('students', i, `duplicate student_id ${row.student_id}`, row);
            }
            this.students.set(row.student_id, row as unknown as Student);
        });
    }

    private loadCourses({ rows }: CsvTable): void {
        rows.forEach((row, i) => {
            const credits = Number(row.credits);
            if (!row.course_id || !Number.isInteger(credits) || credits <= 0) {
                return this.issue('courses', i, 'missing course_id or invalid credits', row);
            }
            if (this.courses.has(row.course_id)) {
                return this.issue('courses', i, `duplicate course_id ${row.course_id}`, row);
            }
            this.courses.set(row.course_id, { ...(row as unknown as Course), credits });
        });
    }

    private loadGrades({ rows }: CsvTable): void {
        const seen = new Set<string>();
        rows.forEach((row, i) => {
            const { student_id, course_id, semester } = row;
            if (!student_id || !course_id || !semester) return this.issue('grades', i, 'missing student_id, course_id or semester', row);
            if (!this.students.has(student_id)) return this.issue('grades', i, `unknown student_id ${student_id}`, row);
            if (!this.courses.has(course_id)) return this.issue('grades', i, `unknown course_id ${course_id}`, row);
            const scores = [row.process_score, row.final_score];
            if (scores.some(s => s === '' || s === undefined)) return this.issue('grades', i, 'missing score', row);
            const [process_score, final_score] = scores.map(Number);
            if ([process_score, final_score].some(s => Number.isNaN(s) || s < SCORE_MIN || s > SCORE_MAX)) {
                return this.issue('grades', i, `score outside ${SCORE_MIN}–${SCORE_MAX}`, row);
            }
            const key = `${student_id}|${course_id}|${semester}`;
            if (seen.has(key)) return this.issue('grades', i, 'duplicate grade row (same student, course, semester)', row);
            seen.add(key);
            this.grades.push({ student_id, course_id, semester, process_score, final_score });
        });
    }

    private loadTeachers({ rows }: CsvTable): void {
        rows.forEach((row, i) => {
            if (!row.teacher_id || !row.full_name) return this.issue('teachers', i, 'missing teacher_id or full_name', row);
            if (this.teachers.has(row.teacher_id)) return this.issue('teachers', i, `duplicate teacher_id ${row.teacher_id}`, row);
            this.teachers.set(row.teacher_id, row as unknown as Teacher);
        });
    }

    private loadSections({ rows }: CsvTable): void {
        const classes = new Set(this.classes());
        rows.forEach((row, i) => {
            const problems = [
                !this.courses.has(row.course_id) && `unknown course_id ${row.course_id}`,
                !classes.has(row.class_id) && `unknown class_id ${row.class_id}`,
                !this.teachers.has(row.teacher_id) && `unknown teacher_id ${row.teacher_id}`,
                this.sections.has(row.section_id) && `duplicate section_id ${row.section_id}`
            ].filter(Boolean);
            if (problems.length) return this.issue('sections', i, problems.join('; '), row);
            this.sections.set(row.section_id, { ...(row as unknown as Section), start_period: Number(row.start_period), periods: Number(row.periods) });
        });
    }

    private loadAttendance({ rows }: CsvTable): void {
        const weeks = this.rules?.attendance.weeksPerSection ?? 15;
        rows.forEach((row, i) => {
            const week = Number(row.week);
            if (!this.students.has(row.student_id)) return this.issue('attendance', i, `unknown student_id ${row.student_id}`, row);
            if (!this.sections.has(row.section_id)) return this.issue('attendance', i, `unknown section_id ${row.section_id}`, row);
            if (!Number.isInteger(week) || week < 1 || week > weeks) return this.issue('attendance', i, `week ${row.week} outside 1–${weeks}`, row);
            if (!['present', 'absent', 'late', 'excused'].includes(row.status)) return this.issue('attendance', i, `unknown status ${row.status}`, row);
            this.attendance.push({ student_id: row.student_id, section_id: row.section_id, week, status: row.status as AttendanceRecord['status'] });
        });
    }

    private loadConduct({ rows }: CsvTable): void {
        rows.forEach((row, i) => {
            const value = Number(row.score);
            if (!this.students.has(row.student_id)) return this.issue('conduct', i, `unknown student_id ${row.student_id}`, row);
            if (Number.isNaN(value) || value < 0 || value > 100) return this.issue('conduct', i, 'conduct score outside 0–100', row);
            this.conduct.set(`${row.student_id}|${row.semester}`, value);
        });
    }

    conductOf(studentId: string, semester: string): { score: number | null; label: string | null } {
        const value = this.conduct.get(`${studentId}|${semester}`);
        if (value === undefined || !this.rules) return { score: value ?? null, label: null };
        return { score: value, label: this.rules.conduct.scale.find(b => value >= b.min)!.label };
    }

    /** Absences per section for one student in one semester, with the exam-ban rule applied. */
    attendanceOf(studentId: string, semester: string) {
        const rules = this.rules!.attendance;
        const bySection = new Map<string, AttendanceRecord[]>();
        for (const a of this.attendance) {
            if (a.student_id !== studentId || this.sections.get(a.section_id)?.semester !== semester) continue;
            bySection.set(a.section_id, [...(bySection.get(a.section_id) ?? []), a]);
        }
        return [...bySection].sort().map(([section_id, rows]) => {
            const section = this.sections.get(section_id)!;
            const absent = rows.filter(r => rules.countAsAbsent.includes(r.status)).length;
            const absence_pct = Math.round((absent / rules.weeksPerSection) * 1000) / 10;
            return {
                section_id,
                course_id: section.course_id,
                course_name: this.courses.get(section.course_id)!.course_name,
                weeks_recorded: rows.length,
                absent,
                late: rows.filter(r => r.status === 'late').length,
                excused: rows.filter(r => r.status === 'excused').length,
                absence_pct,
                exam_banned: absence_pct > rules.maxAbsencePct
            };
        });
    }

    /** Sections a teacher teaches in a semester and the total periods vs the quota. */
    workloadOf(teacherId: string, semester: string) {
        const sections = [...this.sections.values()].filter(s => s.teacher_id === teacherId && s.semester === semester);
        const total_periods = sections.reduce((a, s) => a + s.periods, 0);
        const quota = this.rules?.teachingQuotaPeriodsPerSemester ?? 0;
        return { sections, total_periods, quota_periods: quota, overtime_periods: Math.max(0, total_periods - quota) };
    }

    semesters(): string[] {
        return [...new Set(this.grades.map(g => g.semester))].sort();
    }

    classes(): string[] {
        return [...new Set([...this.students.values()].map(s => s.class_id))].sort();
    }

    faculties(): string[] {
        return [...new Set([...this.students.values()].map(s => s.faculty))].sort();
    }

    /** Graded attempts for one student, optionally limited to one semester. */
    gradedCourses(studentId: string, semester?: string): GradedCourse[] {
        return this.grades
            .filter(g => g.student_id === studentId && (!semester || g.semester === semester))
            .map(g => this.grading.grade(g.course_id, g.semester, this.courses.get(g.course_id)!.credits, g.process_score, g.final_score));
    }

    /** Semester GPA when `semester` is given, otherwise cumulative GPA. */
    gpaOf(studentId: string, semester?: string) {
        const courses = this.gradedCourses(studentId, semester);
        return semester ? this.grading.gpa(courses) : this.grading.cumulativeGpa(courses);
    }

    /** Insert or replace one grade row (in memory only — the CSV on disk is never modified). */
    upsertGrade(record: GradeRecord): 'inserted' | 'updated' {
        const index = this.grades.findIndex(
            g => g.student_id === record.student_id && g.course_id === record.course_id && g.semester === record.semester
        );
        if (index === -1) this.grades.push(record);
        else this.grades[index] = record;
        for (const listener of this.gradeListeners) listener(record.student_id);
        return index === -1 ? 'inserted' : 'updated';
    }

    /** Be told whenever a student's grades change. Returns an unsubscribe function. */
    onGradeChanged(listener: (studentId: string) => void): () => void {
        this.gradeListeners.add(listener);
        return () => this.gradeListeners.delete(listener);
    }
}

let config: AcademicConfig | undefined;

export function getAcademicConfig(): AcademicConfig {
    config ??= JSON.parse(readFileSync(path.join(PROJECT_ROOT, 'config/academic.json'), 'utf8')) as AcademicConfig;
    return config;
}

let shared: AcademicData | undefined;

/** One dataset per process, so per-request HTTP server instances share state. */
export function getAcademicData(): AcademicData {
    if (!shared) {
        const config = getAcademicConfig();
        const dataDir = path.resolve(PROJECT_ROOT, process.env.ACADEMIC_DATA_DIR ?? config.dataDir);
        const rules = config.rulesConfig ? (JSON.parse(readFileSync(path.join(PROJECT_ROOT, config.rulesConfig), 'utf8')) as AcademicRules) : undefined;
        shared = new AcademicData(dataDir, new Grading(loadGradingConfig(config.gradingConfig)), config.tables, rules);
    }
    return shared;
}
