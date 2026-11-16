/**
 * Entry point of the `finance` MCP server.
 *   stdio : tsx src/server/finance/main.ts
 *   HTTP  : tsx src/server/finance/main.ts --http [--port 3003]
 */
import { runServer } from '../../lib/serve';
import { createFinanceServer } from './server';

runServer(() => createFinanceServer, { name: 'finance', defaultPort: 3003 });
