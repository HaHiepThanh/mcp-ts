/**
 * Entry point of the `utility` MCP server.
 *   stdio : tsx src/server/utility/main.ts
 *   HTTP  : tsx src/server/utility/main.ts --http [--port 3002]
 */
import { runServer } from '../../lib/serve';
import { createUtilityServer } from './server';

runServer(() => createUtilityServer, { name: 'utility', defaultPort: 3002 });
