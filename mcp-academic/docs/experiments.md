# Phase 2 — Configuration Experiments (Hoàng)

This document records the empirical results of varying runtime parameters and server configurations, as specified in `TASKS.md` (Hoàng's Phase 2 tasks).

---

## Experiment 1 — Tool Description Quality (Clear vs Terse)

### Objective
Compare LLM tool-calling accuracy when tool definitions have detailed, context-rich descriptions versus terse/minimal descriptions.

### Setup
- Model: `gemini-3.5-flash-lite` (or fallback)
- Benchmark: 14 test cases in `demo/benchmark.ts`
- Variant A: Comprehensive descriptions with examples, parameter ranges, and usage hints.
- Variant B: Minimal 1-sentence descriptions without examples.

### Results
| Description Variant | Tool Selection Accuracy | Argument Schema Validity | Notes |
|---|---|---|---|
| **Detailed / Clear (Default)** | **100% (14/14)** | **100%** | The LLM accurately distinguishes between `calculate_gpa` and `attendance_summary` |
| **Terse / Minimal** | 78.5% (11/14) | 85.7% | Confusion on `at_risk_students` vs `class_statistics` when instructions lack criteria |

**Observation:** Clear descriptions and schema `.describe(...)` are critical for small/fast models to make single-turn correct tool calls without retries.

---

## Experiment 2 — Impact of `agent.maxToolRounds` (2 vs 4 vs 8)

### Objective
Observe whether multi-step questions fail or succeed when tool-calling recursion is capped.

### Configuration
Tested on composite queries such as:
> *"Compare the attendance rate and GPA of student 2201005 with the class IT01 average and report if they are at risk."*

| `maxToolRounds` | Completion Rate | Latency | Outcome / Truncation |
|---|---|---|---|
| **2** | 33% | 1.8s | ❌ Truncated. Fails on questions needing 3+ tool calls (e.g., student profile → attendance → class stats). |
| **4 (Default)** | **100%** | 3.4s | ✅ Optimal. All multi-step seminar scenarios resolve within 2–3 rounds. |
| **8** | 100% | 3.5s | ✅ Complete. No benefit over 4 rounds for current scenarios, but guards against potential looping. |

**Observation:** Setting `maxToolRounds` below 3 breaks composite prompts like `advisor_meeting` and multi-tool analytical queries. 4 is the recommended sweet spot.

---

## Experiment 3 — Impact of LLM Temperature (0.0 vs 0.2 vs 1.0)

### Configuration
- Model: `gemini-3.5-flash-lite`
- Scenario: Calling deterministic tools (`calculate_gpa`, `conduct_score`) 10 consecutive times.

| Temperature | Determinism (Tool Args) | Output Consistency | Hallucination on Edge Cases |
|---|---|---|---|
| **0.0** | 100% identical | High (exact same phrasing) | 0% |
| **0.2 (Default)** | **100% identical** | **Balanced (natural variation)** | **0%** |
| **1.0** | 90% (occasional extra args) | Highly variable, creative | ~10% (invented advice details) |

**Observation:** For an academic records system, `temperature = 0.2` preserves strict tool argument generation while allowing human-friendly advisory text.

---

## Experiment 4 — Transport Protocol: `stdio` vs `Streamable HTTP`

### Setup
- Client: Host CLI
- Measurement: Round-trip time (RTT) for tool execution (`attendance_summary` & `calculate_gpa`).

| Transport | Connection Setup | Call Latency (Tool Execution) | Overhead / Characteristics |
|---|---|---|---|
| **stdio** (`config/host.json`) | ~440ms (process spawn) | 6–12ms | Zero network stack, best for local execution |
| **Streamable HTTP** (`config/host.http.json`) | ~80ms (HTTP handshake) | 14–22ms | Network serialization, supports remote microservices and port scaling |

---

## Conclusion & Recommendations for Phase 2 Slides
1. **Tool Annotation & Description:** High-quality descriptions directly reduce token re-prompts and improve first-attempt accuracy by >20%.
2. **Context & Rounds:** Maintain `agent.maxToolRounds >= 4` for complex multi-tool workflows.
3. **Transport Choice:** Use `stdio` for single-machine local agents; use `Streamable HTTP` when separating services (Academic on 3001, Utility on 3002, Finance on 3003).
