/**
 * S10 — Attendance, Conduct & At-Risk Students (Hoàng's Phase 2 additions)
 * Tests attendance_summary, conduct_score, and at_risk_students with valid, edge-case, and invalid parameter sets.
 */
import { createAcademicServer } from '../../src/server/academic/server';
import { connectInProcess, Example, firstText } from '../_harness';

const ex = new Example(
    's10-attendance-conduct',
    'S10 · Hoàng: Attendance, Conduct & At-Risk Students Tools',
    ['attendance_summary', 'conduct_score', 'at_risk_students']
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

// ── 1. attendance_summary ───────────────────────────────────────────
ex.section('1 — Tool: attendance_summary (valid, filtered by semester, edge-case invalid)');

await call('Valid student attendance (all semesters)', 'attendance_summary', { student_id: '2201001' });
await call('Valid section attendance for semester 2024-1', 'attendance_summary', { section_id: 'SEC001', semester: '2024-1' });
await call('Invalid student ID', 'attendance_summary', { student_id: '9999999' });

// ── 2. conduct_score ────────────────────────────────────────────────
ex.section('2 — Tool: conduct_score (all semesters, single semester, non-existent student)');

await call('Student conduct across all recorded semesters', 'conduct_score', { student_id: '2201002' });
await call('Student conduct for semester 2024-2', 'conduct_score', { student_id: '2201005', semester: '2024-2' });
await call('Invalid conduct query (student not found)', 'conduct_score', { student_id: '2209999' });

// ── 3. at_risk_students ─────────────────────────────────────────────
ex.section('3 — Tool: at_risk_students (class filter, faculty filter, empty match)');

await call('At-risk students in class IT01', 'at_risk_students', { class_id: 'IT01' });
await call('At-risk students in Business Administration faculty (semester 2024-1)', 'at_risk_students', { faculty: 'Business Administration', semester: '2024-1' });
await call('Non-existent class query', 'at_risk_students', { class_id: 'NONEXISTENT' });

await ex.save();
await close();
