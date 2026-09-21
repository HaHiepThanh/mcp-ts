/**
 * S3 — RegisteredTool.disable() / enable() / update() / remove(), and registering a tool
 * after the client connected. Each change makes the SDK send notifications/tools/list_changed.
 * (2025-era connection: those notifications are pushed unsolicited.)
 */
import { McpServer, type RegisteredTool } from '@modelcontextprotocol/server';
import * as z from 'zod';

import { connectInProcess, Example, firstText } from '../_harness';

const ex = new Example('s3-tool-lifecycle', 'S3 · Tool lifecycle: RegisteredTool.disable/enable/update/remove', [
    'RegisteredTool.disable',
    'RegisteredTool.enable',
    'RegisteredTool.update',
    'RegisteredTool.remove',
    'registerTool (after connect)',
    'notifications/tools/list_changed'
]);

let server!: McpServer;
let gpaTool!: RegisteredTool;

const notifications: string[] = [];
const { client, close } = await connectInProcess(
    () => {
        server = new McpServer({ name: 'lifecycle', version: '1.0.0' });
        gpaTool = server.registerTool(
            'calculate_gpa',
            { description: 'GPA of a student', inputSchema: z.object({ student_id: z.string() }) },
            async ({ student_id }) => ({ content: [{ type: 'text', text: `GPA of ${student_id}: 3.25` }] })
        );
        server.registerTool('ping', { description: 'Health check' }, async () => ({ content: [{ type: 'text', text: 'pong' }] }));
        return server;
    },
    {
        era: 'legacy',
        setup: c => c.setNotificationHandler('notifications/tools/list_changed', () => void notifications.push(new Date().toISOString()))
    }
);

const tick = () => new Promise(resolve => setTimeout(resolve, 20));
const list = (step: string) =>
    ex.run(step, 'listTools', undefined, () => client.listTools(), r => r.tools.map(t => `${t.name} — ${t.description}`));
const callGpa = (step: string) =>
    ex.run(step, 'callTool', { name: 'calculate_gpa', arguments: { student_id: '2201001' } }, () =>
        client.callTool({ name: 'calculate_gpa', arguments: { student_id: '2201001' } }).then(r => ({ isError: r.isError ?? false, text: firstText(r) }))
    );

await list('1. Initial tools');

ex.section('disable()');
gpaTool.disable();
await tick();
await list('2. After gpaTool.disable() — hidden from tools/list');
await callGpa('3. Calling a disabled tool');

ex.section('enable()');
gpaTool.enable();
await tick();
await callGpa('4. After gpaTool.enable() — callable again');

ex.section('update({ description, callback })');
gpaTool.update({
    description: 'GPA of a student on the 4-point scale (v2)',
    // update() loses the schema's static type, so the new callback reads its arguments as unknown
    callback: async (args: unknown) => {
        const { student_id } = args as { student_id: string };
        return { content: [{ type: 'text' as const, text: `[v2] GPA of ${student_id}: 3.25 / 4.00` }] };
    }
});
await tick();
await list('5. Description changed');
await callGpa('6. New callback answers');

ex.section('registerTool() after the client connected');
server.registerTool('get_current_time', { description: 'Current time' }, async () => ({ content: [{ type: 'text', text: new Date().toISOString() }] }));
await tick();
await list('7. New tool appears without reconnecting');

ex.section('remove()');
gpaTool.remove();
await tick();
await list('8. After gpaTool.remove()');
await callGpa('9. Calling a removed tool');

ex.section('Notifications received by the client');
ex.note(`notifications/tools/list_changed received ${notifications.length} times`);
await close();
ex.save({ listChangedNotifications: notifications.length });
