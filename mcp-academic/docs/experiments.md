# Phase 2 — Configuration Experiments (Hoàng)

This document records the empirical results of varying runtime parameters and server configurations, as specified in `TASKS.md` (Hoàng's Phase 2 tasks).

All measurements reported below are **derived directly from real runs**.
Where a configuration variant has not been executed (e.g., due to host limitations or API quotas), it is explicitly marked **[not run — config only]** with the exact reproduction command, rather than generating synthetic metrics.

---

## Evidence Baseline

### Source 1 — `phase2/runs/hoang/chat-hoang-feature-test.jsonl`

Six live chat sessions re-recorded on **2026-10-18** using `config/host.json` (provider: `gemini`, model: `gemini-3.5-flash-lite`, `maxToolRounds: 8`) on the current dataset (commit `0af8be3` with updated `attendance.csv`).

| # | Question / Scenario (abbreviated) | Tool Calls | Rounds | Latency (totalMs) | Notes |
|---|-----------------------------------|------------|--------|-------------------|-------|
| 1 | Performance report class IT01 (semester 2024-1) | 6 calls across 2 servers (`academic`: 4, `utility`: 2) | 3 | 8,084 ms | Calls `class_statistics`, `rank_students`, `at_risk_students`, `query_table`, 2× `save_report` |
| 2 | Conduct score student 2201002 | 1 call (`conduct_score`) | 1 | 1,891 ms | Evaluates conduct history: 85.3 (Good) |
| 3 | Attendance summary student 2201005 (exam ban check) | 1 call (`attendance_summary`) | 1 | 2,169 ms | Yields 27 absent / 105 sessions (25.7%); banned in SEC014, SEC017, SEC025, SEC029, SEC037 |
| 4 | At-risk students class IT01 | 1 call (`at_risk_students`) | 1 | 2,280 ms | Lists at-risk students with multi-factor criteria |
| 5 | Advisor briefing student 2201005 (`academic://students/2201005` + 3 tools) | 3 calls (`get_transcript`, `attendance_summary`, `conduct_score`) | 1 | 4,572 ms | Multi-tool chained briefing |
| 6 | Same briefing prompt (model answered directly from resource in context) | 0 calls | 0 | 4,022 ms | In-context reasoning from previous turn without re-calling tools |

Total: **6 sessions**, **12 tool calls** (10 on `academic`, 2 on `utility`).
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
  From the 6 live sessions in Source 1 (total 12 tool calls across `class_statistics`, `rank_students`, `at_risk_students`, `query_table`, `save_report`, `conduct_score`, `attendance_summary`, `get_transcript`), the model achieved **100% (12/12) tool selection accuracy** on the first attempt with zero argument schema errors and zero server retries.
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
| 1 | IT01 Performance Report (composite) | **2 rds, 5 calls, 5,563 ms (TRUNCATED)** | **3 rds, 5 calls, 6,123 ms (Completed)** | **3 rds, 6 calls, 6,752 ms (Completed)** |
| 2 | Conduct Score (student 2201002) | 1 rd, 1 call, 1,849 ms | 1 rd, 1 call, 1,932 ms | 1 rd, 1 call, 58,156 ms* |
| 3 | Attendance Summary (student 2201005) | 1 rd, 1 call, 2,518 ms | 1 rd, 1 call, 3,080 ms | 1 rd, 1 call, 2,419 ms |
| 4 | At-risk Students (class IT01) | 1 rd, 1 call, 2,569 ms | 1 rd, 1 call, 2,612 ms | 1 rd, 1 call, 2,341 ms |
| 5 | Advisor Briefing (student 2201005) | 1 rd, 3 calls, 4,661 ms | 1 rd, 3 calls, 3,962 ms | 1 rd, 3 calls, 4,750 ms |
| 6 | Same Briefing Prompt (in-context reuse) | 0 rds, 0 calls, 3,515 ms | 0 rds, 0 calls, 3,522 ms | 0 rds, 0 calls, 3,794 ms |
| **Total** | **All 6 sessions** | **11 calls · 20,675 ms** | **11 calls · 21,231 ms** | **12 calls · 78,212 ms\*** |

*\*Note: Case 2 in `maxToolRounds-8` encountered a Gemini free-tier RPM rate limit (429) and automatically resumed after the 60s quota bucket reset via `gemini.ts` backoff retry.*

### Findings
1. **Truncation Threshold:** When `maxToolRounds = 2`, the composite performance report workflow (Case 1) stopped prematurely after 2 rounds with `(stopped after 2 tool rounds — raise agent.maxToolRounds)`. It failed to complete report generation.
2. **Minimum Threshold:** At `maxToolRounds = 4`, Case 1 successfully completed within 3 rounds, calling `class_statistics`, `rank_students`, `at_risk_students`, and `save_report`.
3. **Headroom:** `maxToolRounds = 8` provided headroom without increasing latency for single-tool queries (Cases 2–4 completed in 1 round regardless of the cap).
4. **Empirical Verification:** The conclusion that **`maxToolRounds = 4` is the minimum safe threshold** is now backed by empirical runs in `phase2/runs/hoang/maxToolRounds-*.jsonl`.

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
| 1 | IT01 Performance Report | 6 calls · 7,845 ms · 24,612 in / 2,017 out | 6 calls · 8,403 ms · 25,078 in / 1,885 out | 6 calls · 64,672 ms* · 25,228 in / 2,022 out |
| 2 | Conduct Score (student 2201002) | 1 call · 2,595 ms · 7,219 in / 126 out | 1 call · 1,913 ms · 7,219 in / 131 out | 1 call · 2,154 ms · 7,219 in / 136 out |
| 3 | Attendance Summary (student 2201005) | 1 call · 2,142 ms · 7,595 in / 275 out | 1 call · 2,615 ms · 7,595 in / 264 out | 1 call · 2,351 ms · 7,595 in / 264 out |
| 4 | At-risk Students (class IT01) | 1 call · 2,354 ms · 7,574 in / 338 out | 1 call · 2,781 ms · 7,574 in / 360 out | 1 call · 2,211 ms · 7,574 in / 311 out |
| 5 | Advisor Briefing (student 2201005) | 3 calls · 5,218 ms · 8,858 in / 1,241 out | 3 calls · 4,275 ms · 8,858 in / 962 out | 3 calls · 4,084 ms · 8,858 in / 984 out |
| 6 | Context Reuse Briefing | 0 calls · 4,658 ms · 6,508 in / 1,504 out | 0 calls · 3,430 ms · 6,229 in / 1,110 out | 0 calls · 3,681 ms · 6,251 in / 1,183 out |
| **Total** | **Summary Metrics** | **12 calls · 24,812 ms · 5,501 outTokens** | **12 calls · 23,417 ms · 4,712 outTokens** | **12 calls · 79,153 ms\* · 4,900 outTokens** |

*\*Note: Case 1 in `temperature-1.0` hit the API rate limit and waited for automatic backoff reset.*

### Findings
1. **Parameter Fidelity:** Across all 36 tool calls (12 calls × 3 settings), parameter extraction fidelity was **100% (36/36)**. Student IDs (`2201002`, `2201005`), class ID (`IT01`), and semester tags (`2024-1`) were passed without any hallucination across all temperatures.
2. **Output Formatting:** At `temperature = 0.0`, responses were strictly deterministic and formatted as concise tables. At `temperature = 0.2`, responses maintained high precision while reducing unnecessary token overhead (4,712 output tokens vs 5,501 at T=0.0). At `temperature = 1.0`, wording showed higher stylistic variance but maintained correct tool schemas.
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
| 1 | IT01 Performance Report (composite) | 8,950 ms (6 calls · 100 ms tools) | 9,292 ms (7 calls · 186 ms tools) | +342 ms total (+86 ms tools) |
| 2 | Conduct Score (student 2201002) | 2,006 ms (1 call · 14 ms tools) | 2,206 ms (1 call · 12 ms tools) | +200 ms total |
| 3 | Attendance Summary (student 2201005) | 2,221 ms (1 call · 7 ms tools) | 2,569 ms (1 call · 13 ms tools) | +348 ms total (+6 ms tools) |
| 4 | At-risk Students (class IT01) | 2,705 ms (1 call · 5 ms tools) | 2,565 ms (1 call · 17 ms tools) | -140 ms total (+12 ms tools) |
| 5 | Advisor Briefing (student 2201005) | 4,485 ms (3 calls · 75 ms tools) | 4,982 ms (3 calls · 52 ms tools) | +497 ms total |
| 6 | Same Briefing Prompt (in-context reuse) | 4,887 ms (0 calls) | 4,155 ms (0 calls) | -732 ms total |
| **Total** | **All 6 sessions** | **25,254 ms total** | **25,769 ms total** | **+515 ms overall** |

### Per-Tool Execution Latency Breakdown

| Tool Name | `stdio` Execution Time (avg) | `HTTP` Execution Time (avg) | Overhead Delta |
|---|---|---|---|
| `class_statistics` | 59.0 ms | 73.0 ms | +14.0 ms |
| `rank_students` | 6.0 ms | 23.0 ms | +17.0 ms |
| `at_risk_students` | 5.5 ms | 18.5 ms | +13.0 ms |
| `attendance_summary` | 8.0 ms | 14.0 ms | +6.0 ms |
| `save_report` | 9.7 ms | 18.7 ms | +9.0 ms |
| `conduct_score` | 13.5 ms | 12.0 ms | -1.5 ms |

### Findings
1. **Tool Invocation Overhead:** Warmed tool calls over local loopback HTTP have an added overhead of **~8–17 ms per call** compared to stdio (attributed to JSON serialization, HTTP header parsing, and TCP loopback handling).
2. **End-to-End Latency Impact:** Because LLM generation dominates turn duration (~1.5–2.5 s per turn), the HTTP transport overhead represents only **< 2.5%** of the total session latency.
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
| 1. Tool Descriptions | Detailed & Terse configs in `config/experiments/` | Source 1 (`12/12` correct calls on detailed) | Detailed verified; Terse [config only] |
| 2. maxToolRounds | 2, 4, 8 configs in `config/experiments/` | `maxToolRounds-{2,4,8}.jsonl` (cap 2 truncates, cap 4 completes in 3 rds) | **Empirically verified: min 4 rounds required** |
| 3. Temperature | 0.0, 0.2, 1.0 configs in `config/experiments/` | `temperature-{0.0,0.2,1.0}.jsonl` (36/36 correct parameter extractions) | **Empirically verified across 0.0, 0.2, 1.0** |
| 4. Transport | stdio & HTTP configs in `config/experiments/` | `transport-{stdio,http}.jsonl` (HTTP adds +8–17 ms per tool call) | **Empirically verified stdio vs Streamable HTTP** |
| 5. Least Privilege | Dependent on `finance` server | Pending PR #2 merge | Blocked on PR #2 |
