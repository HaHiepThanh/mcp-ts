import { type McpRequestContext, McpServer } from '@modelcontextprotocol/server';

import { getAcademicData } from '../academic/data';
import { getFinanceData } from './data';
import { registerFinanceTools } from './tools';

export const FINANCE_INSTRUCTIONS =
    'Finance server (sensitive): student tuition, scholarships, teacher payroll. Amounts are in VND. ' +
    'Scholarship eligibility and teacher pay are computed by the tools — report them as returned, never re-derive them. ' +
    'Semesters look like "2024-1", months like "2024-10". When the user gives a name instead of an ID, look the person up on the academic server first. ' +
    'approve_payroll always asks the user to confirm.';

/**
 * Server factory. The SDK calls it once per connection (stdio) or per request (HTTP).
 * Finance data and the academic dataset (students, grades, teachers, sections, conduct) are shared per process.
 */
export function createFinanceServer(ctx: McpRequestContext): McpServer {
    const server = new McpServer({ name: 'finance', title: 'Finance (tuition, scholarships, payroll)', version: '1.0.0' }, { instructions: FINANCE_INSTRUCTIONS });
    registerFinanceTools(server, getFinanceData(), getAcademicData(), ctx.era);
    return server;
}
