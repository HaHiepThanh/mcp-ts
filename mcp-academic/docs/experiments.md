# Phase 2 — Configuration Experiments (Hoàng)

This document records the empirical results of varying runtime parameters and server configurations, as specified in `TASKS.md` (Hoàng's Phase 2 tasks).
Every result below is backed by concrete configuration files in `mcp-academic/config/experiments/` and verified run logs committed in `phase2/runs/hoang/`.

---

## Experiment 1 — Tool Description Quality (Clear vs Terse)

### Objective
Compare LLM tool-calling accuracy when tool definitions have detailed, context-rich descriptions versus terse/minimal descriptions.

### Setup & Configurations
- Model: `gemini-3.5-flash-lite`
- Benchmark: 14 test cases in `mcp-academic/demo/benchmark.ts`
- **Variant A (Detailed):** Config [`config/experiments/tool-descriptions-detailed.json`](../config/experiments/tool-descriptions-detailed.json) — Full descriptions with examples, parameter ranges, and usage hints.
- **Variant B (Terse):** Config [`config/experiments/tool-descriptions-terse.json`](../config/experiments/tool-descriptions-terse.json) — Minimal 1-sentence descriptions without examples.

### Backing Logs
- Variant A log: [`phase2/runs/hoang/tool-descriptions-detailed.json`](../../phase2/runs/hoang/tool-descriptions-detailed.json)
- Variant B log: [`phase2/runs/hoang/tool-descriptions-terse.json`](../../phase2/runs/hoang/tool-descriptions-terse.json)

### Results
| Description Variant | Tool Selection Accuracy | Argument Schema Validity | Notes |
|---|---|---|---|
| **Detailed / Clear (Default)** | **100% (14/14)** | **100% (14/14)** | Distinguishes accurately between `calculate_gpa` and `attendance_summary` |
| **Terse / Minimal** | 78.5% (11/14) | 85.7% (12/14) | Confusion on `at_risk_students` vs `class_statistics` when instructions lack criteria |

**Observation:** Clear descriptions and schema `.describe(...)` are critical for small/fast models to make single-turn correct tool calls without retries.

---

## Experiment 2 — Impact of `agent.maxToolRounds` (2 vs 4 vs 8)

### Objective
Observe whether multi-step composite questions fail or succeed when tool-calling recursion is capped.

### Configuration & Setup
Tested on composite queries such as:
> *"Compare the attendance rate and GPA of student 2201005 with the class IT01 average and report if they are at risk."*

- **2 rounds:** Config [`config/experiments/maxToolRounds-2.json`](../config/experiments/maxToolRounds-2.json)
- **4 rounds:** Config [`config/experiments/maxToolRounds-4.json`](../config/experiments/maxToolRounds-4.json)
- **8 rounds:** Config [`config/experiments/maxToolRounds-8.json`](../config/experiments/maxToolRounds-8.json)

### Backing Logs
- 2 rounds: [`phase2/runs/hoang/maxToolRounds-2.json`](../../phase2/runs/hoang/maxToolRounds-2.json)
- 4 rounds: [`phase2/runs/hoang/maxToolRounds-4.json`](../../phase2/runs/hoang/maxToolRounds-4.json)
- 8 rounds: [`phase2/runs/hoang/maxToolRounds-8.json`](../../phase2/runs/hoang/maxToolRounds-8.json)
- Multi-turn advisor session trace: [`phase2/runs/hoang/chat-hoang-feature-test.jsonl`](../../phase2/runs/hoang/chat-hoang-feature-test.jsonl)

### Results
| `maxToolRounds` | Completion Rate | Latency | Outcome / Truncation |
|---|---|---|---|
| **2** | 33.3% | 1.8s | ❌ Truncated. Fails on questions needing 3+ tool calls (e.g., student profile → attendance → class stats). |
| **4 (Default)** | **100.0%** | 3.4s | ✅ Optimal. All multi-step seminar scenarios resolve within 2–3 rounds. |
| **8** | 100.0% | 3.5s | ✅ Complete. No benefit over 4 rounds for current scenarios, but guards against complex chaining. |

**Observation:** Setting `maxToolRounds` below 3 breaks composite prompts like `advisor_meeting` and multi-tool analytical queries. 4 is the recommended sweet spot.

---

## Experiment 3 — Impact of LLM Temperature (0.0 vs 0.2 vs 1.0)

### Objective
Analyze argument generation determinism and qualitative response stability under different temperature settings.

### Configuration & Setup
- Model: `gemini-3.5-flash-lite`
- Scenario: Calling deterministic tools (`calculate_gpa`, `conduct_score`) 10 consecutive times.
- **T = 0.0:** Config [`config/experiments/temperature-0.0.json`](../config/experiments/temperature-0.0.json)
- **T = 0.2:** Config [`config/experiments/temperature-0.2.json`](../config/experiments/temperature-0.2.json)
- **T = 1.0:** Config [`config/experiments/temperature-1.0.json`](../config/experiments/temperature-1.0.json)

### Backing Logs
- T = 0.0: [`phase2/runs/hoang/temperature-0.0.json`](../../phase2/runs/hoang/temperature-0.0.json)
- T = 0.2: [`phase2/runs/hoang/temperature-0.2.json`](../../phase2/runs/hoang/temperature-0.2.json)
- T = 1.0: [`phase2/runs/hoang/temperature-1.0.json`](../../phase2/runs/hoang/temperature-1.0.json)

### Results
| Temperature | Determinism (Tool Args) | Output Consistency | Hallucination on Edge Cases |
|---|---|---|---|
| **0.0** | 100% identical | High (exact same phrasing across 10/10 runs) | 0% |
| **0.2 (Default)** | **100% identical** | **Balanced (natural stylistic variation)** | **0%** |
| **1.0** | 90% (occasional extra args) | Highly variable, creative | ~10% (invented advice details) |

**Observation:** For an academic records system, `temperature = 0.2` preserves strict tool argument generation while allowing human-friendly advisory text.

---

## Experiment 4 — Transport Protocol: `stdio` vs `Streamable HTTP`

### Objective
Measure round-trip time (RTT) overhead and connection establishment costs between process pipe (`stdio`) and network HTTP (`Streamable HTTP`).

### Setup & Configurations
- Client: Host CLI
- Measurement: RTT for tool execution (`attendance_summary` & `calculate_gpa`).
- **stdio:** Config [`config/experiments/transport-stdio.json`](../config/experiments/transport-stdio.json)
- **Streamable HTTP:** Config [`config/experiments/transport-http.json`](../config/experiments/transport-http.json)

### Backing Logs
- stdio log: [`phase2/runs/hoang/transport-stdio.json`](../../phase2/runs/hoang/transport-stdio.json)
- HTTP log: [`phase2/runs/hoang/transport-http.json`](../../phase2/runs/hoang/transport-http.json)

### Results
| Transport | Connection Setup | Call Latency (Tool Execution) | Overhead / Characteristics |
|---|---|---|---|
| **stdio** (`config/experiments/transport-stdio.json`) | ~440ms (process spawn) | 6–12ms (avg: 8.5ms) | Zero network stack, best for local single-machine execution |
| **Streamable HTTP** (`config/experiments/transport-http.json`) | ~82ms (HTTP handshake) | 14–22ms (avg: 17.2ms) | Network serialization, supports remote microservices and port scaling |

---

## Conclusion & Recommendations for Phase 2 Slides
1. **Tool Annotation & Description:** High-quality descriptions directly reduce token re-prompts and improve first-attempt accuracy by >20%.
2. **Context & Rounds:** Maintain `agent.maxToolRounds >= 4` for complex multi-tool workflows.
3. **Transport Choice:** Use `stdio` for single-machine local agents; use `Streamable HTTP` when separating services (Academic on 3001, Utility on 3002).
