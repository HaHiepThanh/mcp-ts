/**
 * Entry point of the `academic` MCP server.
 *   stdio : tsx src/server/academic/main.ts
 *   HTTP  : tsx src/server/academic/main.ts --http [--port 3001]
 */
import { runServer } from '../../lib/serve';
import { getAcademicData } from './data';
import { createAcademicServer } from './server';

const data = getAcademicData(); // load + validate once at startup, fail fast on a broken dataset
console.error(`[academic] data: ${data.students.size} students, ${data.courses.size} courses, ${data.grades.length} grades, ${data.issues.length} skipped rows (${data.dataDir})`);

runServer(createAcademicServer, { name: 'academic', defaultPort: 3001 });
