/**
 * Phase-2 tools of the `academic` server — teachers, sections, attendance and conduct.
 *
 *   search_teachers     find lecturers by name / faculty
 *   teacher_workload    sections and teaching periods of one lecturer vs the quota
 *   class_timetable     weekly timetable of one class
 *   attendance_summary  absences per course and the exam-ban rule
 *   at_risk_students    students to warn, each with the reasons (GPA, exam ban, conduct)
 *
 * Every threshold comes from config/academic-rules.json.
 */
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';

import { fail, fold, structured } from '../../lib/results';
import type { AcademicData } from './data';

const semester = z
    .string()
    .regex(/^\d{4}-\d$/, 'Semester must look like 2024-1')
    .describe('Semester code "YYYY-N", e.g. "2025-1"');
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function registerTeachingTools(server: McpServer, data: AcademicData): void {
    const rules = data.rules;
    if (!rules || data.teachers.size === 0) return; // phase-1 dataset: nothing to register
    const knownSemester = (s: string) => data.semesters().includes(s);
    const badSemester = (s: string) => fail(`No data for semester "${s}". Known semesters: ${data.semesters().join(', ')}.`);

    server.registerTool(
        'search_teachers',
        {
            title: 'Search lecturers',
            description: 'Find lecturers by name or ID (case- and accent-insensitive), optionally by faculty. Returns title, degree and the courses they teach.',
            inputSchema: z.object({
                keyword: z.string().optional().describe('Part of the name or teacher ID, e.g. "Lan" or "T05"'),
                faculty: z.string().optional().describe('Faculty, e.g. "Information Technology"')
            }),
            outputSchema: z.object({
                total_matches: z.number(),
                teachers: z.array(z.object({ teacher_id: z.string(), full_name: z.string(), faculty: z.string(), title: z.string(), degree: z.string(), courses: z.array(z.string()) }))
            }),
            annotations: READ_ONLY
        },
        async ({ keyword, faculty }) => {
            const needle = keyword ? fold(keyword) : undefined;
            const teachers = [...data.teachers.values()]
                .filter(t => (!needle || fold(t.full_name).includes(needle) || fold(t.teacher_id).includes(needle)) && (!faculty || fold(t.faculty).includes(fold(faculty))))
                .map(t => ({
                    teacher_id: t.teacher_id,
                    full_name: t.full_name,
                    faculty: t.faculty,
                    title: t.title,
                    degree: t.degree,
                    courses: [...new Set([...data.sections.values()].filter(s => s.teacher_id === t.teacher_id).map(s => s.course_id))].sort()
                }));
            return structured({ total_matches: teachers.length, teachers });
        }
    );

    server.registerTool(
        'teacher_workload',
        {
            title: 'Teaching workload',
            description: `Sections a lecturer teaches in one semester, total teaching periods, the quota (${rules.teachingQuotaPeriodsPerSemester} periods) and overtime periods.`,
            inputSchema: z.object({ teacher_id: z.string().describe('Teacher ID, e.g. "T02"'), semester }),
            outputSchema: z.object({
                teacher_id: z.string(),
                full_name: z.string(),
                semester: z.string(),
                sections: z.array(z.object({ section_id: z.string(), course_id: z.string(), class_id: z.string(), periods: z.number() })),
                total_periods: z.number(),
                quota_periods: z.number(),
                overtime_periods: z.number()
            }),
            annotations: READ_ONLY
        },
        async ({ teacher_id, semester }) => {
            const teacher = data.teachers.get(teacher_id.trim().toUpperCase());
            if (!teacher) return fail(`No lecturer with teacher_id "${teacher_id}". Use search_teachers to find the right ID.`);
            if (!knownSemester(semester)) return badSemester(semester);
            const w = data.workloadOf(teacher.teacher_id, semester);
            return structured({
                teacher_id: teacher.teacher_id,
                full_name: teacher.full_name,
                semester,
                sections: w.sections.map(s => ({ section_id: s.section_id, course_id: s.course_id, class_id: s.class_id, periods: s.periods })),
                total_periods: w.total_periods,
                quota_periods: w.quota_periods,
                overtime_periods: w.overtime_periods
            });
        }
    );

    server.registerTool(
        'class_timetable',
        {
            title: 'Class timetable',
            description: 'Weekly timetable of one class in one semester: day, start period, course, room and lecturer of each section.',
            inputSchema: z.object({ class_id: z.string().describe('Class ID, e.g. "IT01"'), semester }),
            outputSchema: z.object({
                class_id: z.string(),
                semester: z.string(),
                sessions: z.array(
                    z.object({ weekday: z.string(), start_period: z.number(), course_id: z.string(), course_name: z.string(), room: z.string(), teacher_id: z.string(), teacher_name: z.string() })
                )
            }),
            annotations: READ_ONLY
        },
        async ({ class_id, semester }) => {
            const cls = data.classes().find(c => c.toLowerCase() === class_id.trim().toLowerCase());
            if (!cls) return fail(`Unknown class "${class_id}". Known classes: ${data.classes().join(', ')}.`);
            if (!knownSemester(semester)) return badSemester(semester);
            const sessions = [...data.sections.values()]
                .filter(s => s.class_id === cls && s.semester === semester)
                .sort((a, b) => WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday) || a.start_period - b.start_period)
                .map(s => ({
                    weekday: s.weekday,
                    start_period: s.start_period,
                    course_id: s.course_id,
                    course_name: data.courses.get(s.course_id)!.course_name,
                    room: s.room,
                    teacher_id: s.teacher_id,
                    teacher_name: data.teachers.get(s.teacher_id)!.full_name
                }));
            return structured({ class_id: cls, semester, sessions });
        }
    );

    server.registerTool(
        'attendance_summary',
        {
            title: 'Attendance summary',
            description:
                `Absences of one student per course in one semester. A student missing more than ${rules.attendance.maxAbsencePct}% of the ` +
                `${rules.attendance.weeksPerSection} weeks is banned from that exam (late and excused do not count).`,
            inputSchema: z.object({ student_id: z.string().describe('Student ID, e.g. "2201010"'), semester }),
            outputSchema: z.object({
                student_id: z.string(),
                full_name: z.string(),
                semester: z.string(),
                max_absence_pct: z.number(),
                courses: z.array(
                    z.object({
                        section_id: z.string(),
                        course_id: z.string(),
                        course_name: z.string(),
                        weeks_recorded: z.number(),
                        absent: z.number(),
                        late: z.number(),
                        excused: z.number(),
                        absence_pct: z.number(),
                        exam_banned: z.boolean()
                    })
                ),
                banned_courses: z.array(z.string())
            }),
            annotations: READ_ONLY
        },
        async ({ student_id, semester }) => {
            const student = data.students.get(student_id.trim());
            if (!student) return fail(`No student with student_id "${student_id}". Use search_students to find the right ID.`);
            if (!knownSemester(semester)) return badSemester(semester);
            const courses = data.attendanceOf(student.student_id, semester);
            return structured({
                student_id: student.student_id,
                full_name: student.full_name,
                semester,
                max_absence_pct: rules.attendance.maxAbsencePct,
                courses,
                banned_courses: courses.filter(c => c.exam_banned).map(c => c.course_id)
            });
        }
    );

    server.registerTool(
        'at_risk_students',
        {
            title: 'Students at academic risk',
            description:
                `Students of a class or faculty to warn in one semester, each with the reasons: semester GPA below ${rules.atRisk.gpaBelow}, ` +
                `banned from an exam for absences, or conduct score below ${rules.atRisk.conductBelow}.`,
            inputSchema: z.object({
                scope: z.enum(['class', 'faculty']).describe('Look at one class or one faculty'),
                value: z.string().describe('Class ID (e.g. "IT01") or faculty name'),
                semester
            }),
            outputSchema: z.object({
                scope: z.string(),
                value: z.string(),
                semester: z.string(),
                checked: z.number(),
                at_risk: z.array(
                    z.object({ student_id: z.string(), full_name: z.string(), class_id: z.string(), semester_gpa: z.number().nullable(), conduct: z.number().nullable(), reasons: z.array(z.string()) })
                )
            }),
            annotations: READ_ONLY
        },
        async ({ scope, value, semester }) => {
            if (!knownSemester(semester)) return badSemester(semester);
            const pool = [...data.students.values()].filter(s => (scope === 'class' ? s.class_id.toLowerCase() === value.trim().toLowerCase() : fold(s.faculty).includes(fold(value))));
            if (pool.length === 0) return fail(`No students for ${scope} "${value}". Known: ${(scope === 'class' ? data.classes() : data.faculties()).join(', ')}.`);
            const at_risk = pool.flatMap(s => {
                const gpa = data.gpaOf(s.student_id, semester).gpa;
                const conduct = data.conductOf(s.student_id, semester).score;
                const banned = data.attendanceOf(s.student_id, semester).filter(c => c.exam_banned);
                const reasons = [
                    gpa !== null && gpa < rules.atRisk.gpaBelow && `semester GPA ${gpa} < ${rules.atRisk.gpaBelow}`,
                    rules.atRisk.anyExamBan && banned.length > 0 && `banned from exam: ${banned.map(c => `${c.course_id} (${c.absence_pct}% absent)`).join(', ')}`,
                    conduct !== null && conduct < rules.atRisk.conductBelow && `conduct ${conduct} < ${rules.atRisk.conductBelow}`
                ].filter((r): r is string => Boolean(r));
                return reasons.length ? [{ student_id: s.student_id, full_name: s.full_name, class_id: s.class_id, semester_gpa: gpa, conduct, reasons }] : [];
            });
            return structured({ scope, value, semester, checked: pool.length, at_risk });
        }
    );
}
