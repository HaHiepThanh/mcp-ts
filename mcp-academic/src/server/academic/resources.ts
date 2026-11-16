/**
 * Resources of the `academic` server — read-only data the HOST (not the model) chooses to attach.
 *
 *   academic://rules/grading            static   grading rules (markdown)
 *   academic://reports/data-quality     static   invalid rows found while loading the CSVs
 *   academic://tables/{table}           template raw CSV of one table (listable, completable)
 *   academic://students/{student_id}    template one student's profile + GPA (completable)
 */
import { type McpServer, ResourceNotFoundError, ResourceTemplate } from '@modelcontextprotocol/server';

import { toCsv } from '../../lib/csv';
import type { AcademicData } from './data';

export const studentUri = (studentId: string): string => `academic://students/${studentId}`;

export function registerAcademicResources(server: McpServer, data: AcademicData): void {
    server.registerResource(
        'grading-rules',
        'academic://rules/grading',
        { title: 'Grading rules', description: 'How course totals, letter grades (A–F), 4-point values and GPA are computed', mimeType: 'text/markdown' },
        async uri => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: data.grading.describe() }] })
    );

    server.registerResource(
        'data-quality',
        'academic://reports/data-quality',
        { title: 'Data quality report', description: 'Rows skipped while loading the CSV files, with the reason', mimeType: 'application/json' },
        async uri => ({
            contents: [
                {
                    uri: uri.href,
                    mimeType: 'application/json',
                    text: JSON.stringify(
                        {
                            loaded: { students: data.students.size, courses: data.courses.size, grades: data.grades.length },
                            skipped: data.issues.length,
                            issues: data.issues
                        },
                        null,
                        2
                    )
                }
            ]
        })
    );

    server.registerResource(
        'table',
        new ResourceTemplate('academic://tables/{table}', {
            list: async () => ({
                resources: [...data.tables].map(([table, t]) => ({
                    uri: `academic://tables/${table}`,
                    name: `${table}.csv`,
                    description: `${t.rows.length} rows`,
                    mimeType: 'text/csv'
                }))
            }),
            complete: { table: value => [...data.tables.keys()].filter(t => t.startsWith(value)) }
        }),
        { title: 'CSV table', description: 'Raw content of one loaded CSV table', mimeType: 'text/csv' },
        async (uri, { table }) => {
            const t = data.tables.get(String(table));
            if (!t) throw new ResourceNotFoundError(uri.href, `Unknown table "${table}"`);
            return { contents: [{ uri: uri.href, mimeType: 'text/csv', text: toCsv(t.headers, t.rows) }] };
        }
    );

    server.registerResource(
        'student-profile',
        new ResourceTemplate('academic://students/{student_id}', {
            list: undefined, // too many to enumerate — clients build the URI or use completion
            complete: { student_id: value => [...data.students.keys()].filter(id => id.startsWith(value)).slice(0, 20) }
        }),
        { title: 'Student profile', description: 'Profile, cumulative GPA and per-semester GPA of one student', mimeType: 'application/json' },
        async (uri, { student_id }) => {
            const student = data.students.get(String(student_id));
            if (!student) throw new ResourceNotFoundError(uri.href, `Unknown student "${student_id}"`);
            const semesters = [...new Set(data.gradedCourses(student.student_id).map(c => c.semester))].sort();
            const profile = {
                ...student,
                cumulative: data.gpaOf(student.student_id),
                by_semester: Object.fromEntries(semesters.map(s => [s, data.gpaOf(student.student_id, s)]))
            };
            return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(profile, null, 2) }] };
        }
    );
}
