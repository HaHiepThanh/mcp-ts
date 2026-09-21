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

export interface DataIssue {
    table: string;
    line: number;
    problem: string;
    row: Record<string, string>;
}

interface AcademicConfig {
    dataDir: string;
    gradingConfig: string;
    tables: { students: string; courses: string; grades: string };
}

const SCORE_MIN = 0;
const SCORE_MAX = 10;

export class AcademicData {
    readonly students = new Map<string, Student>();
    readonly courses = new Map<string, Course>();
    readonly grades: GradeRecord[] = [];
    readonly issues: DataIssue[] = [];
    /** Every CSV in dataDir, unvalidated — backs the generic table tools. */
    readonly tables = new Map<string, CsvTable>();

    constructor(
        readonly dataDir: string,
        readonly grading: Grading,
        tableFiles: AcademicConfig['tables']
    ) {
        for (const file of readdirSync(dataDir).filter(f => f.toLowerCase().endsWith('.csv')).sort()) {
            this.tables.set(path.basename(file, '.csv'), parseCsv(readFileSync(path.join(dataDir, file), 'utf8')));
        }
        this.loadStudents(this.table(tableFiles.students));
        this.loadCourses(this.table(tableFiles.courses));
        this.loadGrades(this.table(tableFiles.grades));
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
        if (index === -1) {
            this.grades.push(record);
            return 'inserted';
        }
        this.grades[index] = record;
        return 'updated';
    }
}

let shared: AcademicData | undefined;

/** One dataset per process, so per-request HTTP server instances share state. */
export function getAcademicData(): AcademicData {
    if (!shared) {
        const config = JSON.parse(readFileSync(path.join(PROJECT_ROOT, 'config/academic.json'), 'utf8')) as AcademicConfig;
        const dataDir = path.resolve(PROJECT_ROOT, process.env.ACADEMIC_DATA_DIR ?? config.dataDir);
        shared = new AcademicData(dataDir, new Grading(loadGradingConfig(config.gradingConfig)), config.tables);
    }
    return shared;
}
