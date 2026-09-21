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

## Planned improvements (phase 2 work)

- Richer dataset (teachers, sections, attendance, conduct, tuition, scholarships, payroll) and tools on top of it — see `README.md` in this folder.
- Harder benchmark cases (ambiguous names, 3+ tool chains, aggregates across classes) and the team's `test_cases.csv`, so models are separated on accuracy, not only speed.
- Configuration experiments: tool-description quality (clear vs terse), `maxToolRounds`, temperature, stdio vs HTTP end-to-end, protocol 2025 vs 2026 end-to-end.
