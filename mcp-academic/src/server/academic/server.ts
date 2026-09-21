import { type McpRequestContext, McpServer } from '@modelcontextprotocol/server';

import { getAcademicConfig, getAcademicData } from './data';
import { registerAcademicPrompts } from './prompts';
import { registerAcademicResources, studentUri } from './resources';
import { registerAcademicTools } from './tools';

export const ACADEMIC_INSTRUCTIONS =
    'Academic records server. Scores are on the 10-point scale; letter grades are A/B/C/D/F; GPA is on the 4-point scale. ' +
    'When the user gives a name instead of a student ID, call search_students first. ' +
    'Semesters look like "2024-1". Read academic://rules/grading for the exact grading rules.';

export interface AcademicServerOptions {
    /**
     * Push notifications/resources/updated from THIS instance when a student's grades change.
     * Use it where one instance lives for the whole connection (stdio, in-memory).
     * Behind createMcpHandler (one instance per HTTP request) publish via handler.notify instead.
     */
    liveUpdates?: boolean;
}

/**
 * Server factory. The SDK calls it once per connection (stdio) or per request (HTTP)
 * and tells it which protocol era the caller speaks. The dataset is shared per process.
 */
export function createAcademicServer(ctx: McpRequestContext, options: AcademicServerOptions = {}): McpServer {
    const data = getAcademicData();
    const server = new McpServer(
        { name: 'academic', title: 'Academic Records', version: '1.0.0' },
        {
            capabilities: { logging: {}, resources: { subscribe: true } },
            instructions: ACADEMIC_INSTRUCTIONS,
            cacheHints: getAcademicConfig().cacheHints
        }
    );
    registerAcademicTools(server, data, ctx.era);
    registerAcademicResources(server, data);
    registerAcademicPrompts(server, data);

    // 2025 era: per-resource subscriptions are the server's bookkeeping (resources/subscribe).
    // 2026 era: the client lists URIs in its subscriptions/listen filter; the SDK filters delivery.
    const subscribed = new Set<string>();
    if (ctx.era === 'legacy') {
        server.server.setRequestHandler('resources/subscribe', request => (subscribed.add(request.params.uri), {}));
        server.server.setRequestHandler('resources/unsubscribe', request => (subscribed.delete(request.params.uri), {}));
    }
    if (options.liveUpdates) {
        const stop = data.onGradeChanged(studentId => {
            const uri = studentUri(studentId);
            if (ctx.era === 'modern' || subscribed.has(uri)) void server.server.sendResourceUpdated({ uri }).catch(() => {});
        });
        const previous = server.server.onclose;
        server.server.onclose = () => (stop(), previous?.());
    }
    return server;
}
