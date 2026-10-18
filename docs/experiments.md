# Experiment Log — Phase 2 (Hoàng)

All measurements in this file are **derived directly from real runs**.
Numbers that could not be verified by a real run are explicitly marked
**[not run — config only]** so the reader can reproduce them independently.

---

## Evidence baseline

### Source 1 — `phase2/runs/hoang/chat-hoang-feature-test.jsonl`

Seven live chat sessions recorded on **2026-10-17** using
`config/host.json` (provider: `gemini`, model: `gemini-3.5-flash-lite`,
`maxToolRounds` = 4 per `config/host.json` default).

| # | Question (abbreviated) | Tool calls | Rounds | totalMs |
|---|------------------------|-----------|--------|---------|
| 1 | Performance report class IT01 (semester 2024-1) | 15 calls across 3 servers | 3 | 7 712 ms |
| 2 | Conduct score student 2201002 | 1 | 1 | 2 208 ms |
| 3 | Attendance summary student 2201005 — exam ban? | 1 | 1 | 1 902 ms |
| 4 | At-risk students class IT01 | 1 | 1 | 2 087 ms |
| 5 | Advisor briefing student 2201005 (resource + 3 tools) | 3 | 3 | 5 694 ms |
| 6 | Same briefing — session 6 (model answered from context, 0 tool calls) | 0 | 0 | 3 357 ms |

All sessions completed with `finalAnswerGenerated: true`.
Full raw logs (tool arguments, tool outputs, LLM call timings, token
usage) are in the JSONL file.

### Source 2 — `npm run examples` (15/15 pass)

```
npm run examples            # mcp-academic/
  s01 … s10-attendance-conduct  all pass  ✅
  Total: 15/15
```

`s10-attendance-conduct.ts` exercises the new attendance + conduct tools
end-to-end and is the primary correctness evidence for those features.

---

## Experiment 1 — Tool Description Quality

**Hypothesis:** Richer descriptions improve tool-selection accuracy.

**Config files committed:**
- `config/experiments/tool-descriptions-detailed.json` — full
  descriptions (production default, `temperature 0.2`, `maxToolRounds 4`)
- `config/experiments/tool-descriptions-terse.json` — one-line
  descriptions, all other parameters identical

**Observed evidence (Source 1, detailed config = production default):**

Sessions 1–5 in `chat-hoang-feature-test.jsonl` ran with the default
`host.json`, whose tool descriptions are the _detailed_ variant.
The model chose the correct tool on the first attempt in every round
(zero retries, zero wrong-server calls across 21 tool calls total).

Session 6 (same question as session 5) returned a complete, correct
answer with **0 tool calls** — the model reasoned from the resource URI
already in the prompt — demonstrating that descriptions do not
accidentally force unnecessary calls.

**Terse variant:** [not run — config only].
The terse config is committed at `config/experiments/tool-descriptions-terse.json`
and can be reproduced by running:
```bash
cd mcp-academic
node --import tsx scripts/compare-models.ts \
  --config config/experiments/tool-descriptions-terse.json
```

**Conclusion (partial):** Detailed descriptions → 0 mis-selections over
21 calls; terse-variant baseline not yet collected.

---

## Experiment 2 — Impact of `agent.maxToolRounds`

**Hypothesis:** A cap that is too low forces the agent to truncate
multi-step answers; a cap ≥ the natural depth has no extra cost.

**Config files committed:**
- `config/experiments/maxToolRounds-2.json` (cap = 2)
- `config/experiments/maxToolRounds-4.json` (cap = 4)
- `config/experiments/maxToolRounds-8.json` (cap = 8)

**Observed evidence (Source 1, cap = 4):**

Session 1 (composite performance-report query) required **3 rounds**
before the model could write the final answer. Had the cap been 2, round
3 — which fetched individual GPA values for at-risk students — would have
been cut off and the "students at risk" section of the report would have
been incomplete.

Sessions 2–4 each completed in **1 round**, so for simple, single-tool
queries the cap is irrelevant.

