# Phase 1 — slide content draft (≈ 34 slides · 30 min)

Draft text for every slide, in English. TV3 builds slides 1–16 and 32–34, TV4 builds 17–31, the team lead presents 29 (live demo). **Visual** = what to put on the slide; **Source** = where the numbers/diagram come from (all paths relative to `mcp-academic/`). Keep ≤ 6 lines of text per slide.

---

### Part A — Problem, architecture, algorithms (TV3, ~11 min)

**1. MCP.2502 — Model Context Protocol with the TypeScript SDK**
- Group members, course, date
- Visual: logo MCP + our title "Academic Records Assistant"

**2. Agenda**
- Problem → MCP architecture → Protocol & algorithms → TypeScript SDK API → Live demo → Results → Q&A

**3. The problem: LLMs cannot reach your data**
- An LLM only knows its training data — not your university's grade database
- Every AI app writes a custom connector for every data source → **N apps × M sources**
- Visual: left half of the diagram "Without MCP" · Source: `docs/architecture.md` §1

**4. What is MCP?**
- An open protocol that standardises how AI applications connect to tools and data — "USB-C for AI"
- Wrap a data source once as an **MCP server**; every MCP host can use it → **N + M**
- Visual: right half of the §1 diagram

**5. Host · Client · Server**
- **Host**: the app the user talks to; it owns the LLM (our CLI, VS Code)
- **Client**: one connection from the host to one server
- **Server**: exposes tools, resources and prompts (our `academic` and `utility`)
- Visual: architecture diagram §2

**6. Tools · Resources · Prompts — who is in control?**
- Tool → chosen by the **model** (e.g. `calculate_gpa`)
- Resource → attached by the **app / user** (e.g. `academic://students/2201010`)
- Prompt → picked by the **user** like a slash command (e.g. `/academic.class_report`)
- Visual: table §2

**7. Our case study: an academic records assistant**
- Data: students, courses, grades (CSV) — 40 students, 10 courses, 261 grades, 7 deliberately broken rows
- 2 MCP servers: `academic` (10 tools, 4 resources, 2 prompts) · `utility` (3 tools)
- 2 hosts: our chat CLI and VS Code · 2 LLMs: Gemini (cloud) and Qwen3 4B (local)
- Source: `README.md`, `data/sample/README_data.md`

**8. JSON-RPC 2.0 — the message format**
- Request `{jsonrpc, id, method, params}` · Response `{id, result | error}` · Notification (no `id`)
- Visual: 3 real messages from `outputs/examples/c5-wire-trace.json` (server/discover request + response, tools/call)

**9. Session lifecycle: 2025 vs 2026-07-28**
- 2025: `initialize` → `initialized` → requests (stateful session)
- 2026-07-28: `server/discover` → requests; every request carries its own `_meta` (stateless)
- Connect cost: 2 messages vs 1 (0 with a cached verdict)
- Visual: sequence diagram §3 · Source: `docs/results.md` §4

**10. Transports: stdio vs Streamable HTTP**
- stdio: host starts the server as a child process — local tools
- Streamable HTTP: server runs separately, reachable over the network; rejects foreign Host/Origin (403)
- Visual: table from `docs/results.md` §3 (connect 181 ms stdio vs 6 ms HTTP; calls 0.2–2 ms)

**11. Main algorithm: the tool-calling loop**
- Host sends the question + all tool definitions to the LLM
- LLM returns tool calls → host executes them on the right server → returns results → repeat until the LLM answers
- Tool errors go back to the LLM so it can correct itself; `maxToolRounds` stops runaway loops
- Visual: flowchart §4

**12. Worked example: "report for IT01 and save it"**
- LLM combines 2 servers without them knowing each other: `class_statistics` → `get_current_time` → `rank_students` → `save_report`
- Real run: 4 tool calls, 3 rounds, 5.7 s
- Visual: sequence diagram §4

**13. Elicitation — human in the loop**
- The server asks the **user** mid-call: accept / decline / cancel
- 2025: server pushes `elicitation/create` · 2026: tool returns `input_required`, client answers and retries
- Real catch: the LLM filled `process_score: 0` that nobody asked for — the confirmation showed it
- Visual: sequence diagram §5

**14. Sampling — the server borrows the host's LLM**
- `generate_student_feedback` has no API key: it asks the host's model to write the text
- Host decides which model and may refuse (`sampling.approval`)
- Deprecated in 2026-07-28 (SEP-2577) — still supported
- Visual: sequence diagram §6

**15. Domain algorithm: from scores to GPA**
- Total = 40 % process + 60 % final → letter A/B/C/D/F → 4/3/2/1/0
- GPA = Σ(point × credits) / Σ credits; cumulative GPA keeps the best attempt of a retaken course
- Worked example: student 2201010 → 37 / 18 = **2.06 → Average**; semester 2024-1 alone → **0.38 → Weak**
- Visual: flowchart §7 · config `config/grading.json`

