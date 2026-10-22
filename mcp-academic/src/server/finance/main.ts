/**
 * Entry point of the `finance` MCP server.
 *   stdio : tsx src/server/finance/main.ts
 *   HTTP  : tsx src/server/finance/main.ts --http [--port 3003]
 */
import { runServer } from '../../lib/serve';
import { getFinanceData } from './data';
import { createFinanceServer } from './server';

const data = getFinanceData(); // load + validate once at startup
console.error(
    `[finance] data: ${data.tuition.length} tuition rows, ${data.scholarships.size} scholarships, ${data.awards.length} awards, ${data.payroll.size} payroll rows, ${data.issues.length} skipped rows/files (${data.dataDir})`
);

runServer(() => createFinanceServer, { name: 'finance', defaultPort: 3003 });
