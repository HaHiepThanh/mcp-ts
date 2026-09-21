# mcp-academic

Seminar **MCP.2502 — MCP TypeScript SDK (v2)**. An MCP server that exposes university academic records (students, courses, grades from CSV) to any LLM host, plus runnable examples of every SDK method with several parameter sets.

| Milestone | Content | Status |
| --- | --- | --- |
| M0 | Environment, Drive sync, Gemini check | ✅ |
| M1 | `academic` server + server-side examples S1–S8 | ✅ |
| M2 | Client-side examples C1–C6 | ⏳ |
| M3 | `utility` server + chat host (Gemini) | ⏳ |
| M4 | Claude Desktop / VS Code config, outputs for slides | ⏳ |
| M5 | Second LLM: Qwen via Ollama | ⏳ |

## Quick start

```bash
npm install
npm run doctor        # checks Node, MCP SDK, Gemini key, Ollama
npm run examples      # runs every example → outputs/examples/*.json + *.log
npm run academic      # academic server over stdio
npm run academic:http # academic server over Streamable HTTP at http://127.0.0.1:3001/mcp
```

Requires Node ≥ 20. API keys live in `.env` (see `.env.example`) and are never committed or synced.

## The `academic` server

Scores are on the 10-point scale; each course total becomes a letter **A/B/C/D/F** and a 4-point value; GPA is credit-weighted on the **4-point scale**. All thresholds live in [`config/grading.json`](config/grading.json).

| Kind | Name | What it does |
| --- | --- | --- |
| Tool | `search_students` | Find students by name/ID (accent-insensitive), class, faculty |
| Tool | `get_transcript` | Every graded course of a student, with letter and 4-point value |
| Tool | `calculate_gpa` | Semester or cumulative GPA + classification (structured output) |
| Tool | `class_statistics` | Average/min/max, pass rate, letter distribution, average GPA |
| Tool | `rank_students` | Top N by GPA in a class/faculty/school — reports **progress** |
| Tool | `update_grade` | Changes a grade after the user confirms — **elicitation** |
| Tool | `generate_student_feedback` | Feedback paragraph written by the host's LLM — **sampling** |
| Tool | `list_tables` / `describe_table` / `query_table` | Generic tools for **any** CSV (backup-domain plan) |
| Resource | `academic://rules/grading` | Grading rules (markdown) |
| Resource | `academic://reports/data-quality` | Rows skipped while loading, with reasons |
| Resource template | `academic://tables/{table}` | Raw CSV of a table (listable, completable) |
| Resource template | `academic://students/{student_id}` | Student profile + GPA per semester (completable) |
| Prompt | `class_report(class_id, semester?)` | Report template, both arguments autocomplete |
| Prompt | `study_advice(student_id)` | Advice template embedding the student-profile resource |

The same code serves **both protocol eras**: 2025 clients (`initialize` handshake, e.g. Claude Desktop) and 2026-07-28 clients (`server/discover`). Server→client requests use `elicitInput`/`requestSampling` on 2025 connections and `return inputRequired(...)` on 2026 ones — see [`src/lib/interaction.ts`](src/lib/interaction.ts).

## Examples (one file per SDK method group)

| # | File | SDK methods | Parameter sets |
| --- | --- | --- | --- |
| S1 | `examples/server/s1-mcp-server.ts` | `new McpServer`, `getServerVersion/Instructions/Capabilities` | 4 server configs |
| S2 | `examples/server/s2-register-tool.ts` | `registerTool`, `listTools`, `callTool` | 5 config variants + 18 calls (valid / edge / invalid) |
| S3 | `examples/server/s3-tool-lifecycle.ts` | `RegisteredTool.disable/enable/update/remove` | 9 steps + `list_changed` count |
| S4 | `examples/server/s4-resources.ts` | `registerResource`, `ResourceTemplate`, `readResource`, `complete` | static, templates, not-found, completion |
| S5 | `examples/server/s5-prompts.ts` | `registerPrompt`, `completable`, `getPrompt`, `complete` | required/optional/missing args, embedded resource |
| S6 | `examples/server/s6-logging-progress-cancel.ts` | `ctx.mcpReq.notify/log/signal`, `setLoggingLevel` | with/without progress, 3 log levels, cancel on 2 eras |
| S7 | `examples/server/s7-elicitation-sampling.ts` | `elicitInput`, `requestSampling`, `inputRequired` | accept/decline/cancel × 2 eras, missing capability |
| S8 | `examples/server/s8-transports.ts` | `serveStdio`, `createMcpHandler`, client transports | stdio/HTTP × 2 eras, timings, Host/Origin checks |

Every example prints each call (method, parameters, result, time) and saves it to `outputs/examples/<name>.json`.

## Data

`data/sample/` is a **temporary, generated** dataset (`npm run data:sample`, deterministic) with 40 students, 10 courses, retakes and 7 deliberately invalid rows. The team's real dataset goes to `data/real/`; switch by editing `dataDir` in [`config/academic.json`](config/academic.json) or setting `ACADEMIC_DATA_DIR`.

## Layout

```
config/            grading rules, server config (the "MCP configuration" shown in phase 2)
data/sample/       generated sample CSVs + README_data.md
src/lib/           CSV parser, env loader, stdio/HTTP runner, dual-era interaction helpers
src/server/academic/  data loading & validation, grading, tools, resources, prompts, entry point
examples/          _harness.ts + server/ (S1–S8) + client/ (M2)
scripts/           doctor, sample-data generator, smoke server
outputs/           generated results (not committed)
```
