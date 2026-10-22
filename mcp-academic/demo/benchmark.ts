/**
 * Benchmark cases for comparing LLMs behind the same MCP servers.
 * Expected values are NOT hard-coded: `expect` asks the real MCP tools (the "oracle") for the
 * ground truth, so the benchmark stays correct when the dataset changes.
 */
export type Oracle = (server: 'academic' | 'utility' | 'finance', tool: string, args: Record<string, unknown>) => Promise<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any

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
    /** Servers that must be enabled in the host config; the case is skipped for configurations without them (e.g. finance on Qwen). */
    requires?: string[];
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
    },
    // ── Hoàng's Phase 2 Benchmark Cases ────────────────────────────────
    {
        id: 'attendance-summary',
        category: 'attendance check',
        question: 'What is the attendance summary and absence rate of student 2201001?',
        tools: ['academic.attendance_summary'],
        args: calls => find(calls, 'academic.attendance_summary').some(c => c.args.student_id === '2201001'),
        expect: async o => [(await o('academic', 'attendance_summary', { student_id: '2201001' })).absence_rate_pct]
    },
    {
        id: 'conduct-score',
        category: 'conduct score evaluation',
        question: 'What is the average conduct score and grade for student 2201002?',
        tools: ['academic.conduct_score'],
        args: calls => find(calls, 'academic.conduct_score').some(c => c.args.student_id === '2201002'),
        expect: async o => [(await o('academic', 'conduct_score', { student_id: '2201002' })).average_score]
    },
    {
        id: 'at-risk-class',
        category: 'multimodal evaluation',
        question: 'Which students in class IT01 are at risk of probation or failure?',
        tools: ['academic.at_risk_students'],
        args: calls => find(calls, 'academic.at_risk_students').some(c => (c.args.class_id as string)?.toUpperCase() === 'IT01'),
        expect: async o => [(await o('academic', 'at_risk_students', { class_id: 'IT01' })).at_risk_count]
    },
    // ── Phú's Phase 2 Benchmark Cases ──────────────────────────────────
    {
        id: 'search-teachers',
        category: 'teacher lookup',
        question: 'Find the teacher named Lan in Information Technology faculty and give me their teacher ID.',
        tools: ['academic.search_teachers'],
        args: calls => find(calls, 'academic.search_teachers').some(c => c.args.keyword === 'Lan'),
        expect: async o => [(await o('academic', 'search_teachers', { keyword: 'Lan' })).teachers[0].teacher_id]
    },
    {
        id: 'class-timetable',
        category: 'schedule lookup',
        question: 'What is the timetable and list of courses for class IT01 in semester 2024-1?',
        tools: ['academic.class_timetable'],
        args: calls => find(calls, 'academic.class_timetable').some(c => (c.args.class_id as string)?.toUpperCase() === 'IT01' && c.args.semester === '2024-1'),
        expect: async o => [(await o('academic', 'class_timetable', { class_id: 'IT01', semester: '2024-1' })).total_sections]
    },
    {
        id: 'teacher-workload',
        category: 'teaching workload',
        question: 'How many sections and teaching periods per week does teacher T002 have in semester 2025-1?',
        tools: ['academic.teacher_workload'],
        args: calls => find(calls, 'academic.teacher_workload').some(c => c.args.teacher_id === 'T002' && c.args.semester === '2025-1'),
        expect: async o => [(await o('academic', 'teacher_workload', { teacher_id: 'T002', semester: '2025-1' })).total_periods_per_week]
    },

    // ── finance server (needs data/sample-finance/ and the teachers/sections/conduct tables) ──
    // Teacher T001 and the months 2024-10 / 2025-xx come from the generated sample data; update them if teachers.csv changes.
    {
        id: 'fin-tuition',
        category: 'finance · single tool',
        question: 'How much tuition is student 2201005 supposed to pay for semester 2025-1, and has it been paid?',
        requires: ['finance'],
        tools: ['finance.tuition_status'],
        args: calls => find(calls, 'finance.tuition_status').some(c => c.args.student_id === '2201005' && c.args.semester === '2025-1'),
        expect: async o => [(await o('finance', 'tuition_status', { student_id: '2201005', semester: '2025-1' })).records[0].amount_due]
    },
    {
        id: 'fin-outstanding',
        category: 'finance · aggregate',
        question: 'In the Information Technology faculty, how many students still owe tuition for semester 2025-1, and how much is owed in total?',
        requires: ['finance'],
        tools: ['finance.outstanding_tuition'],
        args: calls => find(calls, 'finance.outstanding_tuition').some(c => c.args.semester === '2025-1' && c.args.class_id === undefined),
        expect: async o => {
            const r = await o('finance', 'outstanding_tuition', { faculty: 'Information Technology', semester: '2025-1' });
            return [r.students_with_balance, r.total_balance];
        }
    },
    {
        id: 'fin-eligibility',
        category: 'finance · rules in code',
        question: 'Which scholarships is student 2201010 eligible for in semester 2024-1? List the scholarship IDs.',
        requires: ['finance'],
        tools: ['finance.check_scholarship_eligibility'],
        args: calls => find(calls, 'finance.check_scholarship_eligibility').some(c => c.args.student_id === '2201010' && c.args.semester === '2024-1'),
        expect: async o => (await o('finance', 'check_scholarship_eligibility', { student_id: '2201010', semester: '2024-1' })).eligible_for
    },
    {
        id: 'fin-rank',
        category: 'finance · ranking',
        question: 'Who are the top 3 candidates for scholarship SCH02 in the Information Technology faculty for semester 2024-2?',
        requires: ['finance'],
        tools: ['finance.rank_scholarship_candidates'],
        args: calls => find(calls, 'finance.rank_scholarship_candidates').some(c => String(c.args.scholarship_id).toUpperCase() === 'SCH02' && c.args.semester === '2024-2'),
        expect: async o =>
            (await o('finance', 'rank_scholarship_candidates', { faculty: 'Information Technology', semester: '2024-2', scholarship_id: 'SCH02', limit: 3 })).ranking.map((r: { full_name: string }) => r.full_name)
    },
    {
        id: 'fin-pay',
        category: 'finance · payroll',
        question: 'What is the net pay of teacher T001 for 2024-10?',
        requires: ['finance'],
        tools: ['finance.calculate_teacher_pay'],
        args: calls => find(calls, 'finance.calculate_teacher_pay').some(c => c.args.teacher_id === 'T001' && c.args.month === '2024-10'),
        expect: async o => [(await o('finance', 'calculate_teacher_pay', { teacher_id: 'T001', month: '2024-10' })).net]
    },
    {
        id: 'fin-payroll-summary',
        category: 'finance · payroll',
        question: 'What is the total net payroll of the Information Technology faculty for 2024-10?',
        requires: ['finance'],
        tools: ['finance.payroll_summary'],
        args: calls => find(calls, 'finance.payroll_summary').some(c => c.args.month === '2024-10'),
        expect: async o => [(await o('finance', 'payroll_summary', { month: '2024-10', faculty: 'Information Technology' })).total_net]
    },
    {
        id: 'fin-approve',
        category: 'finance · destructive tool (declined)',
        question: 'Approve the payroll of teacher T001 for 2024-10.',
        requires: ['finance'],
        tools: ['finance.approve_payroll'],
        // The host declines the confirmation when there is no terminal, so nothing is approved.
        args: calls => find(calls, 'finance.approve_payroll').some(c => c.args.teacher_id === 'T001' && c.args.month === '2024-10')
    }
];
