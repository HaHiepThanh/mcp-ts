/**
 * S11 — the third server `finance` (tuition, scholarships, lecturer pay). FAKE amounts.
 * Read-only tools; every decision (eligibility, pay) is computed in code.
 */
import { createFinanceServer } from '../../src/server/finance/server';
import { callSets } from '../_calls';
import { connectInProcess, Example } from '../_harness';

const ex = new Example('s11-finance', 'S11 · Finance server: tuition_status, check_scholarship_eligibility, rank_scholarship_candidates, calculate_teacher_pay', [
    'registerTool',
    'client.listTools',
    'client.callTool'
]);
const { client, close } = await connectInProcess(createFinanceServer);

await ex.run('tools of the finance server', 'listTools', undefined, () => client.listTools(), r => r.tools.map(t => ({ name: t.name, readOnly: t.annotations?.readOnlyHint })));

ex.section('tuition_status');
await callSets(ex, client, [
    ['all semesters, planted debt in 2025-1', 'tuition_status', { student_id: '2201001' }],
    ['one semester, paid in full', 'tuition_status', { student_id: '2201002', semester: '2025-1' }],
    ['unknown student → isError', 'tuition_status', { student_id: '9999999' }]
]);

ex.section('check_scholarship_eligibility');
await callSets(ex, client, [
    ['good GPA but tuition not paid → not eligible', 'check_scholarship_eligibility', { student_id: '2201001', semester: '2025-1', scholarship_id: 'MERIT-A' }],
    ['all scholarships at once', 'check_scholarship_eligibility', { student_id: '2201002', semester: '2025-1' }],
    ['unknown scholarship → isError', 'check_scholarship_eligibility', { student_id: '2201002', semester: '2025-1', scholarship_id: 'GOLD' }]
]);

ex.section('rank_scholarship_candidates');
await callSets(ex, client, [
    ['IT faculty, MERIT-A', 'rank_scholarship_candidates', { faculty: 'Information Technology', semester: '2025-1', scholarship_id: 'MERIT-A' }],
    ['BA faculty, MERIT-B', 'rank_scholarship_candidates', { faculty: 'Business Administration', semester: '2025-1', scholarship_id: 'MERIT-B' }],
    ['unknown faculty → isError', 'rank_scholarship_candidates', { faculty: 'Medicine', semester: '2025-1', scholarship_id: 'MERIT-A' }]
]);

ex.section('calculate_teacher_pay');
await callSets(ex, client, [
    ['lecturer over the quota → overtime pay', 'calculate_teacher_pay', { teacher_id: 'T02', month: '2025-10' }],
    ['December includes the bonus', 'calculate_teacher_pay', { teacher_id: 'T07', month: '2025-12' }],
    ['month without payroll → isError', 'calculate_teacher_pay', { teacher_id: 'T02', month: '2024-10' }],
    ['bad month format → rejected by inputSchema', 'calculate_teacher_pay', { teacher_id: 'T02', month: 'October' }]
]);

await close();
ex.save();
