/**
 * S11 — the `finance` server: every tool with valid / edge / invalid parameter sets.
 *   tuition_status, outstanding_tuition               student tuition
 *   check_scholarship_eligibility,
 *   rank_scholarship_candidates                        rules computed by code (GPA, conduct, tuition paid, no owed course)
 *   calculate_teacher_pay, payroll_summary             pay from payroll.csv + the teacher's sections
 *   approve_payroll                                    the only tool that changes state → elicitation, both protocol eras
 * Read-only tools run on the 2026 era; approve_payroll runs on both eras, like update_grade in S7.
 * Needs data/sample-finance/ (npm run data:finance) and teachers.csv / sections.csv / conduct.csv.
 */
import type { ElicitResult } from '@modelcontextprotocol/client';

import { getAcademicData } from '../../src/server/academic/data';
import { createFinanceServer } from '../../src/server/finance/server';
import { connectInProcess, type Era, Example, firstText } from '../_harness';

const ex = new Example('s11-finance', 'S11 · The finance server: 7 tools × valid / edge / invalid parameters', [
    'registerTool (outputSchema, READ_ONLY annotations)',
    'callTool',
    'ctx.mcpReq.elicitInput (2025)',
    'inputRequired / inputResponse (2026)',
    "client.setRequestHandler('elicitation/create')"
]);

// Teacher IDs come from teachers.csv, so the example keeps working when the team's real data replaces the sample.
const teacherIds = (getAcademicData().tables.get('teachers')?.rows ?? []).map(r => r.teacher_id);
const teacherA = teacherIds[0] ?? 'T001';
const teacherB = teacherIds[1] ?? 'T002';

type Client = Awaited<ReturnType<typeof connectInProcess>>['client'];

/** One tool call, printed and recorded. Errors (isError results) never stop the example. */
const tool = (client: Client, step: string, name: string, args: Record<string, unknown>) => {
    const params = { name, arguments: args };
    return ex.run(step, 'callTool', params, () => client.callTool(params), r =>
        r.isError ? { isError: true, text: firstText(r) } : { isError: false, data: r.structuredContent ?? firstText(r) }
    );
};

// ── Read-only tools (2026 era) ──────────────────────────────────────
{
    const { client, close } = await connectInProcess(createFinanceServer, { era: 'modern' });

    ex.section('tuition_status');
    await tool(client, 'valid · one semester', 'tuition_status', { student_id: '2201005', semester: '2025-1' });
    await tool(client, 'valid · semester omitted → every semester', 'tuition_status', { student_id: '2201005' });
    await tool(client, 'edge · well-formed semester without a tuition record', 'tuition_status', { student_id: '2201005', semester: '2030-1' });
    await tool(client, 'invalid · unknown student', 'tuition_status', { student_id: '9999999', semester: '2025-1' });
    await tool(client, 'invalid · semester is not YYYY-N (schema rejects it)', 'tuition_status', { student_id: '2201005', semester: '2025/1' });

    ex.section('outstanding_tuition');
    await tool(client, 'valid · faculty + semester', 'outstanding_tuition', { faculty: 'Information Technology', semester: '2025-1' });
    await tool(client, 'valid · class, all semesters', 'outstanding_tuition', { class_id: 'IT01' });
    await tool(client, 'edge · class ID in lower case, limit 3', 'outstanding_tuition', { class_id: 'it01', limit: 3 });
    await tool(client, 'invalid · neither class_id nor faculty', 'outstanding_tuition', {});
    await tool(client, 'invalid · both class_id and faculty', 'outstanding_tuition', { class_id: 'IT01', faculty: 'Information Technology' });
    await tool(client, 'invalid · unknown class', 'outstanding_tuition', { class_id: 'XX99' });
    await tool(client, 'invalid · limit above the maximum (50)', 'outstanding_tuition', { class_id: 'IT01', limit: 500 });

    ex.section('check_scholarship_eligibility');
    await tool(client, 'valid · student with grades in 2024-1', 'check_scholarship_eligibility', { student_id: '2201010', semester: '2024-1' });
    await tool(client, 'valid · another student, later semester', 'check_scholarship_eligibility', { student_id: '2201005', semester: '2024-2' });
    await tool(client, 'edge · semester that has no grades at all', 'check_scholarship_eligibility', { student_id: '2201005', semester: '2030-1' });
    await tool(client, 'invalid · unknown student', 'check_scholarship_eligibility', { student_id: '9999999', semester: '2024-1' });
    await tool(client, 'invalid · missing semester (schema rejects it)', 'check_scholarship_eligibility', { student_id: '2201010' });

    ex.section('rank_scholarship_candidates');
    await tool(client, 'valid · IT faculty, SCH02', 'rank_scholarship_candidates', { faculty: 'Information Technology', semester: '2024-2', scholarship_id: 'SCH02' });
    await tool(client, 'edge · partial faculty name, limit 3', 'rank_scholarship_candidates', { faculty: 'Business', semester: '2024-1', scholarship_id: 'SCH01', limit: 3 });
    await tool(client, 'edge · scholarship ID in lower case, latest semester', 'rank_scholarship_candidates', { faculty: 'Information Technology', semester: '2025-1', scholarship_id: 'sch03' });
    await tool(client, 'invalid · unknown scholarship', 'rank_scholarship_candidates', { faculty: 'Information Technology', semester: '2024-2', scholarship_id: 'SCH99' });
    await tool(client, 'invalid · unknown faculty', 'rank_scholarship_candidates', { faculty: 'Law', semester: '2024-2', scholarship_id: 'SCH02' });

    ex.section('calculate_teacher_pay');
    await tool(client, 'valid · month inside semester 2024-1', 'calculate_teacher_pay', { teacher_id: teacherA, month: '2024-10' });
    await tool(client, 'edge · January belongs to the previous calendar year\'s semester 1', 'calculate_teacher_pay', { teacher_id: teacherA, month: '2025-01' });
    await tool(client, 'valid · second teacher, semester 2024-2', 'calculate_teacher_pay', { teacher_id: teacherB, month: '2025-03' });
    await tool(client, 'invalid · unknown teacher', 'calculate_teacher_pay', { teacher_id: 'T999', month: '2024-10' });
    await tool(client, 'invalid · month without a payroll record', 'calculate_teacher_pay', { teacher_id: teacherA, month: '2031-01' });
    await tool(client, 'invalid · month is not YYYY-MM (schema rejects it)', 'calculate_teacher_pay', { teacher_id: teacherA, month: '2024-13' });

    ex.section('payroll_summary');
    await tool(client, 'valid · all faculties', 'payroll_summary', { month: '2024-10' });
    await tool(client, 'valid · one faculty, limit 3', 'payroll_summary', { month: '2024-10', faculty: 'Information Technology', limit: 3 });
    await tool(client, 'edge · month in semester 2024-2', 'payroll_summary', { month: '2025-03' });
    await tool(client, 'invalid · month without payroll', 'payroll_summary', { month: '2031-01' });
    await tool(client, 'invalid · unknown faculty', 'payroll_summary', { month: '2024-10', faculty: 'Law' });

    await close();
}

