import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { loadEnv, PROJECT_ROOT } from '../src/lib/env';
import { loadHostConfig } from '../src/host/config';
import { ChatHost, type TurnLog } from '../src/host/host';
import { GeminiProvider } from '../src/host/providers/gemini';

loadEnv();

const SLEEP_MS = 1500;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const QUESTIONS = [
    // Q1: Composite multi-round workflow
    `Write a performance report for class IT01 (semester 2024-1).
Use the tools class_statistics and rank_students (and calculate_gpa when needed). The report must include:
1. Overview: number of students, average course total, pass rate, average GPA
2. Letter-grade distribution (A/B/C/D/F)
3. Top 3 students with GPA
4. Students at risk (cumulative GPA below 2.0)
5. Two concrete recommendations
Format it as Markdown. If a save_report tool is available, save the report as well.`,

    // Q2: Single-tool conduct score
    `What is the conduct score and evaluation of student 2201002?`,

    // Q3: Single-tool attendance summary & exam ban check
    `Show me the attendance summary of student 2201005. Are they banned from any exams?`,

    // Q4: Multi-criteria at-risk query
    `Find all at-risk students in class IT01 and explain the reasons.`,

    // Q5: Advisor briefing with embedded student resource + 3 tools
    `<resource uri="academic://students/2201005">
{
  "student_id": "2201005",
  "full_name": "Trần Thị Lan",
  "gender": "Female",
  "date_of_birth": "2004-06-08",
  "class_id": "IT01",
  "faculty": "Information Technology",
  "enrollment_year": "2022",
  "email": "lan.2201005@example.edu.vn",
  "cumulative": {
    "gpa": 1,
    "classification": "Weak",
    "credits_attempted": 18,
    "credits_earned": 15,
    "courses_counted": 6
  }
}
</resource>

Prepare a structured 1-on-1 advisor meeting briefing for student 2201005.
Use the tools:
1. get_transcript to evaluate academic progress and failed courses.
2. attendance_summary to check absence rates and exam eligibility.
3. conduct_score to inspect extracurricular/behavioural standing.

Provide a 4-part summary: Academic Health, Attendance & Exam Status, Conduct Evaluation, and Action Plan for the Advisor.`,

    // Q6: Same briefing prompt in the same conversation to evaluate in-context answering
    `<resource uri="academic://students/2201005">
{
  "student_id": "2201005",
  "full_name": "Trần Thị Lan",
  "gender": "Female",
  "date_of_birth": "2004-06-08",
  "class_id": "IT01",
  "faculty": "Information Technology",
  "enrollment_year": "2022",
  "email": "lan.2201005@example.edu.vn",
  "cumulative": {
    "gpa": 1,
    "classification": "Weak",
    "credits_attempted": 18,
    "credits_earned": 15,
    "courses_counted": 6
  }
}
</resource>

Prepare a structured 1-on-1 advisor meeting briefing for student 2201005.
Use the tools:
1. get_transcript to evaluate academic progress and failed courses.
2. attendance_summary to check absence rates and exam eligibility.
3. conduct_score to inspect extracurricular/behavioural standing.

Provide a 4-part summary: Academic Health, Attendance & Exam Status, Conduct Evaluation, and Action Plan for the Advisor.`
];

interface ExperimentRun {
    id: string;
    configFile: string;
    outputFile: string;
    needsHttp?: boolean;
}

const EXPERIMENTS: Record<string, ExperimentRun> = {
    baseline: {
        id: 'baseline',
        configFile: 'config/host.json',
        outputFile: '../phase2/runs/hoang/chat-hoang-feature-test.jsonl'
    },
    'maxToolRounds-2': {
        id: 'maxToolRounds-2',
        configFile: 'config/experiments/maxToolRounds-2.json',
        outputFile: '../phase2/runs/hoang/maxToolRounds-2.jsonl'
    },
    'maxToolRounds-4': {
        id: 'maxToolRounds-4',
        configFile: 'config/experiments/maxToolRounds-4.json',
        outputFile: '../phase2/runs/hoang/maxToolRounds-4.jsonl'
    },
    'maxToolRounds-8': {
        id: 'maxToolRounds-8',
        configFile: 'config/experiments/maxToolRounds-8.json',
        outputFile: '../phase2/runs/hoang/maxToolRounds-8.jsonl'
    },
    'temperature-0.0': {
        id: 'temperature-0.0',
        configFile: 'config/experiments/temperature-0.0.json',
        outputFile: '../phase2/runs/hoang/temperature-0.0.jsonl'
    },
    'temperature-0.2': {
        id: 'temperature-0.2',
        configFile: 'config/experiments/temperature-0.2.json',
        outputFile: '../phase2/runs/hoang/temperature-0.2.jsonl'
    },
    'temperature-1.0': {
        id: 'temperature-1.0',
        configFile: 'config/experiments/temperature-1.0.json',
        outputFile: '../phase2/runs/hoang/temperature-1.0.jsonl'
    },
    'transport-stdio': {
        id: 'transport-stdio',
        configFile: 'config/experiments/transport-stdio.json',
        outputFile: '../phase2/runs/hoang/transport-stdio.jsonl'
    },
    'transport-http': {
        id: 'transport-http',
        configFile: 'config/experiments/transport-http.json',
        outputFile: '../phase2/runs/hoang/transport-http.jsonl',
        needsHttp: true
    }
};

