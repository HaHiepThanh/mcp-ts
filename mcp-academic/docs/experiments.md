# Phase 2 — Configuration Experiments (Hoàng)

This document records the empirical results of varying runtime parameters and server configurations, as specified in `TASKS.md` (Hoàng's Phase 2 tasks).

All measurements reported below are **derived directly from real runs**.
Where a configuration variant has not been executed (e.g., due to host limitations or API quotas), it is explicitly marked **[not run — config only]** with the exact reproduction command, rather than generating synthetic metrics.

---

## Evidence Baseline

### Source 1 — `phase2/runs/hoang/chat-hoang-feature-test.jsonl`

Six live chat sessions re-recorded on **2026-10-18** using `config/host.json` (provider: `gemini`, model: `gemini-3.5-flash-lite`, `maxToolRounds: 8`) on the current dataset (commit `0af8be3` with updated `attendance.csv`). All test runs were executed with a clean report state and non-interactive acceptance.

| # | Question / Scenario (abbreviated) | Tool Calls | Rounds | Latency (totalMs) | Notes |
|---|-----------------------------------|------------|--------|-------------------|-------|
| 1 | Performance report class IT01 (semester 2024-1) | 5 calls across 2 servers (`academic`: 3, `utility`: 2) | 2 | 4,857 ms | Calls `class_statistics`, `rank_students`, `at_risk_students`, `get_current_time`, `save_report` (0 errors) |
| 2 | Conduct score student 2201002 | 1 call (`conduct_score`) | 1 | 2,154 ms | Evaluates conduct history: 85.3 (Good) |
| 3 | Attendance summary student 2201005 (exam ban check) | 1 call (`attendance_summary`) | 1 | 2,210 ms | Yields 27 absent / 105 sessions (25.7%); banned in SEC014, SEC017, SEC025, SEC029, SEC037 |
| 4 | At-risk students class IT01 | 1 call (`at_risk_students`) | 1 | 3,922 ms | Lists at-risk students with multi-factor criteria |
| 5 | Advisor briefing student 2201005 (`academic://students/2201005` + 3 tools) | 3 calls (`get_transcript`, `attendance_summary`, `conduct_score`) | 1 | 3,731 ms | Multi-tool chained briefing |
| 6 | Same briefing prompt (model answered directly from resource in context) | 0 calls | 0 | 4,040 ms | In-context reasoning from previous turn without re-calling tools |

Total: **6 sessions**, **11 tool calls** (9 on `academic`, 2 on `utility`), **6 rounds total**, **0 tool execution errors**, **20,914 ms total**.
Raw traces (arguments, outputs, token usage, LLM latency breakdown) are preserved in [`../../phase2/runs/hoang/chat-hoang-feature-test.jsonl`](../../phase2/runs/hoang/chat-hoang-feature-test.jsonl).

### Source 2 — `npm run examples` (15/15 Passed)

Verification of the end-to-end MCP pipeline against the live test suite:
- `s10-attendance-conduct.ts`: Exercises `attendance_summary`, `conduct_score`, and `at_risk_students`.
- All 15 example harnesses passed without assertion failures.

---

## Experiment 1 — Tool Description Quality (Detailed vs Terse)

### Objective
Observe LLM tool-selection accuracy and schema conformity when tools provide comprehensive descriptions versus terse 1-line definitions.

### Configurations
- **Detailed:** [`../config/experiments/tool-descriptions-detailed.json`](../config/experiments/tool-descriptions-detailed.json) (Production default with detailed docstrings, examples, and parameter constraints).
- **Terse:** [`../config/experiments/tool-descriptions-terse.json`](../config/experiments/tool-descriptions-terse.json) (Minimal configuration).

### Evidence & Findings
- **Detailed (Production Run):**
  From the 6 live sessions in Source 1 (total 11 tool calls across `class_statistics`, `rank_students`, `at_risk_students`, `get_current_time`, `save_report`, `conduct_score`, `attendance_summary`, `get_transcript`), the model achieved **100% (11/11) tool selection accuracy** on the first attempt with zero argument schema errors and zero server retries.
- **Terse Variant:** **[not run — config only]**
  *Note:* As observed during review, shortening tool descriptions requires dynamically registering terse schemas on the MCP server side; `tool-descriptions-terse.json` configures the host prompt. Running a true terse-tool benchmark requires a dedicated server mode.
  *To reproduce with host config:*
  ```bash
  cd mcp-academic
  npm run chat -- --config config/experiments/tool-descriptions-terse.json --ask "Check attendance of 2201005"
  ```

---

## Experiment 2 — Impact of `agent.maxToolRounds` (2 vs 4 vs 8)

### Objective
Evaluate the impact of capping recursive tool-calling rounds on composite, multi-step queries.

### Configurations & Raw Run Logs
- `maxToolRounds: 2`: [`../config/experiments/maxToolRounds-2.json`](../config/experiments/maxToolRounds-2.json) → Log: [`../../phase2/runs/hoang/maxToolRounds-2.jsonl`](../../phase2/runs/hoang/maxToolRounds-2.jsonl)
- `maxToolRounds: 4`: [`../config/experiments/maxToolRounds-4.json`](../config/experiments/maxToolRounds-4.json) → Log: [`../../phase2/runs/hoang/maxToolRounds-4.jsonl`](../../phase2/runs/hoang/maxToolRounds-4.jsonl)
- `maxToolRounds: 8`: [`../config/experiments/maxToolRounds-8.json`](../config/experiments/maxToolRounds-8.json) → Log: [`../../phase2/runs/hoang/maxToolRounds-8.jsonl`](../../phase2/runs/hoang/maxToolRounds-8.jsonl)

### Empirical Comparison

All 3 configurations were evaluated using the same 6 benchmark questions in `phase2/runs/hoang/maxToolRounds-*.jsonl`:

| # | Question / Scenario | `maxToolRounds: 2` | `maxToolRounds: 4` | `maxToolRounds: 8` |
|---|---------------------|--------------------|--------------------|--------------------|
| 1 | IT01 Performance Report (composite) | 2 rds, 4 calls, 4,945 ms (Completed) | 2 rds, 4 calls, 4,974 ms (Completed) | 2 rds, 4 calls, 4,998 ms (Completed) |
| 2 | Conduct Score (student 2201002) | 1 rd, 1 call, 2,091 ms | 1 rd, 1 call, 2,115 ms | 1 rd, 1 call, 2,173 ms |
| 3 | Attendance Summary (student 2201005) | 1 rd, 1 call, 2,250 ms | 1 rd, 1 call, 68,575 ms* | 2 rds, 2 calls, 3,459 ms (1 retry recovered) |
| 4 | At-risk Students (class IT01) | 1 rd, 1 call, 2,431 ms | 1 rd, 1 call, 2,421 ms | 1 rd, 1 call, 2,320 ms |
| 5 | Advisor Briefing (student 2201005) | 1 rd, 3 calls, 4,517 ms | 1 rd, 3 calls, 4,693 ms | 1 rd, 3 calls, 4,761 ms |
| 6 | Same Briefing Prompt (in-context reuse) | 1 rd, 3 calls, 4,844 ms | 0 rds, 0 calls, 3,365 ms | 0 rds, 0 calls, 3,971 ms |
| **Total** | **All 6 sessions** | **7 rds · 13 calls · 21,078 ms** | **6 rds · 10 calls · 86,143 ms\*** | **7 rds · 11 calls · 21,682 ms** |

*\*Note: Case 3 in `maxToolRounds-4` encountered a Gemini free-tier RPM rate limit (429) and automatically resumed after backoff reset. In Case 3 of `maxToolRounds-8`, the model initially emitted a leading whitespace in the tool name (`" attendance_summary"`), caught the error, and successfully recovered by calling `"attendance_summary"` on round 2.*

### Findings
1. **Minimum Bound for Multi-Step Chaining:** When report state is cleanly reset, the composite workflow in Case 1 executes in exactly 2 tool rounds (Round 1: parallel fetch of `class_statistics`, `rank_students`, `at_risk_students`; Round 2: `save_report`). Thus, `maxToolRounds: 2` represents the exact lower boundary for composite gathering-and-saving tasks; any cap below 2 (`maxToolRounds: 1`) truncates before the report can be persisted.
2. **Autonomous Error Recovery:** Higher limits (`maxToolRounds: 4` or `8`) provide crucial resilience against syntax errors or retries. As observed in Case 3 of `maxToolRounds-8`, the agent recovered from a tool name syntax issue in round 2; with a tight cap of 1 round, this task would have terminated with an error.
3. **Recommendation:** Setting `maxToolRounds: 4` (or `8`) in production provides headroom for multi-step reasoning and autonomous recovery without imposing latency overhead on single-step queries.

---

## Experiment 3 — Impact of LLM Temperature (0.0 vs 0.2 vs 1.0)

### Objective
Measure parameter extraction fidelity (`student_id`, `semester`, enum filters), latency, and token efficiency across temperature settings.

### Configurations & Raw Run Logs
- `temperature: 0.0`: [`../config/experiments/temperature-0.0.json`](../config/experiments/temperature-0.0.json) → Log: [`../../phase2/runs/hoang/temperature-0.0.jsonl`](../../phase2/runs/hoang/temperature-0.0.jsonl)
- `temperature: 0.2`: [`../config/experiments/temperature-0.2.json`](../config/experiments/temperature-0.2.json) → Log: [`../../phase2/runs/hoang/temperature-0.2.jsonl`](../../phase2/runs/hoang/temperature-0.2.jsonl)
- `temperature: 1.0`: [`../config/experiments/temperature-1.0.json`](../config/experiments/temperature-1.0.json) → Log: [`../../phase2/runs/hoang/temperature-1.0.jsonl`](../../phase2/runs/hoang/temperature-1.0.jsonl)

### Empirical Comparison

All 3 configurations were evaluated using the same 6 benchmark questions in `phase2/runs/hoang/temperature-*.jsonl`:

| # | Question / Scenario | Temperature 0.0 (Calls / Latency / Tokens) | Temperature 0.2 (Calls / Latency / Tokens) | Temperature 1.0 (Calls / Latency / Tokens) |
|---|---------------------|--------------------------------------------|--------------------------------------------|--------------------------------------------|
| 1 | IT01 Performance Report | 4 calls · 4,909 ms · 13,406 in / 1,091 out | 4 calls · 5,292 ms · 13,395 in / 1,055 out | 4 calls · 5,582 ms · 13,420 in / 1,089 out |
| 2 | Conduct Score (student 2201002) | 1 call · 1,886 ms · 7,219 in / 136 out | 1 call · 61,902 ms* · 7,219 in / 128 out | 1 call · 2,457 ms · 7,219 in / 128 out |
| 3 | Attendance Summary (student 2201005) | 1 call · 2,203 ms · 7,595 in / 261 out | 1 call · 2,879 ms · 7,595 in / 264 out | 1 call · 2,235 ms · 7,595 in / 273 out |
| 4 | At-risk Students (class IT01) | 1 call · 2,414 ms · 7,574 in / 261 out | 1 call · 2,300 ms · 7,574 in / 304 out | 1 call · 2,357 ms · 7,574 in / 369 out |
| 5 | Advisor Briefing (student 2201005) | 3 calls · 5,499 ms · 8,858 in / 1,154 out | 3 calls · 4,595 ms · 8,858 in / 853 out | 3 calls · 29,484 ms* · 9,004 in / 1,600 out |
| 6 | Context Reuse Briefing | 0 calls · 3,807 ms · 6,421 in / 1,297 out | 0 calls · 3,208 ms · 6,120 in / 1,007 out | 0 calls · 5,150 ms · 6,867 in / 1,861 out |
| **Total** | **Summary Metrics** | **10 calls · 20,718 ms · 4,200 outTokens** | **10 calls · 80,176 ms\* · 3,611 outTokens** | **10 calls · 47,265 ms\* · 5,320 outTokens** |

*\*Note: Case 2 in `temperature-0.2` and Case 5 in `temperature-1.0` hit the API rate limit and automatically completed after backoff reset.*

### Findings
1. **Parameter Extraction Fidelity:** Across all 30 tool calls (10 calls × 3 settings), parameter extraction fidelity was **100% (30/30)**. Student IDs (`2201002`, `2201005`), class ID (`IT01`), and semester tags (`2024-1`) were extracted without any hallucination across all temperatures, with zero failed tool executions.
2. **Output Formatting & Token Efficiency:** Lower temperature settings produced more concise outputs: `temperature = 0.2` yielded 3,611 total output tokens, organizing results into structured tables. Conversely, `temperature = 1.0` generated 5,320 total output tokens (+47% overhead), adding conversational prose without changing the factual results.
3. **Recommendation:** `temperature = 0.2` remains the optimal default for university academic assistant tasks.

---

## Experiment 4 — Transport Protocol: `stdio` vs `Streamable HTTP`

### Objective
Measure end-to-end invocation latency and per-tool round-trip overhead between local process stdio and Streamable HTTP transport.

### Configurations & Raw Run Logs
- **stdio:** [`../config/experiments/transport-stdio.json`](../config/experiments/transport-stdio.json) → Log: [`../../phase2/runs/hoang/transport-stdio.jsonl`](../../phase2/runs/hoang/transport-stdio.jsonl)
- **HTTP:** [`../config/experiments/transport-http.json`](../config/experiments/transport-http.json) → Log: [`../../phase2/runs/hoang/transport-http.jsonl`](../../phase2/runs/hoang/transport-http.jsonl)

### Empirical Comparison

Both configurations were executed with identical settings (`maxToolRounds: 4`, `temperature: 0.2`) on the same 6 benchmark questions:

| # | Question / Scenario | `stdio` (Total Ms / Tool Ms) | `Streamable HTTP` (Total Ms / Tool Ms) | Latency Delta |
|---|---------------------|------------------------------|----------------------------------------|---------------|
| 1 | IT01 Performance Report (composite) | 5,122 ms (4 calls · 118 ms tools) | 4,855 ms (4 calls · 123 ms tools) | -267 ms total (+5 ms tools) |
| 2 | Conduct Score (student 2201002) | 1,986 ms (1 call · 4 ms tools) | 2,497 ms (1 call · 15 ms tools) | +511 ms total (+11 ms tools) |
| 3 | Attendance Summary (student 2201005) | 2,470 ms (1 call · 5 ms tools) | 2,442 ms (1 call · 17 ms tools) | -28 ms total (+12 ms tools) |
| 4 | At-risk Students (class IT01) | 2,504 ms (1 call · 6 ms tools) | 2,412 ms (1 call · 15 ms tools) | -92 ms total (+9 ms tools) |
| 5 | Advisor Briefing (student 2201005) | 3,889 ms (3 calls · 26 ms tools) | 4,261 ms (3 calls · 72 ms tools) | +372 ms total (+46 ms tools) |
| 6 | Same Briefing Prompt (in-context reuse) | 3,595 ms (0 calls) | 73,911 ms* (0 calls) | +70,316 ms* (LLM rate limit retry) |
| **Total** | **All 6 sessions** | **19,566 ms total (159 ms tools)** | **90,378 ms\* total (242 ms tools)** | **+83 ms tool execution delta (+8.3 ms avg/call)** |

*\*Note: Case 6 in `transport-http` hit a Gemini rate limit retry (18,378 ms excluding backoff delay).*

### Per-Tool Execution Latency Breakdown

| Tool Name | `stdio` Execution Time (avg) | `HTTP` Execution Time (avg) | Overhead Delta |
|---|---|---|---|
| `class_statistics` | 85.0 ms (n=1) | 64.0 ms (n=1) | -21.0 ms (stdio cold-start) |
| `rank_students` | 11.0 ms (n=1) | 23.0 ms (n=1) | +12.0 ms |
| `at_risk_students` | 6.5 ms (n=2) | 15.5 ms (n=2) | +9.0 ms |
| `save_report` | 16.0 ms (n=1) | 21.0 ms (n=1) | +5.0 ms |
| `conduct_score` | 3.5 ms (n=2) | 15.5 ms (n=2) | +12.0 ms |
| `attendance_summary` | 4.5 ms (n=2) | 16.5 ms (n=2) | +12.0 ms |
| `get_transcript` | 18.0 ms (n=1) | 39.0 ms (n=1) | +21.0 ms |

### Findings
1. **Tool Invocation Overhead:** Warmed tool calls over local loopback HTTP have an added overhead of **~5–21 ms per call** (average **+8.3 ms/call**) compared to stdio, resulting from HTTP headers, TCP socket communication, and SSE message framing.
2. **End-to-End Latency Impact:** Because LLM generation dominates turn duration (~1.5–2.5 s per turn), this transport overhead accounts for less than 1% of total query latency.
3. **Deployment Tradeoff:** `stdio` is simpler for local single-user CLI execution; `Streamable HTTP` enables persistent server processes and multi-client access with minimal perceptible latency impact.

---

## Experiment 5 — Least-Privilege Host Configuration

Mandated by `TASKS.md §Tiến` point 5:
> host configured with only `academic` + `utility` (no `finance`) → does the LLM correctly refuse salary/tuition questions?

**Status:** **[blocked on finance server]** — The `finance` server is being developed in Tiến's PR (#2). Once merged, this test will verify tool boundary enforcement.

---

## Summary Matrix

| Experiment | Configurations Committed | Empirical Evidence | Status |
|---|---|---|---|
| 1. Tool Descriptions | Detailed & Terse configs in `config/experiments/` | Source 1 (`11/11` correct calls on detailed) | Detailed verified; Terse [config only] |
| 2. maxToolRounds | 2, 4, 8 configs in `config/experiments/` | `maxToolRounds-{2,4,8}.jsonl` (cap 2 completed in 2 rds, min safe limit) | **Empirically verified: min 2 rounds required for save workflow** |
| 3. Temperature | 0.0, 0.2, 1.0 configs in `config/experiments/` | `temperature-{0.0,0.2,1.0}.jsonl` (30/30 correct calls; T=0.2 most token-efficient) | **Empirically verified across 0.0, 0.2, 1.0** |
| 4. Transport | stdio & HTTP configs in `config/experiments/` | `transport-{stdio,http}.jsonl` (HTTP adds +8.3 ms avg per tool call) | **Empirically verified stdio vs Streamable HTTP** |
| 5. Least Privilege | Dependent on `finance` server | Pending PR #2 merge | Blocked on PR #2 |

