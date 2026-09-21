/**
 * Benchmark cases for comparing LLMs behind the same MCP servers.
 * Expected values are NOT hard-coded: `expect` asks the real MCP tools (the "oracle") for the
 * ground truth, so the benchmark stays correct when the dataset changes.
 */
export type Oracle = (server: 'academic' | 'utility', tool: string, args: Record<string, unknown>) => Promise<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface ToolCallSeen {
    server: string;
    tool: string;
    args: Record<string, unknown>;
    isError: boolean;
}

export interface BenchmarkCase {
    id: string;
    category: string;
    question: string;
    /** Tools ("server.tool") that must be called at least once. */
    tools: string[];
    /** Optional check of the arguments the model chose. */
    args?: (calls: ToolCallSeen[]) => boolean;
    /** Values that must appear in the answer (numbers are matched as 2.06 / 2.1 / 2 variants). */
    expect?: (oracle: Oracle) => Promise<(string | number)[]>;
    /** Alternative answer check. */
    answer?: (text: string) => boolean;
}

const find = (calls: ToolCallSeen[], name: string) => calls.filter(c => `${c.server}.${c.tool}` === name);

export const CASES: BenchmarkCase[] = [
    {
        id: 'gpa-cumulative',
        category: 'single tool',
        question: 'What is the cumulative GPA of student 2201010, and how is it classified?',
        tools: ['academic.calculate_gpa'],
        args: calls => find(calls, 'academic.calculate_gpa').some(c => c.args.student_id === '2201010' && !c.args.semester),
        expect: async o => {
            const r = await o('academic', 'calculate_gpa', { student_id: '2201010' });
            return [r.gpa, r.classification];
        }
    },
    {
        id: 'gpa-semester',
        category: 'single tool + parameter',
        question: 'What was the GPA of student 2201010 in semester 2024-1 only?',
        tools: ['academic.calculate_gpa'],
        args: calls => find(calls, 'academic.calculate_gpa').some(c => c.args.semester === '2024-1'),
        expect: async o => [(await o('academic', 'calculate_gpa', { student_id: '2201010', semester: '2024-1' })).gpa]
    },
    {
        id: 'name-lookup',
        category: 'name → ID',
        question: 'Find the student named Phúc in class IT01 and give me their student ID.',
        tools: ['academic.search_students'],
        expect: async o => [(await o('academic', 'search_students', { keyword: 'Phúc', class_id: 'IT01' })).students[0].student_id]
    },
    {
        id: 'chain-transcript',
        category: 'chain of 2 tools',
        question: 'Which courses did Hải take in semester 2024-1, and what letter grade did he get in each?',
        tools: ['academic.search_students', 'academic.get_transcript'],
        expect: async o => {
            const id = (await o('academic', 'search_students', { keyword: 'Hải' })).students[0].student_id;
            const t = await o('academic', 'get_transcript', { student_id: id, semester: '2024-1' });
            return t.courses.map((c: { course_name: string }) => c.course_name);
        }
    },
    {
        id: 'compare-classes',
        category: 'same tool twice',
        question: 'Compare the average GPA of classes IT01 and IT02. Which class is doing better?',
        tools: ['academic.class_statistics'],
        args: calls => ['IT01', 'IT02'].every(id => find(calls, 'academic.class_statistics').some(c => c.args.class_id === id)),
        expect: async o => [(await o('academic', 'class_statistics', { class_id: 'IT01' })).average_gpa, (await o('academic', 'class_statistics', { class_id: 'IT02' })).average_gpa]
    },
    {
        id: 'two-servers',
        category: 'two servers',
        question: 'Which semester are we in now, and what letter grade and 4-point value does a course total of 8.4 give?',
        tools: ['utility.get_current_time', 'utility.convert_score'],
        expect: async o => [(await o('utility', 'get_current_time', {})).current_semester, (await o('utility', 'convert_score', { score: 8.4 })).letter]
    },
    {
        id: 'ranking',
        category: 'enum parameter',
        question: 'Who are the top 3 students of the Business Administration faculty by GPA?',
        tools: ['academic.rank_students'],
        args: calls => find(calls, 'academic.rank_students').some(c => c.args.scope === 'faculty'),
        expect: async o => (await o('academic', 'rank_students', { scope: 'faculty', value: 'Business Administration', top: 3 })).ranking.map((r: { full_name: string }) => r.full_name)
    },
    {
        id: 'generic-query',
        category: 'generic CSV tool',
        question: 'How many rows in the grades table have a final_score below 4?',
        tools: ['academic.query_table'],
        expect: async o => [(await o('academic', 'query_table', { table: 'grades', filters: [{ column: 'final_score', operator: 'lt', value: '4' }] })).total_matches]
    },
    {
        id: 'error-recovery',
        category: 'tool error',
        question: 'What is the cumulative GPA of student 9999999?',
        tools: ['academic.calculate_gpa'],
        answer: text => /not (be )?found|no student|does not exist|doesn't exist|no record|could not find|couldn't find|invalid|unknown/i.test(text)
    },
    {
        id: 'elicitation-args',
        category: 'destructive tool (declined)',
        question: 'Change the final score of student 2201005 in CS202 for semester 2025-1 to 8.',
        tools: ['academic.update_grade'],
        // Only the final score was requested — the process score must be left out.
        args: calls => find(calls, 'academic.update_grade').some(c => c.args.final_score === 8 && c.args.process_score === undefined)
    },
    {
        id: 'sampling',
        category: 'sampling',
        question: 'Write short encouraging feedback for student 2201010.',
        tools: ['academic.generate_student_feedback'],
        answer: text => text.length > 80
    }
];