async function startHttpServers(): Promise<{ academic: ChildProcess; utility: ChildProcess }> {
    console.log('[HTTP] Spawning academic server on :3001...');
    const academic = spawn(process.execPath, ['--import', 'tsx', 'src/server/academic/main.ts', '--http', '--port', '3001'], {
        cwd: PROJECT_ROOT,
        stdio: ['ignore', 'ignore', 'pipe']
    });

    console.log('[HTTP] Spawning utility server on :3002...');
    const utility = spawn(process.execPath, ['--import', 'tsx', 'src/server/utility/main.ts', '--http', '--port', '3002'], {
        cwd: PROJECT_ROOT,
        stdio: ['ignore', 'ignore', 'pipe']
    });

    const waitListening = (p: ChildProcess, name: string) =>
        new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error(`${name} server failed to start within 15s`)), 15_000);
            p.stderr!.on('data', chunk => {
                const s = String(chunk);
                if (s.includes('listening')) {
                    clearTimeout(timeout);
                    resolve();
                }
            });
            p.on('error', reject);
        });

    await Promise.all([waitListening(academic, 'academic'), waitListening(utility, 'utility')]);
    console.log('[HTTP] Both servers listening.');
    return { academic, utility };
}

async function runExperiment(exp: ExperimentRun): Promise<TurnLog[]> {
    console.log(`\n========================================`);
    console.log(`RUNNING EXPERIMENT: ${exp.id} (${exp.configFile})`);
    console.log(`========================================`);

    let servers: { academic: ChildProcess; utility: ChildProcess } | undefined;
    if (exp.needsHttp) {
        servers = await startHttpServers();
    }

    try {
        const { config, file } = loadHostConfig(exp.configFile);
        const provider = new GeminiProvider({
            model: config.llm.model,
            temperature: config.llm.temperature
        });

        const host = new ChatHost(config, provider, { configFile: file, verbose: false });
        await host.start();

        const logs: TurnLog[] = [];

        try {
            for (let i = 0; i < QUESTIONS.length; i++) {
                const q = QUESTIONS[i];
                // For Q1..Q5: fresh conversation so each starts cleanly.
                // For Q6: do NOT call newConversation(), testing context reuse after Q5.
                if (i < 5) {
                    host.newConversation();
                }
                console.log(`\n[${exp.id}] Case ${i + 1}/${QUESTIONS.length}: ${q.slice(0, 50).replace(/\n/g, ' ')}...`);
                const log = await host.ask(q);
                logs.push(log);
                console.log(`  -> Rounds: ${log.rounds}, Tools: ${log.toolCalls.length}, Time: ${log.totalMs}ms, Tokens in/out: ${log.usage.inputTokens}/${log.usage.outputTokens}`);
                await sleep(SLEEP_MS);
            }
        } finally {
            await host.hub.close();
        }

        const outPath = path.resolve(PROJECT_ROOT, exp.outputFile);
        mkdirSync(path.dirname(outPath), { recursive: true });
        const content = logs.map(l => JSON.stringify(l)).join('\n') + '\n';
        writeFileSync(outPath, content, 'utf8');
        console.log(`\nSaved ${logs.length} sessions to ${outPath}`);

        return logs;
    } finally {
        if (servers) {
            console.log('[HTTP] Stopping HTTP servers...');
            servers.academic.kill('SIGTERM');
            servers.utility.kill('SIGTERM');
        }
    }
}

async function main() {
    const target = process.argv[2];
    if (target && target !== 'all') {
        const exp = EXPERIMENTS[target];
        if (!exp) {
            console.error(`Unknown experiment: ${target}. Options: all, ${Object.keys(EXPERIMENTS).join(', ')}`);
            process.exit(1);
        }
        await runExperiment(exp);
    } else {
        const order = [
            'baseline',
            'maxToolRounds-2',
            'maxToolRounds-4',
            'maxToolRounds-8',
            'temperature-0.0',
            'temperature-0.2',
            'temperature-1.0',
            'transport-stdio',
            'transport-http'
        ];
        for (const key of order) {
            await runExperiment(EXPERIMENTS[key]);
            await sleep(2000);
        }
    }
    console.log('\nAll experiments completed successfully!');
}

main().catch(err => {
    console.error('Fatal error running experiments:', err);
    process.exit(1);
});
