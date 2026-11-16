/**
 * S9 — phase-2 tools on lecturers and sections (academic server):
 * search_teachers, teacher_workload, class_timetable — valid, edge-case and invalid parameter sets.
 */
import { createAcademicServer } from '../../src/server/academic/server';
import { callSets } from '../_calls';
import { connectInProcess, Example } from '../_harness';

const ex = new Example('s9-teachers', 'S9 · Lecturers and sections: search_teachers, teacher_workload, class_timetable', ['registerTool', 'client.callTool']);
const { client, close } = await connectInProcess(createAcademicServer);

ex.section('search_teachers');
await callSets(ex, client, [
    ['by faculty', 'search_teachers', { faculty: 'Business Administration' }],
    ['by ID (case-insensitive)', 'search_teachers', { keyword: 't02' }],
    ['no match → empty list (not an error)', 'search_teachers', { keyword: 'Einstein' }]
]);

ex.section('teacher_workload');
await callSets(ex, client, [
    ['over the quota (planted)', 'teacher_workload', { teacher_id: 'T02', semester: '2025-1' }],
    ['normal load', 'teacher_workload', { teacher_id: 'T07', semester: '2025-1' }],
    ['unknown lecturer → isError', 'teacher_workload', { teacher_id: 'T99', semester: '2025-1' }],
    ['bad semester format → rejected by inputSchema', 'teacher_workload', { teacher_id: 'T02', semester: '2025' }]
]);

ex.section('class_timetable');
await callSets(ex, client, [
    ['IT01, first semester', 'class_timetable', { class_id: 'IT01', semester: '2024-1' }],
    ['lower-case class ID is accepted', 'class_timetable', { class_id: 'ba02', semester: '2024-2' }],
    ['semester without data → isError', 'class_timetable', { class_id: 'IT01', semester: '2030-1' }]
]);

await close();
ex.save();
