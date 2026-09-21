# Architecture, algorithms and flowcharts

Diagrams are written in Mermaid: paste a block into <https://mermaid.live> to export PNG/SVG for the slides, or redraw them in draw.io. Every diagram describes code that exists in this repository; the file that implements each step is named next to it.

---

## 1. The problem MCP solves

Without a standard, every AI application writes its own connector for every data source (**N apps × M sources** connectors). MCP defines one protocol: each source is wrapped once as an **MCP server**, and every MCP-capable application (**host**) can use it (**N + M**).

```mermaid
flowchart LR
    subgraph Before["Without MCP: N × M connectors"]
        A1[Chat app] --- D1[(Grades DB)]
        A1 --- D2[(File system)]
        A2[IDE assistant] --- D1
        A2 --- D2
    end
    subgraph After["With MCP: N + M"]
        H1[Chat app] --- P((MCP))
        H2[IDE assistant] --- P
        P --- S1[academic server] --- DB1[(Grades CSV)]
        P --- S2[utility server] --- DB2[(Reports folder)]
    end
```

## 2. Roles in this project

| Role | What it is | Here |
| --- | --- | --- |
| **Host** | The application the user talks to; it owns the LLM | Our chat host (`src/host/`), VS Code |
| **Client** | One connection from the host to one server (`@modelcontextprotocol/client`) | One `Client` per server in `src/host/mcp-hub.ts` |
| **Server** | Exposes tools, resources and prompts (`@modelcontextprotocol/server`) | `academic`, `utility` |
| **LLM** | Decides which tool to call and with which arguments | Gemini (`src/host/providers/gemini.ts`) |

```mermaid
flowchart TB
    U([User]) --> H
    subgraph H["Host (our chat CLI or VS Code)"]
        LLM{{"LLM — Gemini"}}
        C1[MCP Client #1]
        C2[MCP Client #2]
    end
    C1 <-->|"JSON-RPC over stdio or Streamable HTTP"| S1
    C2 <-->|"JSON-RPC over stdio or Streamable HTTP"| S2
    subgraph S1["academic server"]
        T1[10 tools] --- R1[4 resources] --- P1[2 prompts]
    end
    subgraph S2["utility server"]
        T2[3 tools] --- R2[1 resource]
    end
    S1 --> CSV[(students.csv · courses.csv · grades.csv)]
    S2 --> FS[(outputs/reports/)]
```

**Three server primitives — who decides to use them:**

| Primitive | Controlled by | Example |
| --- | --- | --- |
| Tool | the **model** (LLM picks it) | `calculate_gpa(student_id)` |
| Resource | the **application/user** (attached as context) | `academic://students/2201010` |
| Prompt | the **user** (chosen like a slash command) | `/academic.class_report class_id=IT01` |

## 3. Protocol: JSON-RPC 2.0 and two eras

Every message is a JSON-RPC 2.0 **request** (`id` + `method` + `params`), **response** (`id` + `result` or `error`) or **notification** (`method`, no `id`). Real captured messages: `outputs/examples/c5-wire-trace.json` (example C5).

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant S as Server
    rect rgb(235,242,255)
    note over C,S: 2025 era — stateful session
    C->>S: initialize {protocolVersion, capabilities, clientInfo}
    S-->>C: result {protocolVersion, capabilities, serverInfo, instructions}
    C-)S: notifications/initialized
    C->>S: tools/list
    S-->>C: result {tools: [...]}
    C->>S: tools/call {name, arguments}
    S-->>C: result {content, structuredContent}
    end
    rect rgb(235,255,240)
    note over C,S: 2026-07-28 era — every request self-describing (_meta envelope)
    C->>S: server/discover
    S-->>C: result {supportedVersions, capabilities, instructions}
    C->>S: tools/list
    S-->>C: result {tools, ttlMs, cacheScope}
    C->>S: tools/call {name, arguments}
    S-->>C: result {content, structuredContent}
    end
```

| | 2025 era | 2026-07-28 era |
| --- | --- | --- |
| Opening | `initialize` + `notifications/initialized` (2 messages) | `server/discover` (1) — 0 with a cached verdict (`prior`) |
| Client identity | once, at initialize | in every request's `_meta` |
| Server asks the client something | pushes `elicitation/create` / `sampling/createMessage` mid-call | returns `input_required`; the client answers and **retries** the call |
| Change notifications | pushed unsolicited; `resources/subscribe` | one `subscriptions/listen` stream with a filter |
| `ping`, `logging/setLevel` | yes | no (logging and sampling deprecated, SEP-2577) |
| Response caching | — | `ttlMs` / `cacheScope` on cacheable results |

Our servers serve **both** eras from the same code (`serveStdio`, `createMcpHandler`; `src/lib/interaction.ts` picks the right mechanism).

## 4. Main algorithm — the host's tool-calling loop

Implemented in `ChatHost.ask()` (`src/host/host.ts`).

```mermaid
flowchart TD
    A([User question]) --> B[Build message: attached resources + question]
    B --> C["LLM request with ALL tools of ALL servers<br/>(names qualified: academic__calculate_gpa)"]
    C --> D{Model returned tool calls?}
    D -- no --> Z([Answer shown to the user + turn logged to JSONL])
    D -- yes --> E{rounds < maxToolRounds?}
    E -- no --> Y([Stop: round limit reached]) --> Z
    E -- yes --> F[For each call: split server / tool name]
    F --> G["client.callTool(name, arguments) on that server's Client"]
    G --> H{Result isError?}
    H -- yes --> I["Send {error: message} back — the model can fix its call"]
    H -- no --> J["Send {result: structuredContent or text} back"]
    I --> K[All calls of this round done]
    J --> K
    K --> C