Session 5 (advisor briefing with 3 tools) completed in **3 rounds**;
again a cap of 2 would have prevented the `conduct_score` call.

**Cap = 2 and cap = 8 variants:** [not run — configs only].

**Conclusion (partial):** The natural tool-round depth for the tested
queries is 1–3. A cap ≥ 4 is safe for all observed queries; cap = 2
would break the composite performance-report query.

---

## Experiment 3 — `llm.temperature` (0.0 / 0.2 / 1.0)

**Hypothesis:** Higher temperature increases variance in tool-argument
values (e.g., spelling of student IDs, semester strings).

**Config files committed:**
- `config/experiments/temperature-0.0.json`
- `config/experiments/temperature-0.2.json`
- `config/experiments/temperature-1.0.json`

**Observed evidence:** All sessions in Source 1 ran at `temperature 0.2`
(the default in `config/host.json`). At that setting the model produced
exact `student_id` and `semester` values matching the DB on every call
(21/21 tool calls, 0 argument errors).

**Temperature 0.0 and 1.0 variants:** [not run — configs only].

**To reproduce:**
```bash
cd mcp-academic
node --import tsx scripts/compare-models.ts \
  --config config/experiments/temperature-1.0.json
```

**Conclusion (partial):** `temperature 0.2` yields exact argument
fidelity over 21 tool calls; 0.0 and 1.0 baselines not yet collected.

---

## Experiment 4 — Transport: stdio vs Streamable HTTP

**Hypothesis:** HTTP transport adds fixed TCP overhead per tool call;
stdio latency is lower for local calls.

**Config files committed:**
- `config/experiments/transport-stdio.json` — subprocess stdio (default)
- `config/experiments/transport-http.json` — servers at
  `http://127.0.0.1:3001/mcp` and `http://127.0.0.1:3002/mcp`

**Observed evidence (Source 1, stdio):**

Individual tool-call latencies recorded in session 1
(all via stdio against the default `config/host.json`):

| Tool | ms |
|------|----|
| `class_statistics` | 37 |
| `rank_students` | 7 |
| `query_table` | 5 |
| `calculate_gpa` (×8) | 1–4 per call |
| `attendance_summary` | 3–43 (first call initialises CSV) |
| `conduct_score` | 3 |
| `save_report` | 11 |

First call to each server is slower (37 ms, 43 ms) due to CSV
initialisation; subsequent calls to the same server are < 10 ms.

**HTTP variant:** [not run — config only]. To measure HTTP overhead,
start both servers in HTTP mode first:
```bash
node --import tsx src/server/academic/main.ts --http &
node --import tsx src/server/utility/main.ts --http &
node --import tsx scripts/compare-models.ts \
  --config config/experiments/transport-http.json
```

**Conclusion (partial):** stdio tool-call latency after warm-up is
< 10 ms; HTTP baseline not yet collected.

---

## Experiment 5 — Least-Privilege Host Configuration

Mandated by `TASKS.md §Tiến` point 5:
> host configured with only `academic` + `utility` (no `finance`) →
> does the LLM correctly refuse salary/tuition questions?

This experiment requires the `finance` server (Tiến's PR, not yet
merged). It will be documented here once that server is available.

**Status:** [blocked on finance server — not run]

---

## Summary table

| Experiment | Config files committed | Evidence source | Status |
|------------|----------------------|-----------------|--------|
| 1 – Tool descriptions | ✅ 2 files | chat JSONL (21 tool calls, 0 mis-selections) | Detailed ✅ / Terse [not run] |
| 2 – maxToolRounds | ✅ 3 files | chat JSONL (rounds 1–3 observed) | Partial — cap ≥ 4 safe |
| 3 – Temperature | ✅ 3 files | chat JSONL (0.2 = 0 arg errors) | Partial — 0.0/1.0 [not run] |
| 4 – Transport | ✅ 2 files | chat JSONL (stdio ms per call) | Partial — HTTP [not run] |
| 5 – Least privilege | n/a | blocked on finance server | [not run] |
