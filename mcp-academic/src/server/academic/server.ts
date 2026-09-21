import { type McpRequestContext, McpServer } from '@modelcontextprotocol/server';

import { getAcademicData } from './data';
import { registerAcademicPrompts } from './prompts';
import { registerAcademicResources } from './resources';
import { registerAcademicTools } from './tools';

export const ACADEMIC_INSTRUCTIONS =
    'Academic records server. Scores are on the 10-point scale; letter grades are A/B/C/D/F; GPA is on the 4-point scale. ' +
    'When the user gives a name instead of a student ID, call search_students first. ' +
    'Semesters look like "2024-1". Read academic://rules/grading for the exact grading rules.';

/**
 * Server factory. The SDK calls it once per connection (stdio) or per request (HTTP)
 * and tells it which protocol era the caller speaks. The dataset is shared per process.
 */
export function createAcademicServer(ctx: McpRequestContext): McpServer {
    const data = getAcademicData();
    const server = new McpServer(
        { name: 'academic', title: 'Academic Records', version: '1.0.0' },
        { capabilities: { logging: {} }, instructions: ACADEMIC_INSTRUCTIONS }
    );
    registerAcademicTools(server, data, ctx.era);
    registerAcademicResources(server, data);
    registerAcademicPrompts(server, data);
    return server;
}
