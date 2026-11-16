/** Prints the oracle's ground truth (MCP tools) for the scenarios as JSON — used by phase2/manual_check.py. */
import { SCENARIOS } from '../demo/scenarios';
import { connectInProcess } from '../examples/_harness';
import { createAcademicServer } from '../src/server/academic/server';
import { createUtilityServer } from '../src/server/utility/server';
import { createFinanceServer } from '../src/server/finance/server';
const c = { academic: await connectInProcess(createAcademicServer), utility: await connectInProcess(createUtilityServer), finance: await connectInProcess(createFinanceServer) };
const o = async (s: 'academic' | 'utility' | 'finance', tool: string, args: Record<string, unknown>) => (await c[s].client.callTool({ name: tool, arguments: args })).structuredContent as any;
const out: Record<string, unknown> = {};
for (const s of SCENARIOS) if (s.expect) out[s.id] = await s.expect(o);
const e = await o('finance', 'check_scholarship_eligibility', { student_id: '2201001', semester: '2025-1', scholarship_id: 'MERIT-B' });
out.C2 = [e.results[0].eligible ? 'eligible' : 'not eligible'];
const w = await o('academic', 'teacher_workload', { teacher_id: 'T02', semester: '2025-1' });
out.G3 = [`T02 +${w.overtime_periods}`];
console.log(JSON.stringify(out));
process.exit(0);
