# Khoa — Phase 2 measurement report

Measured on 18 October 2026 (Asia/Saigon), Windows, Node.js v24.18.0. The files below preserve timestamps in UTC. All academic records are synthetic sample data. Hardware and network were not controlled.

## Current results

Each sweep contains 26 executable academic cases and five finance cases explicitly skipped on main. Gemini uses `gemini-3.5-flash-lite`, temperature 0.2, maxToolRounds 8, fresh conversations and disabled model fallback. The system prompt, dataset and questions are identical between transports. HTTP servers are started locally on 3001/3002. Startup/model discovery time is outside per-question timings.

| Configuration | Exact tool/argument/value subset | Finance skipped | Median question time | Median individual tool time | Tokens in / out | Extra API attempts |
| --- | --- | --- | --- | --- | --- | --- |
| gemini-stdio-tools | 26/26 | 5 | 1 ms | 1 ms | not applicable | not applicable |
| gemini-http-tools | 26/26 | 5 | 7 ms | 7 ms | not applicable | not applicable |
| gemini-stdio-llm | 25/26 | 5 | 2,068 ms | 2 ms | 188089 / 3595 | 4 |
| gemini-http-llm | 26/26 | 5 | 2,014 ms | 7 ms | 188014 / 3625 | 6 |

## Interpretation and scoring limits

- Direct MCP checks compare independent CSV/Excel reference values with real structured tool results. They exercise transport and calculation behavior without an LLM.
- The LLM subset score requires every listed tool, the required argument values and the listed structured values. It is deliberately stricter than semantic answer correctness. For example, P2-03 expects retrieval `limit: 1`; retrieving 50 and presenting one teacher can produce a correct user-facing answer while failing that configuration check.
- The answer-presence screen is a diagnostic, not an accuracy score. Natural phrases such as “no matches” can express zero without the digit 0. Boolean exam-ban decisions, missing-data explanations and the completeness of advising/risk reasons need semantic review. Every case is marked `requiresHumanReview`.
- Golden numeric values come from CSV calculations independent of production grading/tool functions. `test-reference.xlsx` contains 59 formula metrics with independent CSV cross-checks. All agree under Artifact Tool, and a disposable conduct-input change verified recalculation. A human has not yet reviewed the workbook in Microsoft Excel; do not describe this as Khoa having calculated the answers by hand.
- One sweep per transport does not establish a general speed advantage. API retries and network variability affect end-to-end latency. These are new Phase 2 measurements, separate from the historical 11-case model comparison on an Apple M4 Pro.
- Qwen was not measured: Ollama was unavailable. The supplied Gemini key was valid. Finance, a true terse-tool-description variant and the full round/temperature matrix are outside this measured slice. Existing Hoang results remain in their own logs and documents.

## Failed strict checks

- gemini-stdio-llm, P2-03: failed. Inspect `gemini-stdio-llm-2026-10-18T11-14-50-444Z.jsonl` for the arguments, complete MCP output and final answer.

## Evidence files

- [gemini-stdio-tools-2026-10-18T11-16-09-673Z.jsonl](gemini-stdio-tools-2026-10-18T11-16-09-673Z.jsonl) — gemini-stdio-tools
- [gemini-http-tools-2026-10-18T11-16-13-706Z.jsonl](gemini-http-tools-2026-10-18T11-16-13-706Z.jsonl) — gemini-http-tools
- [gemini-stdio-llm-2026-10-18T11-14-50-444Z.jsonl](gemini-stdio-llm-2026-10-18T11-14-50-444Z.jsonl) — gemini-stdio-llm
- [gemini-http-llm-2026-10-18T11-11-15-424Z.jsonl](gemini-http-llm-2026-10-18T11-11-15-424Z.jsonl) — gemini-http-llm

Also retained: `doctor.json`, the 15/15 example-suite summary, S9/S10 outputs, workbook validation and configuration snapshots. `comparison.csv` and `comparison.json` are rebuilt from the selected complete traces, not hand-entered results. The console return code may be 1 when a strict case fails; its recorded failure remains in the report.

The first complete HTTP LLM sweep recorded all 31 cases before a harness cleanup error (`ChatHost.close` did not exist). Its summary is reconstructed from the unchanged complete case records and marked `recovered_from_complete_cases` in comparison.json. The runner now closes `host.hub` and has a TypeScript check. This cleanup issue did not change recorded model calls, outputs or per-question times.

## Reproduce

From `mcp-academic/`, after `npm install` and local `.env` configuration:

```powershell
node node_modules/typescript/bin/tsc --noEmit -p ../phase2/tsconfig.json
node --import tsx ../phase2/scripts/run-checks.ts
node --import tsx ../phase2/scripts/run-checks.ts --config ../phase2/configs/gemini-http.json --start-http
node --import tsx ../phase2/scripts/run-checks.ts --llm
node --import tsx ../phase2/scripts/run-checks.ts --llm --config ../phase2/configs/gemini-http.json --start-http
```

Then run `python phase2/scripts/summarize-runs.py` from the repository root. Read `phase2/KHOA-HANDOFF.md` before regenerating references or enabling finance.
