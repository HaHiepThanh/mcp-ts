/**
 * Prompts of the `academic` server — message templates the END USER picks (e.g. a slash command).
 *
 *   class_report(class_id, semester?)   report on a class, with autocompletion for both arguments
 *   study_advice(student_id)            advice for one student, embeds the student-profile resource
 */
import { completable, type McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';

import type { AcademicData } from './data';

export function registerAcademicPrompts(server: McpServer, data: AcademicData): void {
    server.registerPrompt(
        'class_report',
        {
            title: 'Class performance report',
            description: 'Ask the assistant for a structured performance report of one class',
            argsSchema: z.object({
                class_id: completable(z.string().describe('Class ID, e.g. "IT01"'), value =>
                    data.classes().filter(c => c.toLowerCase().startsWith(value.toLowerCase()))
                ),
                semester: completable(z.string().optional().describe('Semester, e.g. "2024-1"; empty = all semesters'), value =>
                    data.semesters().filter(s => s.startsWith(value ?? ''))
                )
            })
        },
        ({ class_id, semester }) => ({
            messages: [
                {
                    role: 'user' as const,
                    content: {
                        type: 'text' as const,
                        text:
                            `Write a performance report for class ${class_id} (${semester ? `semester ${semester}` : 'all semesters'}).\n` +
                            'Use the tools class_statistics and rank_students (and calculate_gpa when needed). The report must include:\n' +
                            '1. Overview: number of students, average course total, pass rate, average GPA\n' +
                            '2. Letter-grade distribution (A/B/C/D/F)\n' +
                            '3. Top 3 students with GPA\n' +
                            '4. Students at risk (cumulative GPA below 2.0)\n' +
                            '5. Two concrete recommendations\n' +
                            'Format it as Markdown. If a save_report tool is available, save the report as well.'
                    }
                }
            ]
        })
    );

    server.registerPrompt(
        'study_advice',
        {
            title: 'Study advice for a student',
            description: "Personal study advice based on the student's profile and grades",
            argsSchema: z.object({
                student_id: completable(z.string().describe('Student ID, e.g. "2201005"'), value =>
                    [...data.students.keys()].filter(id => id.startsWith(value)).slice(0, 20)
                )
            })
        },
        ({ student_id }) => {
            const student = data.students.get(student_id);
            const profile = student
                ? JSON.stringify({ ...student, cumulative: data.gpaOf(student_id) }, null, 2)
                : JSON.stringify({ error: `Unknown student ${student_id}` });
            return {
                messages: [
                    {
                        role: 'user' as const,
                        content: {
                            type: 'resource' as const,
                            resource: { uri: `academic://students/${student_id}`, mimeType: 'application/json', text: profile }
                        }
                    },
                    {
                        role: 'user' as const,
                        content: {
                            type: 'text' as const,
                            text:
                                'You are an academic advisor. Using the profile above and the get_transcript tool, ' +
                                'give this student 3 specific pieces of study advice: which courses to prioritise, ' +
                                'whether any course should be retaken, and a realistic GPA target for next semester.'
                        }
                    }
                ]
            };
        }
    );
}
