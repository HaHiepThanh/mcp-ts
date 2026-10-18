/**
 * S10 — attendance, conduct and academic-risk tools + the advisor_meeting prompt (academic server).
 * Thresholds come from config/academic-rules.json.
 */
import { createAcademicServer } from '../../src/server/academic/server';
import { callSets } from '../_calls';
import { connectInProcess, Example } from '../_harness';

const ex = new Example('s10-attendance-conduct', 'S10 · Attendance, conduct, at_risk_students, prompt advisor_meeting', ['registerTool', 'registerPrompt', 'client.callTool', 'client.getPrompt']);
const { client, close } = await connectInProcess(createAcademicServer);

ex.section('attendance_summary');
await callSets(ex, client, [
    ['banned from one exam (planted 4/15 absences)', 'attendance_summary', { student_id: '2201010', semester: '2025-1' }],
    ['good attendance', 'attendance_summary', { student_id: '2201001', semester: '2025-1' }],
    ['unknown student → isError', 'attendance_summary', { student_id: '9999999', semester: '2025-1' }]
]);

ex.section('at_risk_students');
await callSets(ex, client, [
    ['one class', 'at_risk_students', { scope: 'class', value: 'IT01', semester: '2025-1' }],
    ['whole faculty', 'at_risk_students', { scope: 'faculty', value: 'Business Administration', semester: '2025-1' }],
    ['unknown class → isError', 'at_risk_students', { scope: 'class', value: 'XX99', semester: '2025-1' }],
    ['scope not in the enum → rejected by inputSchema', 'at_risk_students', { scope: 'school', value: 'all', semester: '2025-1' }]
]);

ex.section('Prompt advisor_meeting');
await ex.run('advisor_meeting with both arguments', 'getPrompt', { name: 'advisor_meeting', arguments: { student_id: '2201010', semester: '2025-1' } }, () =>
    client.getPrompt({ name: 'advisor_meeting', arguments: { student_id: '2201010', semester: '2025-1' } })
);
await ex.run('advisor_meeting missing semester → ProtocolError', 'getPrompt', { name: 'advisor_meeting', arguments: { student_id: '2201010' } }, () =>
    client.getPrompt({ name: 'advisor_meeting', arguments: { student_id: '2201010' } })
);

ex.section('Data quality — phase-2 rows are validated too');
await ex.run('read academic://reports/data-quality', 'readResource', { uri: 'academic://reports/data-quality' }, () => client.readResource({ uri: 'academic://reports/data-quality' }), r => {
    const report = JSON.parse((r.contents[0] as { text: string }).text) as { issues?: { table: string; line: number; problem: string }[] };
    return report.issues?.map(i => `${i.table}:${i.line} ${i.problem}`) ?? report;
});

await close();
ex.save();
