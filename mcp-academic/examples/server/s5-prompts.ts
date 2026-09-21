/**
 * S5 — server.registerPrompt(name, config, callback) + completable()
 */
import { createAcademicServer } from '../../src/server/academic/server';
import { connectInProcess, Example } from '../_harness';

const ex = new Example('s5-prompts', 'S5 · Prompts: server.registerPrompt + completable()', [
    'registerPrompt',
    'completable',
    'client.listPrompts',
    'client.getPrompt',
    'client.complete (ref/prompt)'
]);

const { client, close } = await connectInProcess(createAcademicServer);

await ex.run('Prompts and their arguments', 'listPrompts', undefined, () => client.listPrompts(), r =>
    r.prompts.map(p => ({ name: p.name, title: p.title, arguments: p.arguments }))
);

ex.section('getPrompt with parameter sets');
const get = (step: string, name: string, args: Record<string, string>) =>
    ex.run(step, 'getPrompt', { name, arguments: args }, () => client.getPrompt({ name, arguments: args }), r =>
        r.messages.map(m => ({
            role: m.role,
            type: m.content.type,
            text: m.content.type === 'text' ? m.content.text : m.content.type === 'resource' ? `[embedded ${m.content.resource.uri}]` : `[${m.content.type}]`
        }))
    );
await get('class_report · required argument only', 'class_report', { class_id: 'IT01' });
await get('class_report · with optional semester', 'class_report', { class_id: 'BA02', semester: '2024-2' });
await get('class_report · missing class_id → ProtocolError -32602', 'class_report', {});
await get('study_advice · embeds a resource in the message', 'study_advice', { student_id: '2201010' });
await get('unknown prompt name', 'does_not_exist', {});

ex.section('Argument autocompletion (completable)');
for (const [prompt, name, value, context] of [
    ['class_report', 'class_id', '', undefined],
    ['class_report', 'class_id', 'B', undefined],
    ['class_report', 'semester', '2024', { class_id: 'IT01' }],
    ['study_advice', 'student_id', '22020', undefined]
] as const) {
    const params = { ref: { type: 'ref/prompt' as const, name: prompt }, argument: { name, value }, ...(context ? { context: { arguments: context } } : {}) };
    await ex.run(`${prompt}.${name} = "${value}"`, 'complete', params, () => client.complete(params), r => r.completion);
}

await close();
ex.save();
