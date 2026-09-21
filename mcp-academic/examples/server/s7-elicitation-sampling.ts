/**
 * S7 — the server asks the CLIENT for something in the middle of a tool call.
 *   Elicitation: update_grade asks the end user to confirm (accept / decline / cancel).
 *   Sampling   : generate_student_feedback borrows the host's LLM (mocked here; real Gemini in M3).
 * Same tool code, both protocol eras:
 *   2025 era  → ctx.mcpReq.elicitInput / requestSampling (server pushes a request)
 *   2026 era  → return inputRequired(...) → client answers → client retries the call
 */
import type { ElicitResult } from '@modelcontextprotocol/client';

import { createAcademicServer } from '../../src/server/academic/server';
import { connectInProcess, type Era, Example, firstText } from '../_harness';

const ex = new Example('s7-elicitation-sampling', 'S7 · Server → client requests: elicitation & sampling (both eras)', [
    'ctx.mcpReq.elicitInput (2025)',
    'ctx.mcpReq.requestSampling (2025)',
    'inputRequired / inputResponse (2026)',
    "client.setRequestHandler('elicitation/create')",
    "client.setRequestHandler('sampling/createMessage')"
]);

const USER_ANSWERS: { label: string; answer: ElicitResult }[] = [
    { label: 'accept + confirm=true', answer: { action: 'accept', content: { confirm: true } } },
    { label: 'accept + confirm=false', answer: { action: 'accept', content: { confirm: false } } },
    { label: 'decline', answer: { action: 'decline' } },
    { label: 'cancel (closed the dialog)', answer: { action: 'cancel' } }
];

// Each run uses a different semester so the (in-memory) updates never collide.
const update = (semester: string) => ({
    name: 'update_grade',
    arguments: { student_id: '2201005', course_id: 'CS202', semester, process_score: 8, final_score: 7.5 }
});

for (const era of ['legacy', 'modern'] as Era[]) {
    ex.section(`${era === 'legacy' ? '2025 era (push)' : '2026-07-28 era (inputRequired + retry)'} — elicitation`);
    let next: ElicitResult = USER_ANSWERS[0].answer;
    const asked: string[] = [];
    const { client, close } = await connectInProcess(createAcademicServer, {
        era,
        capabilities: { elicitation: { form: {} }, sampling: {} },
        setup: c => {
            c.setRequestHandler('elicitation/create', async request => {
                asked.push(request.params.message);
                return next;
            });
            c.setRequestHandler('sampling/createMessage', async request => {
                const prompt = request.params.messages
                    .flatMap(m => (Array.isArray(m.content) ? m.content : [m.content]))
                    .map(block => (block.type === 'text' ? block.text : ''))
                    .join('\n');
                return {
                    role: 'assistant',
                    model: 'mock-llm (replaced by Gemini in M3)',
                    content: { type: 'text', text: `[mock] Received a ${prompt.length}-character prompt; system: "${request.params.systemPrompt}".` }
                };
            });
        }
    });

    for (const [i, { label, answer }] of USER_ANSWERS.entries()) {
        next = answer;
        asked.length = 0;
        const params = update(`2030-${i + (era === 'modern' ? 5 : 1)}`);
        await ex.run(`update_grade · user answers "${label}"`, 'callTool', params, () => client.callTool(params), r => ({
            questionShownToUser: asked[0],
            isError: r.isError ?? false,
            text: firstText(r)
        }));
    }

    ex.section(`${era} — sampling`);
    for (const tone of ['encouraging', 'formal'] as const) {
        const params = { name: 'generate_student_feedback', arguments: { student_id: '2201010', tone } };
        await ex.run(`generate_student_feedback · tone=${tone}`, 'callTool', params, () => client.callTool(params), r => ({ isError: r.isError ?? false, text: firstText(r) }));
    }
    await close();
}

ex.section('Client WITHOUT elicitation / sampling capabilities');
{
    const { client, close } = await connectInProcess(createAcademicServer, { era: 'legacy', capabilities: {} });
    const params = update('2030-9');
    await ex.run('update_grade → cannot ask for confirmation, nothing changes', 'callTool', params, () => client.callTool(params), r => ({
        isError: r.isError ?? false,
        text: firstText(r)
    }));
    const feedback = { name: 'generate_student_feedback', arguments: { student_id: '2201010' } };
    await ex.run('generate_student_feedback → no LLM to borrow', 'callTool', feedback, () => client.callTool(feedback), r => ({
        isError: r.isError ?? false,
        text: firstText(r)
    }));
    await close();
}
{
    const { client, close } = await connectInProcess(createAcademicServer, { era: 'modern', capabilities: {} });
    const params = update('2031-1');
    await ex.run('2026 era: missing capability is rejected by the SDK (-32021)', 'callTool', params, () => client.callTool(params), r => ({
        isError: r.isError ?? false,
        text: firstText(r)
    }));
    await close();
}

ex.save();