**16. Data loading & validation**
- CSV → validation → in-memory tables; bad rows are reported, never calculated
- 7 injected errors (score 11.5, missing score, unknown student/course, negative score, duplicates) → all 7 caught
- Visual: flowchart §8 + resource `academic://reports/data-quality`

### Part B — The TypeScript SDK in practice (TV4, ~9 min)

**17. MCP TypeScript SDK v2**
- Split packages: `@modelcontextprotocol/server`, `@modelcontextprotocol/client` (+ `node`, `express`, `hono` adapters)
- v1 was one package `@modelcontextprotocol/sdk`; v2 implements spec 2026-07-28 and still serves 2025 clients
- Schemas with Zod v4 (Standard Schema)

**18. Creating and serving a server**
- `new McpServer({name, version}, {instructions, capabilities})`
- `serveStdio(factory)` · `createMcpHandler(factory)` + `toNodeHandler` for HTTP
- Visual: S1 capability table (`outputs/examples/s1-mcp-server.log`)

**19. `registerTool` — input → output, with parameter sets**
- Config: `description`, `inputSchema` (Zod), `outputSchema`, `annotations`
- Parameter sets: valid · semester · retakes · unknown student (`isError`) · bad format / wrong type (rejected before the handler)
- Visual: table `docs/results.md` §2 · Source `docs/method-reference.md`

**20. Tool lifecycle**
- `disable()` / `enable()` / `update()` / `remove()` — no restart
- Each change sends `notifications/tools/list_changed` (5 received in S3)
- Visual: screenshot `outputs/examples/s3-tool-lifecycle.log`

**21. Resources and resource templates**
- Static: `academic://rules/grading` · Template: `academic://students/{student_id}` with autocompletion
- Not found → `ProtocolError -32602`
- Visual: S4 log

**22. Prompts and completion**
- `registerPrompt(name, {argsSchema}, callback)` · `completable()` suggests values as you type
- Missing argument → `-32602` (a protocol error — unlike tools)
- Visual: S5 log

**23. Progress, logging, cancellation**
- `ctx.mcpReq.notify(progress)` only when the client asked (`onprogress`) · `ctx.mcpReq.signal` stops work on cancel
- Logging filtered by `setLoggingLevel` (deprecated in 2026-07-28)
- Visual: S6 log (progress 10/40 … 40/40; "stopped after 4/20")

**24. Elicitation & sampling API**
- Server: `ctx.mcpReq.elicitInput` / `requestSampling` (2025) · `return inputRequired(...)` (2026)
- Client: `setRequestHandler('elicitation/create' | 'sampling/createMessage')`
- Visual: table `docs/results.md` §7 (accept / not ticked / decline / cancel)

**25. Client: connecting**
- `new Client(info, { versionNegotiation })`: default (2025) · `auto` · `pin`
- `connect(transport, { prior })` → zero-round-trip connect
- Visual: table `docs/results.md` §4

**26. Request options and error taxonomy**
- `timeout`, `onprogress`, `resetTimeoutOnProgress`, `maxTotalTimeout`
- Tool problems → **result.isError** (LLM can recover) · protocol problems → **ProtocolError** · local problems → **SdkError**
- Visual: both tables `docs/results.md` §5

**27. Subscriptions and caching**
- 2026: `client.listen({resourceSubscriptions})` · 2025: `subscribeResource` — grade changed → notification → re-read
- Server `cacheHints` → 3 identical `listTools()` calls reach the server once
- Visual: `docs/results.md` §6 + C3 log

**28. Configuration is all a host needs**
- Visual: `config/host.json` next to `.vscode/mcp.json` — same command line, no code change
- "One MCP server, many hosts"

**29. LIVE DEMO (team lead, 8 min)** — follow `docs/demo-script.md`

**30. Results: two LLMs, same servers**
- 11 benchmark questions × 2 runs, ground truth from the MCP tools
- Gemini 3.5 Flash-Lite (cloud) 100 % · 2.7 s · Qwen3 4B Instruct (local, 3.3 GB) 100 % · 2.1 s · Qwen3 4B Thinking 100 % · 24.4 s
- LLM ≈ 99 % of a turn; MCP tool calls 2–40 ms
- Visual: summary table `docs/model-comparison.md` · Source `docs/model-observations.md`

**31. Lessons learned**
- Tool design (names, descriptions, schemas) matters more than model size here
- Human-in-the-loop caught a real LLM mistake on a destructive tool
- "Thinking" = 10× slower, no gain on tool tasks · free cloud quotas are the real bottleneck

**32. Summary**
- MCP separates *what data/tools exist* (servers) from *who reasons* (hosts + LLMs)
- TypeScript SDK v2: small API, two protocol eras, stdio + HTTP

**33. References**
- modelcontextprotocol.io/specification/2026-07-28 · github.com/modelcontextprotocol/typescript-sdk · ts.sdk.modelcontextprotocol.io/v2

**34. Q&A**
