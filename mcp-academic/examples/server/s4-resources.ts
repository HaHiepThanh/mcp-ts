/**
 * S4 — server.registerResource(name, uriOrTemplate, metadata, readCallback)
 * Static resources, ResourceTemplate with a list callback, ResourceTemplate without one,
 * and completion of template variables.
 */
import { createAcademicServer } from '../../src/server/academic/server';
import { connectInProcess, Example } from '../_harness';

const ex = new Example('s4-resources', 'S4 · Resources: server.registerResource + ResourceTemplate', [
    'registerResource',
    'ResourceTemplate',
    'client.listResources',
    'client.listResourceTemplates',
    'client.readResource',
    'client.complete (ref/resource)'
]);

const { client, close } = await connectInProcess(createAcademicServer);
const clip = (text: string, lines = 12) => {
    const all = text.split('\n');
    return all.length > lines ? [...all.slice(0, lines), `... (${all.length - lines} more lines)`].join('\n') : text;
};
const read = (step: string, uri: string) =>
    ex.run(step, 'readResource', { uri }, () => client.readResource({ uri }), r =>
        r.contents.map(c => ({ uri: c.uri, mimeType: c.mimeType, text: 'text' in c ? clip(c.text) : '(binary)' }))
    );

ex.section('Discovery');
await ex.run('Static resources + instances listed by templates', 'listResources', undefined, () => client.listResources(), r =>
    r.resources.map(x => ({ uri: x.uri, name: x.name, mimeType: x.mimeType }))
);
await ex.run('URI templates (students/{student_id} is readable but not listed)', 'listResourceTemplates', undefined, () => client.listResourceTemplates(), r =>
    r.resourceTemplates.map(t => ({ uriTemplate: t.uriTemplate, name: t.name, mimeType: t.mimeType }))
);

ex.section('Static resources');
await read('Grading rules (markdown generated from config/grading.json)', 'academic://rules/grading');
await read('Data-quality report (rows skipped while loading)', 'academic://reports/data-quality');

ex.section('Template with list callback: academic://tables/{table}');
await read('table = courses', 'academic://tables/courses');
await read('table = nope → ResourceNotFoundError', 'academic://tables/nope');

ex.section('Template without list callback: academic://students/{student_id}');
await read('student_id = 2201010 (weak student with retakes)', 'academic://students/2201010');
await read('student_id = 9999999 → ResourceNotFoundError', 'academic://students/9999999');
await read('URI matching no resource at all', 'academic://unknown/thing');

ex.section('Completion of template variables');
for (const [uri, name, value] of [
    ['academic://students/{student_id}', 'student_id', '22020'],
    ['academic://students/{student_id}', 'student_id', '99'],
    ['academic://tables/{table}', 'table', 'gr']
] as const) {
    await ex.run(`complete ${name}="${value}"`, 'complete', { ref: { type: 'ref/resource', uri }, argument: { name, value } }, () =>
        client.complete({ ref: { type: 'ref/resource', uri }, argument: { name, value } }), r => r.completion
    );
}

await close();
ex.save();
