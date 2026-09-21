/**
 * C3 — being told when a resource changes.
 *   2026-07-28: client.listen({ resourceSubscriptions }) opens ONE long-lived subscriptions/listen stream;
 *               the HTTP server publishes with handler.notify.resourceUpdated(uri).
 *   2025      : client.subscribeResource({ uri }) / unsubscribeResource; the server tracks subscribers
 *               and pushes notifications/resources/updated itself.
 * Trigger in both cases: update_grade changes a grade → the student's profile resource is updated.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

import { PROJECT_ROOT } from '../../src/lib/env';
import { studentUri } from '../../src/server/academic/resources';
import { createAcademicServer } from '../../src/server/academic/server';
import { connectInProcess, Example, firstText } from '../_harness';

const ex = new Example('c3-subscriptions', 'C3 · Resource change notifications: listen() (2026) vs subscribeResource() (2025)', [
    'client.listen',
    'McpSubscription.honoredFilter / close / closed',
    'client.subscribeResource',
    'client.unsubscribeResource',
    "client.setNotificationHandler('notifications/resources/updated')",
    'handler.notify.resourceUpdated',
    'server.sendResourceUpdated'
]);

const STUDENT = '2201005';
const URI = studentUri(STUDENT);
const PORT = 3913;
const URL_MCP = `http://127.0.0.1:${PORT}/mcp`;
const settle = () => new Promise(resolve => setTimeout(resolve, 200));
let semesterCounter = 1;

/** Changes one grade through the academic server (auto-confirming the elicitation). */
async function changeGrade(client: Client): Promise<string> {
    const result = await client.callTool({
        name: 'update_grade',
        arguments: { student_id: STUDENT, course_id: 'CS202', semester: `2032-${semesterCounter++}`, process_score: 9, final_score: 9 }
    });
    return firstText(result);
}

/** Records notifications and re-reads the resource, like a host refreshing attached context. */
function watch(client: Client, received: { uri: string; gpaAfterReRead: unknown }[]): void {
    client.setNotificationHandler('notifications/resources/updated', async notification => {
        const { contents } = await client.readResource({ uri: notification.params.uri }, { cacheMode: 'bypass' });
        const profile = JSON.parse('text' in contents[0] ? contents[0].text : '{}') as { cumulative?: { gpa?: number } };
        received.push({ uri: notification.params.uri, gpaAfterReRead: profile.cumulative?.gpa });
    });
}

const confirmAll = (c: Client) => c.setRequestHandler('elicitation/create', async () => ({ action: 'accept', content: { confirm: true } }));
const editorCaps = { elicitation: { form: {} } };

// ── 2026-07-28 ───────────────────────────────────────────────────────
ex.section('2026-07-28 — client.listen() against the real HTTP server (separate process)');
{
    // The HTTP entry point publishes grade changes with handler.notify.resourceUpdated (see main.ts).
    const server = spawn(process.execPath, ['--import', 'tsx', path.join(PROJECT_ROOT, 'src/server/academic/main.ts'), '--http', '--port', String(PORT)], {
        cwd: PROJECT_ROOT,
        stdio: ['ignore', 'ignore', 'pipe']
    });
    await new Promise<void>(resolve => server.stderr!.on('data', chunk => String(chunk).includes('listening') && resolve()));
    try {
        const received: { uri: string; gpaAfterReRead: unknown }[] = [];
        const watcher = new Client({ name: 'watcher', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
        watch(watcher, received);
        await watcher.connect(new StreamableHTTPClientTransport(new URL(URL_MCP)));
        const editor = new Client({ name: 'editor', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' }, capabilities: editorCaps });
        confirmAll(editor);
        await editor.connect(new StreamableHTTPClientTransport(new URL(URL_MCP)));

        const subscription = await ex.run('Open a subscription stream for one student profile', 'listen', { resourceSubscriptions: [URI] }, () =>
            watcher.listen({ resourceSubscriptions: [URI] }), s => ({ honoredFilter: s.honoredFilter })
        );
        await ex.run('Another client changes a grade', 'callTool update_grade', { student_id: STUDENT }, async () => {
            const text = await changeGrade(editor);
            await settle();
            return { toolResult: text, notificationsReceived: [...received] };
        });
        await ex.run('subscription.close(), then change again → no notification', 'close + callTool', undefined, async () => {
            await subscription?.close();
            const before = received.length;
            const text = await changeGrade(editor);
            await settle();
            return { toolResult: text, closedReason: await subscription?.closed, newNotifications: received.length - before };
        });
        await editor.close();
        await watcher.close();
    } finally {
        server.kill('SIGTERM');
    }
}

// ── 2025 ─────────────────────────────────────────────────────────────
ex.section('2025 — client.subscribeResource() on a long-lived connection');
{
    const received: { uri: string; gpaAfterReRead: unknown }[] = [];
    // One instance per connection, so the instance itself pushes updates to its subscribers.
    const watcher = await connectInProcess(ctx => createAcademicServer(ctx, { liveUpdates: true }), { era: 'legacy', setup: c => watch(c, received) });
    const editor = await connectInProcess(createAcademicServer, { capabilities: editorCaps, setup: confirmAll });

    await ex.run('Change a grade BEFORE subscribing → nothing arrives', 'callTool update_grade', undefined, async () => {
        const text = await changeGrade(editor.client);
        await settle();
        return { toolResult: text, notificationsReceived: received.length };
    });
    await ex.run('subscribeResource', 'subscribeResource', { uri: URI }, () => watcher.client.subscribeResource({ uri: URI }));
    await ex.run('Change a grade AFTER subscribing', 'callTool update_grade', undefined, async () => {
        const text = await changeGrade(editor.client);
        await settle();
        return { toolResult: text, notificationsReceived: [...received] };
    });
    await ex.run('unsubscribeResource', 'unsubscribeResource', { uri: URI }, () => watcher.client.unsubscribeResource({ uri: URI }));
    await ex.run('Change a grade after unsubscribing → nothing new', 'callTool update_grade', undefined, async () => {
        const before = received.length;
        await changeGrade(editor.client);
        await settle();
        return { newNotifications: received.length - before };
    });

    ex.section('Using the wrong API for the era');
    await ex.run('listen() on a 2025 connection', 'listen', { resourceSubscriptions: [URI] }, () => watcher.client.listen({ resourceSubscriptions: [URI] }));
    await ex.run('subscribeResource() on a 2026 connection', 'subscribeResource', { uri: URI }, () => editor.client.subscribeResource({ uri: URI }));
    await editor.close();
    await watcher.close();
}

ex.save();
