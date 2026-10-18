/**
 * S9 — Teachers, Sections & Timetable (Phú's Phase 2 additions)
 * Tests search_teachers, class_timetable, teacher_workload, and teacher_grade_report
 * with valid, edge-case, and invalid parameter sets.
 */
import { createAcademicServer } from '../../src/server/academic/server';
import { connectInProcess, Example, firstText } from '../_harness';

const ex = new Example(
    's9-teachers',
    'S9 · Phú: Teachers, Timetable, Workload & Teacher Grade Reports',
    ['search_teachers', 'class_timetable', 'teacher_workload', 'teacher_grade_report']
);

const { client, close } = await connectInProcess(createAcademicServer);

const call = (step: string, name: string, args: Record<string, unknown>) =>
    ex.run(
        step,
        'callTool',
        { name, arguments: args },
        () => client.callTool({ name, arguments: args }),
        r => (r.structuredContent ? { isError: r.isError ?? false, structuredContent: r.structuredContent } : { isError: r.isError ?? false, text: firstText(r) })
    );

// ── 1. search_teachers ──────────────────────────────────────────────
ex.section('1 — Tool: search_teachers (keyword, faculty filter, title filter, no match)');

await call('Search teachers by keyword "Lan"', 'search_teachers', { keyword: 'Lan' });
await call('Search teachers in Information Technology faculty', 'search_teachers', { faculty: 'Information Technology', limit: 5 });
await call('Search teachers with non-existent keyword', 'search_teachers', { keyword: 'XYZNOTFOUND' });

// ── 2. class_timetable ──────────────────────────────────────────────
ex.section('2 — Tool: class_timetable (valid class semester, edge-case semester, invalid class)');

await call('Class IT01 timetable for semester 2024-1', 'class_timetable', { class_id: 'IT01', semester: '2024-1' });
await call('Class BA01 timetable for semester 2024-2', 'class_timetable', { class_id: 'BA01', semester: '2024-2' });
await call('Non-existent class timetable', 'class_timetable', { class_id: 'UNKNOWN_CLASS', semester: '2024-1' });

// ── 3. teacher_workload ─────────────────────────────────────────────
ex.section('3 — Tool: teacher_workload (valid teacher semester, semester with no teaching, invalid teacher)');

await call('Teacher T001 workload in semester 2024-1', 'teacher_workload', { teacher_id: 'T001', semester: '2024-1' });
await call('Teacher T002 workload in semester 2025-1', 'teacher_workload', { teacher_id: 'T002', semester: '2025-1' });
await call('Invalid teacher ID workload query', 'teacher_workload', { teacher_id: 'T999', semester: '2024-1' });

// ── 4. teacher_grade_report ─────────────────────────────────────────
ex.section('4 — Tool: teacher_grade_report (all semesters, single semester, invalid teacher)');

await call('Teacher T005 overall grade report across all semesters', 'teacher_grade_report', { teacher_id: 'T005' });
await call('Teacher T005 grade report in semester 2024-1', 'teacher_grade_report', { teacher_id: 'T005', semester: '2024-1' });
await call('Invalid teacher grade report query', 'teacher_grade_report', { teacher_id: 'T999' });

await ex.save();
await close();