// ── approve_payroll: always asks the user (elicitation), both eras ──
const ANSWERS: { label: string; answer: ElicitResult; month: string }[] = [
    { label: 'accept + confirm=true → approved', answer: { action: 'accept', content: { confirm: true } }, month: '2024-10' },
    { label: 'same payroll again → already approved, no question asked', answer: { action: 'accept', content: { confirm: true } }, month: '2024-10' },
    { label: 'decline → NOT approved', answer: { action: 'decline' }, month: '2024-11' },
    { label: 'cancel (closed the dialog) → NOT approved', answer: { action: 'cancel' }, month: '2024-12' },
    { label: 'accept + confirm=false → NOT approved', answer: { action: 'accept', content: { confirm: false } }, month: '2025-01' }
];

for (const era of ['legacy', 'modern'] as Era[]) {
    ex.section(`approve_payroll · ${era === 'legacy' ? '2025 era (push)' : '2026-07-28 era (inputRequired + retry)'}`);
    // Each era uses its own teacher so the in-memory approvals of the two runs never collide.
    const teacher = era === 'legacy' ? teacherA : teacherB;
    let next: ElicitResult = ANSWERS[0].answer;
    const asked: string[] = [];
    const { client, close } = await connectInProcess(createFinanceServer, {
        era,
        capabilities: { elicitation: { form: {} } },
        setup: c =>
            c.setRequestHandler('elicitation/create', async request => {
                asked.push(request.params.message);
                return next;
            })
    });
    for (const { label, answer, month } of ANSWERS) {
        next = answer;
        asked.length = 0;
        const params = { name: 'approve_payroll', arguments: { teacher_id: teacher, month } };
        await ex.run(`approve_payroll · user answers: ${label}`, 'callTool', params, () => client.callTool(params), r => ({
            questionShownToUser: asked[0] ?? '(no question)',
            isError: r.isError ?? false,
            text: firstText(r)
        }));
    }
    await tool(client, 'invalid · unknown teacher (no question is asked)', 'approve_payroll', { teacher_id: 'T999', month: '2024-10' });
    await tool(client, 'invalid · month is not YYYY-MM (schema rejects it)', 'approve_payroll', { teacher_id: teacher, month: '10/2024' });
    await close();
}

ex.section('approve_payroll · client WITHOUT the elicitation capability');
{
    const { client, close } = await connectInProcess(createFinanceServer, { era: 'legacy', capabilities: {} });
    await tool(client, '2025 era: cannot ask for confirmation → nothing is approved', 'approve_payroll', { teacher_id: teacherA, month: '2025-02' });
    await close();
}
{
    const { client, close } = await connectInProcess(createFinanceServer, { era: 'modern', capabilities: {} });
    await tool(client, '2026 era: missing capability is rejected by the SDK (-32021)', 'approve_payroll', { teacher_id: teacherA, month: '2025-03' });
    await close();
}

ex.save();
