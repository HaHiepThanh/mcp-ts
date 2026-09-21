/**
 * Generates a small, deterministic TEMPORARY dataset in data/sample/ so development
 * is not blocked while the team prepares the real data (data/real/).
 * Run: npm run data:sample   (same seed → same files every time)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { toCsv } from '../src/lib/csv';
import { PROJECT_ROOT } from '../src/lib/env';

// Deterministic PRNG (mulberry32) so every teammate regenerates identical data.
let seed = 2502;
function random(): number {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)];
const noise = (spread: number): number => (random() + random() + random() - 1.5) * spread;
const score = (value: number): number => Math.round(Math.min(10, Math.max(0, value)) * 10) / 10;

const FAMILY = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Võ', 'Đặng', 'Bùi', 'Đỗ'];
const MIDDLE = { Male: ['Văn', 'Minh', 'Quốc', 'Đức', 'Hoàng'], Female: ['Thị', 'Ngọc', 'Thu', 'Mai', 'Bảo'] };
const GIVEN = {
    Male: ['An', 'Bình', 'Cường', 'Dũng', 'Hải', 'Khoa', 'Long', 'Nam', 'Phúc', 'Tuấn'],
    Female: ['Anh', 'Chi', 'Hà', 'Hương', 'Lan', 'Linh', 'My', 'Ngân', 'Trang', 'Vy']
};
const ASCII = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

const CLASSES = [
    { class_id: 'IT01', faculty: 'Information Technology', prefix: '2201', from: 1 },
    { class_id: 'IT02', faculty: 'Information Technology', prefix: '2201', from: 11 },
    { class_id: 'BA01', faculty: 'Business Administration', prefix: '2202', from: 1 },
    { class_id: 'BA02', faculty: 'Business Administration', prefix: '2202', from: 11 }
];

const COURSES = [
    { course_id: 'GE101', course_name: 'English 1', credits: 2, faculty: 'General Education' },
    { course_id: 'GE102', course_name: 'Calculus', credits: 3, faculty: 'General Education' },
    { course_id: 'CS101', course_name: 'Introduction to Programming', credits: 3, faculty: 'Information Technology' },
    { course_id: 'CS102', course_name: 'Data Structures', credits: 3, faculty: 'Information Technology' },
    { course_id: 'CS201', course_name: 'Databases', credits: 4, faculty: 'Information Technology' },
    { course_id: 'CS202', course_name: 'Computer Networks', credits: 3, faculty: 'Information Technology' },
    { course_id: 'BA101', course_name: 'Principles of Management', credits: 3, faculty: 'Business Administration' },
    { course_id: 'BA102', course_name: 'Microeconomics', credits: 3, faculty: 'Business Administration' },
    { course_id: 'BA201', course_name: 'Marketing', credits: 4, faculty: 'Business Administration' },
    { course_id: 'BA202', course_name: 'Business Statistics', credits: 3, faculty: 'Business Administration' }
];

const PLAN: Record<string, Record<string, string[]>> = {
    'Information Technology': { '2024-1': ['GE101', 'GE102', 'CS101'], '2024-2': ['CS102', 'CS201'], '2025-1': ['CS202'] },
    'Business Administration': { '2024-1': ['GE101', 'GE102', 'BA101'], '2024-2': ['BA102', 'BA201'], '2025-1': ['BA202'] }
};

const students: Record<string, unknown>[] = [];
const grades: Record<string, unknown>[] = [];

for (const cls of CLASSES) {
    for (let n = 0; n < 10; n++) {
        const gender = random() < 0.5 ? 'Male' : 'Female';
        const family = pick(FAMILY);
        const given = pick(GIVEN[gender]);
        const student_id = `${cls.prefix}${String(cls.from + n).padStart(3, '0')}`;
        students.push({
            student_id,
            full_name: `${family} ${pick(MIDDLE[gender])} ${given}`,
            gender,
            date_of_birth: `2004-${String(1 + Math.floor(random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(random() * 28)).padStart(2, '0')}`,
            class_id: cls.class_id,
            faculty: cls.faculty,
            enrollment_year: 2022,
            email: `${ASCII(given)}.${student_id}@example.edu.vn`
        });

        // Every 5th student is weak, so the data contains F grades and retakes.
        const ability = n % 5 === 4 ? 3.2 + random() * 1.2 : 6 + random() * 3.2;
        const failed: string[] = [];
        for (const [semester, courseIds] of Object.entries(PLAN[cls.faculty])) {
            const retakes = semester === '2025-1' ? failed.splice(0) : [];
            for (const course_id of [...courseIds, ...retakes]) {
                const level = retakes.includes(course_id) ? Math.max(ability, 6) + 0.8 : ability;
                const process_score = score(level + 0.5 + noise(1.2));
                const final_score = score(level + noise(1.8));
                grades.push({ student_id, course_id, semester, process_score, final_score });
                if (semester !== '2025-1' && Math.round((process_score * 0.4 + final_score * 0.6) * 10) / 10 < 4) failed.push(course_id);
            }
        }
    }
}

// Deliberately invalid rows — the server must detect and skip them (see README_data.md).
const injectedStudents = [{ ...students[0], full_name: 'Duplicate Row' }];
const injectedGrades = [
    { student_id: '2201002', course_id: 'CS101', semester: '2025-1', process_score: 11.5, final_score: 8 },
    { student_id: '2201003', course_id: 'CS202', semester: '2025-2', process_score: 7, final_score: '' },
    { student_id: '2299999', course_id: 'CS101', semester: '2024-1', process_score: 8, final_score: 8 },
    { student_id: '2202004', course_id: 'CS999', semester: '2024-1', process_score: 6, final_score: 7 },
    { student_id: '2202005', course_id: 'BA202', semester: '2025-2', process_score: -1, final_score: 6 },
    { ...grades[0] }
];

const dir = path.join(PROJECT_ROOT, 'data', 'sample');
mkdirSync(dir, { recursive: true });
const write = (file: string, rows: Record<string, unknown>[]) => writeFileSync(path.join(dir, file), toCsv(Object.keys(rows[0]), rows));
write('students.csv', [...students, ...injectedStudents]);
write('courses.csv', COURSES);
write('grades.csv', [...grades, ...injectedGrades]);

const firstInjectedLine = grades.length + 2;
writeFileSync(
    path.join(dir, 'README_data.md'),
    `# SAMPLE dataset (temporary — generated by scripts/generate-sample-data.ts)

Replace with the team's real data in \`data/real/\` and point \`config/academic.json → dataDir\` at it.

| File | Rows | Columns |
| --- | --- | --- |
| students.csv | ${students.length} (+1 injected) | student_id, full_name, gender, date_of_birth, class_id, faculty, enrollment_year, email |
| courses.csv | ${COURSES.length} | course_id, course_name, credits, faculty |
| grades.csv | ${grades.length} (+${injectedGrades.length} injected) | student_id, course_id, semester, process_score, final_score |

Every 5th student in each class is a weak student; their F grades are retaken in semester 2025-1.

## Injected invalid rows (the server must skip and report them)

| File | Line | Problem |
| --- | --- | --- |
| students.csv | ${students.length + 2} | duplicate student_id ${String(students[0].student_id)} |
| grades.csv | ${firstInjectedLine} | process_score 11.5 (> 10) |
| grades.csv | ${firstInjectedLine + 1} | missing final_score |
| grades.csv | ${firstInjectedLine + 2} | unknown student_id 2299999 |
| grades.csv | ${firstInjectedLine + 3} | unknown course_id CS999 |
| grades.csv | ${firstInjectedLine + 4} | process_score -1 (< 0) |
| grades.csv | ${firstInjectedLine + 5} | duplicate of line 2 |
`
);

console.log(`Sample data written to ${path.relative(PROJECT_ROOT, dir)}: ${students.length} students, ${COURSES.length} courses, ${grades.length} grades`);
