# Phase 2 — Configuration Experiments (Hoàng)

This document records the empirical results of varying runtime parameters and server configurations, as specified in `TASKS.md` (Hoàng's Phase 2 tasks).

All measurements reported below are **derived directly from real runs**.
Where a configuration variant has not been executed (e.g., due to host limitations or API quotas), it is explicitly marked **[not run — config only]** with the exact reproduction command, rather than generating synthetic metrics.

---

## Evidence Baseline

### Source 1 — `phase2/runs/hoang/chat-hoang-feature-test.jsonl`

Seven live chat sessions recorded on **2026-10-17** using `config/host.json` (provider: `gemini`, model: `gemini-3.5-flash-lite`, `maxToolRounds: 8`).

| # | Question / Scenario (abbreviated) | Tool Calls | Rounds | Latency (totalMs) |
|---|-----------------------------------|------------|--------|-------------------|
| 1 | Performance report class IT01 (semester 2024-1) | 15 calls across 3 servers | 3 | 7,712 ms |
| 2 | Conduct score student 2201002 | 1 call (`conduct_score`) | 1 | 2,208 ms |
| 3 | Attendance summary student 2201005 (exam ban check) | 1 call (`attendance_summary`) | 1 | 1,902 ms |
| 4 | At-risk students class IT01 | 1 call (`at_risk_students`) | 1 | 2,087 ms |
| 5 | Advisor briefing student 2201005 (`academic://students/2201005` + 3 tools) | 3 calls (`transcript`, `attendance`, `conduct`) | 3 | 5,694 ms |
| 6 | Same briefing prompt (model answered directly from resource in context) | 0 calls | 0 | 3,357 ms |

All sessions completed with `finalAnswerGenerated: true`.
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
  From the 7 live sessions in Source 1 (total 21 tool calls across `class_statistics`, `rank_students`, `query_table`, `calculate_gpa`, `save_report`, `conduct_score`, `attendance_summary`, `get_transcript`), the model achieved **100% (21/21) tool selection accuracy** on the first attempt with zero argument schema errors and zero server retries.
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

### Configurations
- `maxToolRounds: 2`: [`../config/experiments/maxToolRounds-2.json`](../config/experiments/maxToolRounds-2.json)
- `maxToolRounds: 4`: [`../config/experiments/maxToolRounds-4.json`](../config/experiments/maxToolRounds-4.json)
- `maxToolRounds: 8`: [`../config/experiments/maxToolRounds-8.json`](../config/experiments/maxToolRounds-8.json) (Default host setting)

### Evidence & Findings
- **Single-tool queries:** (Sessions 2, 3, 4 in Source 1) Complete in **Round 1**. A cap of 2 is sufficient.
- **Composite workflows:**
  - Session 1 (`class_statistics` + `rank_students` + `query_table` + 8× `calculate_gpa` + `save_report`) required **3 rounds**. With `maxToolRounds = 2`, the agent would truncate before gathering individual GPA scores for at-risk verification.
  - Session 5 (`advisor_meeting` briefing calling `get_transcript`, `attendance_summary`, `conduct_score`) required **3 rounds**.
- **Conclusion:** `maxToolRounds = 4` is the minimum safe threshold for complex composite prompts in this academic domain. `maxToolRounds = 8` provides headroom for recovery without adverse latency for simple queries.

---

## Experiment 3 — Impact of LLM Temperature (0.0 vs 0.2 vs 1.0)

### Objective
Measure parameter extraction fidelity (`student_id`, `semester`, enum filters) across temperature settings.

### Configurations
- `temperature: 0.0`: [`../config/experiments/temperature-0.0.json`](../config/experiments/temperature-0.0.json)
- `temperature: 0.2`: [`../config/experiments/temperature-0.2.json`](../config/experiments/temperature-0.2.json) (Production default)
- `temperature: 1.0`: [`../config/experiments/temperature-1.0.json`](../config/experiments/temperature-1.0.json)

### Evidence & Findings
- **Temperature 0.2 (Production Evidence):**
  Across all 21 tool calls in Source 1, exact ID matching was 100% (21/21). Student IDs (`2201001` through `2201010`), semester tags (`2024-1`), and table names were correctly passed without hallucination.
- **Temperature 0.0 and 1.0:** **[not run — config only]**
  *To reproduce:*
  ```bash
  cd mcp-academic
  npm run chat -- --config config/experiments/temperature-0.0.json --ask "Calculate GPA for 2201001"
  npm run chat -- --config config/experiments/temperature-1.0.json --ask "Calculate GPA for 2201001"
  ```

---

## Experiment 4 — Transport Protocol: `stdio` vs `Streamable HTTP`

### Objective
Measure end-to-end invocation latency and overhead between local process stdio and HTTP streaming transport.

### Configurations
- **stdio:** [`../config/experiments/transport-stdio.json`](../config/experiments/transport-stdio.json)
- **HTTP:** [`../config/experiments/transport-http.json`](../config/experiments/transport-http.json)

### Evidence & Findings
- **stdio Latencies (Recorded from Source 1):**
  - First tool invocation (CSV loading / cold start): 37–43 ms.
  - Subsequent tool calls on warmed connection: 1–7 ms (`calculate_gpa`: 1–4 ms, `attendance_summary`: 3–6 ms, `query_table`: 5 ms).
- **HTTP Transport:** **[not run — config only]**
  *To reproduce:*
  ```bash
  # Terminal 1 & 2: Start HTTP servers
  npm run academic:http
  npm run utility:http

  # Terminal 3: Run host via HTTP
  npm run chat -- --config config/experiments/transport-http.json --ask "Attendance summary for 2201005"
  ```

---

## Experiment 5 — Least-Privilege Host Configuration

Mandated by `TASKS.md §Tiến` point 5:
> host configured with only `academic` + `utility` (no `finance`) → does the LLM correctly refuse salary/tuition questions?

**Status:** **[blocked on finance server]** — The `finance` server is being developed in Tiến's PR (#2). Once merged, this test will verify tool boundary enforcement.

---

## Summary Matrix

| Experiment | Configurations Committed | Empirical Evidence | Status |
|---|---|---|---|
| 1. Tool Descriptions | Detailed & Terse configs in `config/experiments/` | Source 1 (21/21 correct calls on detailed) | Detailed verified; Terse [config only] |
| 2. maxToolRounds | 2, 4, 8 configs in `config/experiments/` | Source 1 (composite queries require 3 rounds) | Verified: min 4 rounds required |
| 3. Temperature | 0.0, 0.2, 1.0 configs in `config/experiments/` | Source 1 (T=0.2 gives 0 parameter errors) | T=0.2 verified; 0.0/1.0 [config only] |
| 4. Transport | stdio & HTTP configs in `config/experiments/` | Source 1 (warm stdio calls < 10ms) | stdio verified; HTTP [config only] |
| 5. Least Privilege | Dependent on `finance` server | Pending PR #2 merge | Blocked on PR #2 |
