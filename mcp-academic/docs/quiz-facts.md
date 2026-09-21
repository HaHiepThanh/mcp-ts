# Facts for the multiple-choice quiz

Every fact below is shown in the slides or the demo and is backed by code or a recorded run (source in brackets), so other groups can answer from what we present. The quiz author picks 10–20 and writes 4 options each; the "tempting wrong answers" column gives ready-made distractors.

| # | Fact (correct answer) | Tempting wrong answers | Source |
| --- | --- | --- | --- |
| 1 | MCP standardises how AI applications connect to tools and data, turning N×M custom connectors into N+M | "MCP is a new LLM", "MCP replaces REST APIs" | architecture §1 |
| 2 | The **host** is the application that contains the LLM; each **client** holds one connection to one server | "the server contains the LLM" | architecture §2 |
| 3 | Tools are chosen by the **model**, resources by the **application/user**, prompts by the **user** | "all three are chosen by the model" | architecture §2 |
| 4 | MCP messages use **JSON-RPC 2.0** (request, response, notification) | "GraphQL", "gRPC", "SOAP" | C5 wire trace |
| 5 | A JSON-RPC **notification** has no `id` and expects no response | "a notification always has id 0" | C5 |
| 6 | Official transports: **stdio** (host spawns the server process) and **Streamable HTTP** | "WebSocket only", "FTP" | S8 |
| 7 | In the TypeScript SDK v2 the server and client are separate packages: `@modelcontextprotocol/server` and `@modelcontextprotocol/client` (v1 was one package `@modelcontextprotocol/sdk`) | "one package in v2" | README |
| 8 | A tool is registered with `server.registerTool(name, config, handler)`; `inputSchema` is a **Zod** schema | "`server.addTool`", "a JSON string" | S2 |
| 9 | Arguments that fail a tool's `inputSchema` come back as a **result with `isError: true`**, so the LLM can read it and retry | "the server crashes", "an HTTP 500" | S2, C2 |
| 10 | Wrong arguments to a **prompt** throw a protocol error with code **-32602** (Invalid params) | "-32601", "isError result like tools" | S5, C2 |
| 11 | `outputSchema` + `structuredContent` return machine-readable results; data violating the schema is rejected by the SDK | "outputSchema is only documentation" | S2 case E |
| 12 | Tool `annotations` (readOnlyHint, destructiveHint) are **hints only** — they do not change how the tool runs | "readOnlyHint blocks writes" | S2 case D |
| 13 | `RegisteredTool.disable()` hides a tool and sends `notifications/tools/list_changed` | "requires restarting the server" | S3 |
| 14 | A `ResourceTemplate` such as `academic://students/{student_id}` exposes many resources with one registration | "one registration per student" | S4 |
| 15 | `completable()` lets a server suggest values while the user types a prompt argument | "the LLM generates the suggestions" | S5 |
| 16 | **Elicitation** lets the server ask the **user** a question in the middle of a tool call (accept / decline / cancel) | "asks the LLM", "only yes/no" | S7, demo 4 |
| 17 | **Sampling** lets the server borrow the **host's LLM**; the server needs no API key | "the server calls OpenAI with its own key" | S7, demo 6 |
| 18 | Protocol **2026-07-28** replaces `initialize` with **`server/discover`** | "handshake unchanged" | C1, C5 |
| 19 | On 2026-07-28 a server cannot push requests to the client: a tool returns **`input_required`** and the client **retries** the call with the answer | "server opens a WebSocket" | C5, architecture §5 |
| 20 | Sampling and MCP logging are **deprecated** in 2026-07-28 (SEP-2577) | "removed in 2025", "added in 2026" | S6, S7 |
| 21 | `ping` exists only on 2025-era connections | "ping is required every 10 s" | C1 |
| 22 | Connecting: 2025 = 2 messages (`initialize` + `initialized`), 2026 = 1 (`server/discover`), with a cached verdict (`prior`) = 0 | "always 3 messages" | C1 |
| 23 | `resetTimeoutOnProgress` restarts the timeout on each progress update, but **`maxTotalTimeout`** is a hard cap | "progress disables timeouts" | C2 |
| 24 | On 2026-07-28 change notifications arrive on **one `subscriptions/listen` stream** (`client.listen()`); 2025 uses `resources/subscribe` | "polling every second" | C3 |
| 25 | With server `cacheHints`, three identical `listTools()` calls reach the server **once** (2026 era) | "three times", "never" | C4 |
| 26 | The Streamable HTTP endpoint rejects a foreign `Host` / `Origin` header with **403** (DNS-rebinding protection) | "200", "404" | S8 |
| 27 | In our measurements the **LLM took ~99 %** of a chat turn; MCP tool calls took under 1 % (a few ms each) | "MCP is the bottleneck" | results §8 |
| 28 | The same server works in several hosts **by configuration only**: our CLI (`config/host.json`) and VS Code (`.vscode/mcp.json`) | "each host needs a different server" | demo part B |
| 29 | In our demo, elicitation caught an LLM mistake (it set `process_score: 0` that the user never asked for) — human-in-the-loop for destructive tools | — (scenario question) | architecture §5 |
| 31 | The same host ran **Gemini (cloud)** and **Qwen3 4B (local, Ollama)** by changing only the config file — 100 % of benchmark turns passed on both | "each LLM needs its own MCP server" | model-comparison |
| 32 | Qwen3 4B "thinking" variant was ~10× slower (24 s vs 2 s per turn) with no accuracy gain on these tool tasks | "thinking is always better" | model-observations |
| 30 | GPA in our server: total = 40 % process + 60 % final → letter A/B/C/D/F → 4/3/2/1/0 → credit-weighted average | "simple average of totals" | architecture §7 |

## Suggested format (until the teacher gives one)

```
Question 1: Which component of the MCP architecture contains the LLM?
A. Server
B. Host
C. Transport
D. Resource
Answer: B
```

One blank line between questions, UTF-8 `.txt`, English (the whole seminar is in English).
