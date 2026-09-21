/**
 * Grading rules: 10-point component scores → course total → letter + 4-point value → credit-weighted GPA.
 * All thresholds come from config/grading.json.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { PROJECT_ROOT } from '../../lib/env';

export interface GradingConfig {
    weights: { process: number; final: number };
    totalDecimals: number;
    letterScale: { letter: string; min: number; point: number }[];
    failingLetters: string[];
    classification: { label: string; min: number }[];
    gpaDecimals: number;
    retakePolicy: 'highest' | 'latest';
}

export interface GradedCourse {
    course_id: string;
    semester: string;
    credits: number;
    total: number;
    letter: string;
    point: number;
    passed: boolean;
}

export interface GpaSummary {
    gpa: number | null;
    classification: string | null;
    credits_attempted: number;
    credits_earned: number;
    courses_counted: number;
}

export function loadGradingConfig(file = 'config/grading.json'): GradingConfig {
    const config = JSON.parse(readFileSync(path.resolve(PROJECT_ROOT, file), 'utf8')) as GradingConfig;
    config.letterScale.sort((a, b) => b.min - a.min);
    config.classification.sort((a, b) => b.min - a.min);
    return config;
}

const round = (value: number, decimals: number): number => {
    const factor = 10 ** decimals;
    return Math.round((value + Number.EPSILON) * factor) / factor;
};

export class Grading {
    constructor(readonly config: GradingConfig) {}

    courseTotal(processScore: number, finalScore: number): number {
        const { process, final } = this.config.weights;
        return round(processScore * process + finalScore * final, this.config.totalDecimals);
    }

    letterOf(total: number): { letter: string; point: number } {
        const band = this.config.letterScale.find(b => total >= b.min) ?? this.config.letterScale.at(-1)!;
        return { letter: band.letter, point: band.point };
    }

    grade(course_id: string, semester: string, credits: number, processScore: number, finalScore: number): GradedCourse {
        const total = this.courseTotal(processScore, finalScore);
        const { letter, point } = this.letterOf(total);
        return { course_id, semester, credits, total, letter, point, passed: !this.config.failingLetters.includes(letter) };
    }

    classify(gpa: number): string {
        return (this.config.classification.find(c => gpa >= c.min) ?? this.config.classification.at(-1)!).label;
    }

    /** Semester GPA: every attempt in the given courses counts. */
    gpa(courses: GradedCourse[]): GpaSummary {
        const credits = courses.reduce((sum, c) => sum + c.credits, 0);
        if (credits === 0) {
            return { gpa: null, classification: null, credits_attempted: 0, credits_earned: 0, courses_counted: 0 };
        }
        const gpa = round(courses.reduce((sum, c) => sum + c.point * c.credits, 0) / credits, this.config.gpaDecimals);
        return {
            gpa,
            classification: this.classify(gpa),
            credits_attempted: credits,
            credits_earned: courses.filter(c => c.passed).reduce((sum, c) => sum + c.credits, 0),
            courses_counted: courses.length
        };
    }

    /** Cumulative GPA: one attempt per course, chosen by the retake policy. */
    cumulativeGpa(courses: GradedCourse[]): GpaSummary {
        return this.gpa(this.bestAttempts(courses));
    }

    bestAttempts(courses: GradedCourse[]): GradedCourse[] {
        const byCourse = new Map<string, GradedCourse>();
        for (const course of courses) {
            const current = byCourse.get(course.course_id);
            const better =
                !current ||
                (this.config.retakePolicy === 'highest'
                    ? course.total > current.total
                    : course.semester.localeCompare(current.semester) > 0);
            if (better) byCourse.set(course.course_id, course);
        }
        return [...byCourse.values()];
    }

    /** Human-readable rules, served as the academic://rules/grading resource. */
    describe(): string {
        const c = this.config;
        return [
            '# Grading rules',
            '',
            `Course total = ${c.weights.process * 100}% process score + ${c.weights.final * 100}% final score (10-point scale, rounded to ${c.totalDecimals} decimal).`,
            '',
            '| Total (10-point) | Letter | 4-point |',
            '| --- | --- | --- |',
            ...c.letterScale.map((b, i) => {
                const upper = i === 0 ? 10 : c.letterScale[i - 1].min;
                return `| ${b.min.toFixed(1)} – ${i === 0 ? '10' : `< ${upper.toFixed(1)}`} | ${b.letter} | ${b.point} |`;
            }),
            '',
            `Failing letters: ${c.failingLetters.join(', ')}.`,
            '',
            'GPA = Σ(4-point × credits) / Σ credits.',
            `Semester GPA counts every attempt in that semester; cumulative GPA keeps the ${c.retakePolicy} attempt per course.`,
            '',
            '| GPA (4-point) | Classification |',
            '| --- | --- |',
            ...c.classification.map(k => `| ≥ ${k.min.toFixed(2)} | ${k.label} |`)
        ].join('\n');
    }
}
