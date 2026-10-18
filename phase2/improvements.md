# Improvements — what we changed after running the system, and why

Each item came from a real run (log or benchmark), was fixed, and re-verified. This is the "(cải tiến)" part of phase 2.

| # | Observed problem | Evidence | Change | Result after the change |
| --- | --- | --- | --- | --- |
| 1 | The LLM set `process_score: 0` when the user only asked to change the final score | chat log: `update_grade {process_score: 0, final_score: 8}`; elicitation showed "total 4.8 (D)" | `update_grade`: both scores optional, an omitted score keeps its current value; description says "pass ONLY the scores the user wants to change" | LLM now sends `{final_score: 8}` only → total 6.4 (C). Benchmark case `elicitation-args` 100 % on all models |
| 2 | English question answered in Vietnamese (data contains Vietnamese names) | chat log, question "Compare the average GPA of classes IT01 and IT02" | System prompt: "reply in the language of the user's latest message only" | English → English, Vietnamese → Vietnamese in all later runs |
| 3 | `gemini-3.8-flash` took 7–10 s per call and often failed with 503 | `llmCalls` in chat logs: 14.5 s with a retry | Default model `gemini-3.5-flash-lite` (≈ 1 s), Flash models kept as automatic fallback | Chat turn ≈ 2–4 s instead of 20–40 s |
| 4 | Retired model `gemini-2.5-flash` answered 404 and blocked the fallback chain | provider test | 404 / exhausted quota → skip to the next model immediately | No hang on retired models |
| 5 | The first benchmark labelled answers as "gemini-3.8-flash" although fallback models produced them, and used up the free daily quota (131 retries) | per-call `model` field in the benchmark JSON | Benchmark runs cloud models **without fallback**, honours `retryDelay`, stops a model after 2 quota errors, records model time separately from waiting, saves after every model | Clean attribution; rerun in 9 min instead of > 1 h |
| 6 | Qwen could not use the tools reliably out of the box: 13 tool definitions ≈ 4.8k tokens > Ollama's default 4k context | token counts in logs | Ollama started with `OLLAMA_CONTEXT_LENGTH=8192`, flash attention, q8 KV cache | Qwen 100 % on the benchmark, 3.3 GB RAM |
| 7 | `qwen3:4b` kept "thinking" even with `/no_think` or `think:false` (≈ 700 output tokens for a one-line answer) | API tests | Use `qwen3:4b-instruct` (non-thinking build) by default; thinking build kept as a separate configuration | 109 vs 1468 output tokens per turn; 2.1 s vs 24.4 s |
| 8 | Benchmark counted "B" as found whenever any "b" appeared in the answer | checker review | Short expected values must match as whole words | No false passes |
| 9 | Subscription example received a notification after `close()` | C3 run, in-process HTTP harness only | Moved the 2026 subscription test to a real HTTP server process | Correct behaviour confirmed (0 notifications after close) |
| 10 | Chat latency: where does the time go? | `llmCalls` + tool `ms` per turn | Instrumented every LLM call (model, ms, attempts) and every tool call | LLM ≈ 99 %, MCP tool calls < 1 % — optimise the model choice, not the MCP layer |

## Phase 2 improvements (found by the experiments, measured before / after)

"Before" = E1 Qwen3 4B Instruct (23 scenarios × 2) and E5 academic-only; "after" = experiment I1, same configuration and scenarios (`phase2/runs/I1/`).

| # | Observed problem | Evidence (log) | Change | Before → after |
| --- | --- | --- | --- | --- |
| 11 | Model asked for class `"it-01"`, got an error listing the known classes, and gave up instead of retrying (D3) | `phase2/runs/E1/qwen-instruct.jsonl`, scenario D3: 0/2 | Server normalises class IDs (`it-01`, `IT 01`, `it01` → IT01) in every class-based tool (`AcademicData.sameClass`) | D3 **0/2 → 2/2** |
| 12 | Model searched lecturers by course code — `search_teachers("CS202")` — which only matched names, so it found nobody (B2) | E1, B2: tool check 0/2 | `search_teachers` also matches the courses a lecturer teaches (ID or name); description says so | B2 tool check **0/2 → 2/2** (answer still wrong: the small model reports overtime 165 instead of total 345 periods) |
| 13 | With a server switched off, the model sometimes substituted another tool's data (a GPA ranking presented as scholarship winners; invented scholarship criteria) | E5 `academic.jsonl`: 3/6 correct refusals | System prompt rule: "answer only from tool results; if no tool provides it, say it is not available — never substitute data from a different tool" | correct refusals **50 % → 83.3 %** |
| — | Overall | E1 qwen-instruct | #11–13 together | pass rate **91.3 % → 95.7 %** |

### Fixes to our own test harness (found while analysing the logs)

| Problem | Effect | Fix |
| --- | --- | --- |
| The accepted grade change of scenario E1 ran before G1 in the same server process | G1 graded against stale ground truth (27 runs marked wrong although the model was right) | Data-changing scenarios now run last; G1 re-run for every configuration (27/27 pass) |
| Correct refusals worded "does not have any records" / "does not store" were not recognised | 4 correct answers marked wrong | Wider answer patterns; every logged answer re-graded with `--rejudge` (model answers never edited) |

## Still open

- B2: the 4B model mixes up "total periods" and "overtime periods" in the `teacher_workload` result — could be addressed by renaming the field (`total_periods_taught`) or by a larger model (Gemini and Qwen Thinking pass B2).
- A3 with the utility server off: the model answers the letter grade from general knowledge instead of saying the converter is unavailable (correct value, wrong behaviour).
