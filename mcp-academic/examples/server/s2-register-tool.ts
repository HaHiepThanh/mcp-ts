/**
 * S2 — server.registerTool(name, config, handler)
 * Part 1: config variants on a tiny server (what each option changes on the wire).
 * Part 2: the academic tools called with valid, edge-case and invalid parameter sets.
 */
import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';

import { createAcademicServer } from '../../src/server/academic/server';
import { connectInProcess, Example, firstText } from '../_harness';

const ex = new Example('s2-register-tool', 'S2 · Tools: server.registerTool(name, config, handler)', ['registerTool', 'client.listTools', 'client.callTool']);

// ── Part 1: registerTool config variants ─────────────────────────────
function variantsServer(): McpServer {
    const server = new McpServer({ name: 'tool-variants', version: '1.0.0' });

    server.registerTool('add', { description: 'Add two numbers', inputSchema: z.object({ a: z.number(), b: z.number() }) }, async ({ a, b }) => ({
        content: [{ type: 'text', text: String(a + b) }]
    }));

    server.registerTool('server_time', { description: 'Current server time (no arguments)' }, async () => ({
        content: [{ type: 'text', text: new Date().toISOString() }]
    }));

    server.registerTool(
        'letter_of',
        {
            description: 'Letter grade of a 10-point total',
            inputSchema: z.object({ total: z.number().min(0).max(10) }),
            outputSchema: z.object({ total: z.number(), letter: z.enum(['A', 'B', 'C', 'D', 'F']) })
        },
        async ({ total }) => {
            const letter = total >= 8.5 ? 'A' : total >= 7 ? 'B' : total >= 5.5 ? 'C' : total >= 4 ? 'D' : 'F';
            return { content: [{ type: 'text', text: letter }], structuredContent: { total, letter } };
        }
    );

    server.registerTool(
        'reset_demo_data',
        {
            title: 'Reset demo data',
            description: 'Pretend to wipe data (shows annotations only)',
            annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true }
        },
        async () => ({ content: [{ type: 'text', text: 'Nothing was actually deleted.' }] })
    );

    server.registerTool(
        'broken_output',
        { description: 'Returns data that violates its own outputSchema', outputSchema: z.object({ gpa: z.number().max(4) }) },
        async () => ({ content: [{ type: 'text', text: '{"gpa": 9}' }], structuredContent: { gpa: 9 } })
    );
    return server;
}

ex.section('Part 1 — registerTool config variants');
const variants = await connectInProcess(() => variantsServer());
await ex.run('tools/list shows how each config is advertised', 'listTools', undefined, () => variants.client.listTools(), r =>
    r.tools.map(t => ({ name: t.name, title: t.title, inputSchema: t.inputSchema, outputSchema: t.outputSchema, annotations: t.annotations }))
);
await ex.run('A. inputSchema only', 'callTool', { name: 'add', arguments: { a: 2, b: 3 } }, () =>
    variants.client.callTool({ name: 'add', arguments: { a: 2, b: 3 } })
);
await ex.run('B. no inputSchema (no arguments)', 'callTool', { name: 'server_time' }, () => variants.client.callTool({ name: 'server_time', arguments: {} }));
await ex.run('C. outputSchema → structuredContent', 'callTool', { name: 'letter_of', arguments: { total: 7.4 } }, () =>
    variants.client.callTool({ name: 'letter_of', arguments: { total: 7.4 } })
);
await ex.run('D. annotations are hints only — execution is unchanged', 'callTool', { name: 'reset_demo_data' }, () =>
    variants.client.callTool({ name: 'reset_demo_data', arguments: {} })
);
await ex.run('E. structuredContent violating outputSchema is caught by the SDK', 'callTool', { name: 'broken_output' }, () =>
    variants.client.callTool({ name: 'broken_output', arguments: {} })
);
await variants.close();

// ── Part 2: academic tools with parameter sets ───────────────────────
ex.section('Part 2 — academic tools, parameter sets');
const { client, close } = await connectInProcess(createAcademicServer);

const call = (step: string, name: string, args: Record<string, unknown>) =>
    ex.run(step, 'callTool', { name, arguments: args }, () => client.callTool({ name, arguments: args }), r =>
        r.structuredContent ? { isError: r.isError ?? false, structuredContent: r.structuredContent } : { isError: r.isError ?? false, text: firstText(r) }
    );

await call('calculate_gpa · cumulative GPA', 'calculate_gpa', { student_id: '2201001' });
await call('calculate_gpa · one semester', 'calculate_gpa', { student_id: '2201001', semester: '2024-1' });
await call('calculate_gpa · weak student with retakes (best attempt kept)', 'calculate_gpa', { student_id: '2201010' });
await call('calculate_gpa · same student, semester 2024-1 only (F counted)', 'calculate_gpa', { student_id: '2201010', semester: '2024-1' });
await call('calculate_gpa · unknown student → handler returns isError', 'calculate_gpa', { student_id: '9999999' });
await call('calculate_gpa · bad semester format → rejected by inputSchema', 'calculate_gpa', { student_id: '2201001', semester: 'HK1' });
await call('calculate_gpa · wrong type (number) → rejected by inputSchema', 'calculate_gpa', { student_id: 2201001 });

await call('search_students · accent-insensitive keyword', 'search_students', { keyword: 'hai' });
await call('search_students · class filter + limit', 'search_students', { class_id: 'IT02', limit: 3 });
await call('search_students · limit above max (50) → rejected', 'search_students', { limit: 999 });

await call('get_transcript · one semester', 'get_transcript', { student_id: '2201010', semester: '2024-1' });
await call('class_statistics · whole class', 'class_statistics', { class_id: 'IT01' });
await call('class_statistics · class + course', 'class_statistics', { class_id: 'IT01', course_id: 'CS201' });
await call('class_statistics · unknown class', 'class_statistics', { class_id: 'XX99' });
await call('rank_students · top 3 of faculty', 'rank_students', { scope: 'faculty', value: 'Business', top: 3 });
await call('rank_students · missing value for scope=class', 'rank_students', { scope: 'class' });

await call('query_table · generic filter (final_score < 4)', 'query_table', {
    table: 'grades',
    filters: [{ column: 'final_score', operator: 'lt', value: '4' }],
    limit: 5
});
await call('query_table · unknown column', 'query_table', { table: 'grades', filters: [{ column: 'gpa', operator: 'gt', value: '3' }] });

await close();
ex.save();