```

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant H as Host
    participant L as Gemini
    participant A as academic server
    participant T as utility server
    U->>H: "Write a performance report for IT01 and save it"
    H->>L: question + 13 tool definitions
    L-->>H: call class_statistics(IT01), get_current_time()
    H->>A: tools/call class_statistics
    A-->>H: {average_gpa: 2.92, pass_rate: 0.91, ...}
    H->>T: tools/call get_current_time
    T-->>H: {current_semester: "2026-1", ...}
    H->>L: tool results
    L-->>H: call rank_students(class, IT01)
    H->>A: tools/call rank_students
    A-->>H: {ranking: [...]}
    H->>L: tool results
    L-->>H: call save_report(IT01-report, markdown)
    H->>T: tools/call save_report
    T-->>H: {saved: outputs/reports/IT01-report.md}
    H->>L: tool result
    L-->>H: final answer (text)
    H-->>U: "Report saved to outputs/reports/IT01-report.md"
```

(Real run: 4 tool calls, 3 rounds, 5.7 s — the two servers never talk to each other; the LLM combines them.)

## 5. Human in the loop — elicitation (`update_grade`, `save_report`)

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant H as Host (client)
    participant S as academic server
    rect rgb(235,242,255)
    note over H,S: 2025 era — push
    H->>S: tools/call update_grade {final_score: 8}
    S->>H: elicitation/create "Update CS202 ...? total 6.4 (C)"
    H->>U: Confirm? (y/n/c)
    U-->>H: y
    H-->>S: {action: accept, content: {confirm: true}}
    S-->>H: result "Grade updated … GPA 1 → 1.33"
    end
    rect rgb(235,255,240)
    note over H,S: 2026-07-28 era — input_required + retry
    H->>S: tools/call update_grade {final_score: 8}
    S-->>H: result {resultType: input_required, inputRequests: {confirm_update: elicit}}
    H->>U: Confirm? (y/n/c)
    U-->>H: y
    H->>S: tools/call update_grade (same args + inputResponses)
    S-->>H: result "Grade updated …"
    end
```

The user can **accept**, **decline** or **cancel**; only an accepted, ticked confirmation changes data. In testing this caught a real LLM mistake (it filled `process_score: 0` that the user never asked for).

## 6. Sampling — the server borrows the host's LLM (`generate_student_feedback`)

```mermaid
sequenceDiagram
    participant L as Gemini
    participant H as Host
    participant S as academic server
    H->>S: tools/call generate_student_feedback {student_id}
    S->>S: build prompt from transcript + GPA
    S->>H: sampling/createMessage {messages, systemPrompt, maxTokens}  (2026: inside input_required)
    H->>L: generate (host's own API key)
    L-->>H: feedback text
    H-->>S: {model, content}
    S-->>H: result "Feedback … (written by gemini-3.5-flash-lite)"
```

The server needs no API key — the host decides which model runs and can refuse (`sampling.approval` in `config/host.json`). Sampling is deprecated in 2026-07-28 (servers are advised to call an LLM directly).

## 7. Domain algorithm — from scores to GPA

Implemented in `src/server/academic/grading.ts`; thresholds in `config/grading.json`.

```mermaid
flowchart TD
    A[process_score, final_score on 10-point scale] --> B["total = 0.4 × process + 0.6 × final<br/>rounded to 1 decimal"]
    B --> C{total ≥ 8.5?}
    C -- yes --> A4[A · 4.0]
    C -- no --> D{≥ 7.0?}
    D -- yes --> B3[B · 3.0]
    D -- no --> E{≥ 5.5?}
    E -- yes --> C2[C · 2.0]
    E -- no --> F{≥ 4.0?}
    F -- yes --> D1[D · 1.0]
    F -- no --> F0[F · 0 · failed]
    A4 & B3 & C2 & D1 & F0 --> G{Which GPA?}
    G -- semester --> H[every attempt in that semester]
    G -- cumulative --> I[best attempt per course · retake policy 'highest']
    H & I --> J["GPA = Σ(point × credits) / Σ credits · 2 decimals"]
    J --> K{"≥3.6 Excellent · ≥3.2 Very good · ≥2.5 Good · ≥2.0 Average · else Weak"}
```

**Worked example (student 2201010, cumulative):** best attempts GE101 C(2)×2, GE102 B(3)×3, CS101 D(1)×3, CS102 C(2)×3, CS201 B(3)×4, CS202 D(1)×3 → (4+9+3+6+12+3)/18 = **37/18 = 2.06 → Average**. Semester 2024-1 alone (F, F, D): (0×2+0×3+1×3)/8 = **0.38 → Weak**.

## 8. Loading and validating the data

```mermaid
flowchart LR
    A[CSV files in dataDir] --> B[parseCsv — RFC 4180, UTF-8 BOM]
    B --> C{row valid?}
    C -- "missing id · unknown student/course<br/>score outside 0–10 · duplicate" --> D[issues list → academic://reports/data-quality]
    C -- yes --> E[(in-memory maps: students · courses · grades)]
    E --> F[tools · resources · prompts]
    F -- update_grade --> E
    E -- grade changed --> G[notifications/resources/updated to subscribers]
```

The sample data contains 7 deliberately invalid rows; all 7 are detected and reported, none reaches a calculation.
