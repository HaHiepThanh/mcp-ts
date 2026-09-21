# Method reference — MCP TypeScript SDK v2

Input → output of every SDK method used in this project, with the example that runs it.
Packages: `@modelcontextprotocol/server` (S = server side) and `@modelcontextprotocol/client` (C = client side).
Every example saves its real calls and results to `outputs/examples/<example>.json` / `.log`.

**Protocol eras.** The SDK speaks two eras. *2025* (`2024-10-07` … `2025-11-25`) opens with the `initialize` handshake. *2026* (`2026-07-28`) opens with `server/discover` and has no server→client request channel. The "Era" column marks methods that exist in only one of them.

---

## 1. Server side (`@modelcontextprotocol/server`)

### Creating and serving a server

| Method | Input | Output | Notes / errors | Example |
| --- | --- | --- | --- | --- |
| `new McpServer(serverInfo, options?)` | `serverInfo`: `{ name, version, title? }` · `options`: `{ instructions?, capabilities?, cacheHints? }` | `McpServer` | Capabilities for tools/resources/prompts/completions are added automatically as you register them; `logging` and `resources.subscribe` must be declared | S1 |
| `serveStdio(factory, options?)` | `factory(ctx) → McpServer` (ctx.era = `'legacy'`/`'modern'`) · `options.legacy?: 'reject'` | stdio handle | One instance **per connection**. Serves both eras unless `legacy: 'reject'`. Logs must go to stderr | S8 |
| `createMcpHandler(factory, options?)` | same factory · `options`: `{ legacy?: 'stateless' \| 'reject', bus? }` | `McpHttpHandler` `{ fetch(request), notify, close() }` | One instance **per HTTP request**. `notify.resourceUpdated(uri)` publishes to listen streams | S8, C1, C3 |
| `toNodeHandler(handler)` (`@modelcontextprotocol/node`) | `McpHttpHandler` | `(req, res) => Promise<void>` | Adapts the fetch handler to `node:http` | `src/lib/serve.ts` |
| `localhostHostValidation()` / `localhostOriginValidation()` | — | `(req, res) => boolean` | Returns `false` and answers **403** for a foreign Host/Origin (DNS-rebinding protection) | S8 |

### Tools

| Method | Input | Output | Notes / errors | Example |
| --- | --- | --- | --- | --- |
| `server.registerTool(name, config, handler)` | `config`: `{ title?, description, inputSchema? (Zod object), outputSchema?, annotations? }` · `handler(args, ctx)` returns `{ content[], structuredContent?, isError? }` | `RegisteredTool` | Arguments failing `inputSchema` → **result** with `isError: true` (handler not run). `structuredContent` failing `outputSchema` → `isError: true`. Annotations are hints only | S2 |
| `RegisteredTool.disable()` / `.enable()` | — | `void` | Hidden from / back in `tools/list`; calling a disabled tool fails. Sends `notifications/tools/list_changed` | S3 |
| `RegisteredTool.update(changes)` | `{ description?, callback?, paramsSchema?, ... }` | `void` | Sends `list_changed` | S3 |
| `RegisteredTool.remove()` | — | `void` | Later calls → `ProtocolError -32602 Tool … not found` | S3 |

### Resources

| Method | Input | Output | Notes / errors | Example |
| --- | --- | --- | --- | --- |
| `server.registerResource(name, uri, metadata, read)` | fixed `uri` string · `metadata`: `{ title?, description?, mimeType? }` · `read(uri)` → `{ contents: [{ uri, mimeType?, text \| blob }] }` | `RegisteredResource` | Appears in `resources/list` | S4 |
| `server.registerResource(name, new ResourceTemplate(pattern, { list, complete? }), metadata, read)` | `pattern` e.g. `academic://students/{student_id}` · `list`: callback or `undefined` · `complete`: `{ variable: value => string[] }` · `read(uri, variables)` | `RegisteredResourceTemplate` | `list: undefined` → readable but not listed. Throw `ResourceNotFoundError` → client gets `ProtocolError -32602` | S4 |
| `server.server.sendResourceUpdated({ uri })` | resource URI | `Promise<void>` | 2025: only to connections that subscribed (server keeps the set). 2026 on stdio: routed to matching listen streams | C3 |

### Prompts and completion

| Method | Input | Output | Notes / errors | Example |
| --- | --- | --- | --- | --- |
| `server.registerPrompt(name, config, callback)` | `config`: `{ title?, description?, argsSchema? (Zod object) }` · `callback(args)` → `{ messages: [{ role, content }] }` | `RegisteredPrompt` | Arguments failing `argsSchema` → **throws** `ProtocolError -32602` (unlike tools). `content` can embed a `resource` | S5 |
| `completable(schema, complete)` | Zod field · `complete(value, context?)` → `string[]` | Zod field | First use advertises the `completions` capability; results capped at 100 | S5 |

### Inside a handler (`ctx.mcpReq`)

| Member | Input | Output | Notes | Example |
| --- | --- | --- | --- | --- |
| `ctx.mcpReq.notify({ method: 'notifications/progress', params })` | `{ progressToken, progress, total?, message? }` | `Promise<void>` | Only when the client sent a `progressToken` (`ctx.mcpReq._meta?.progressToken`) | S6 |
| `ctx.mcpReq.log(level, data)` | `'debug' \| 'info' \| 'warning' \| 'error' …`, any JSON | `Promise<void>` | Needs `capabilities.logging`. **Deprecated** in 2026-07-28 (SEP-2577) | S6 |
| `ctx.mcpReq.signal` | — | `AbortSignal` | Aborted when the client cancels or disconnects | S6 |
| `ctx.mcpReq.elicitInput(params)` | `{ mode: 'form', message, requestedSchema }` | `{ action: 'accept' \| 'decline' \| 'cancel', content? }` | **2025 only**. Throws if the client lacks the `elicitation` capability | S7 |
| `ctx.mcpReq.requestSampling(params)` | `{ messages, systemPrompt?, maxTokens }` | `{ model, role, content }` | **2025 only**. **Deprecated** (SEP-2577) | S7 |
| `return inputRequired({ inputRequests })` | `{ key: inputRequired.elicit(...) \| inputRequired.createMessage(...) }` | `InputRequiredResult` | **2026 only**. Client answers and retries the call; answers arrive in `ctx.mcpReq.inputResponses`. Missing capability → `ProtocolError -32021` | S7 |
| `inputResponse(ctx.mcpReq.inputResponses, key)` | response map, key | `{ kind: 'missing' \| 'elicit' \| 'sampling' \| 'roots', ... }` | Reads the retried call's answers | `src/lib/interaction.ts` |

---

## 2. Client side (`@modelcontextprotocol/client`)

### Connecting

| Method | Input | Output | Notes / errors | Example |
| --- | --- | --- | --- | --- |
| `new Client(clientInfo, options?)` | `clientInfo`: `{ name, version }` · `options`: `{ capabilities?, versionNegotiation?, defaultCacheTtlMs?, listChanged?, ... }` | `Client` | `versionNegotiation.mode`: absent = 2025 · `'auto'` = probe then fall back · `{ pin: '2026-07-28' }` = that or fail | C1 |
| `client.connect(transport, options?)` | transport · `options.prior?`: `{ kind: 'modern', discover }` | `Promise<void>` | 2025 = 2 requests (`initialize` + `initialized`), 2026 = 1 (`server/discover`), with `prior` = 0. Pin vs 2025-only server → `SdkError ERA_NEGOTIATION_FAILED` | C1 |
| `new StdioClientTransport({ command, args, cwd?, env?, stderr? })` (`/stdio`) | process to spawn | transport | `close()` ends the child process | S8 |
| `new StreamableHTTPClientTransport(url, { fetch? })` | server endpoint URL | transport | Custom `fetch` lets a test serve requests in-process | S8, C1 |
| `InMemoryTransport.createLinkedPair()` | — | `[clientTransport, serverTransport]` | 2025 era only | S3, S6, C3 |
| `client.getProtocolEra()` / `getServerVersion()` / `getServerCapabilities()` / `getInstructions()` / `getDiscoverResult()` | — | `'legacy' \| 'modern'` / `{ name, version }` / capabilities / string / `DiscoverResult \| undefined` | `undefined` before `connect()` resolves | S1, C1 |
| `client.ping(options?)` | `{ timeout? }` | `{}` | **2025 only** — on 2026 throws `SdkError METHOD_NOT_SUPPORTED_BY_PROTOCOL_VERSION` | C1 |
| `client.close()` | — | `Promise<void>` | Later calls throw `Not connected` | C1, C2 |

### Calling

| Method | Input | Output | Notes / errors | Example |
| --- | --- | --- | --- | --- |
| `client.listTools(params?, options?)` | `{ cursor? }` · `{ cacheMode? }` | `{ tools: [{ name, title?, description, inputSchema, outputSchema?, annotations? }] }` | Walks every page automatically | S2, C4 |
| `client.callTool(params, options?)` | `{ name, arguments }` · `RequestOptions` | `{ content[], structuredContent?, isError? }` | Tool/validation failures come back as `isError: true`; unknown tool **throws** `ProtocolError -32602` | S2, C2 |
| `client.listResources()` / `listResourceTemplates()` | `{ cursor? }` · `{ cacheMode? }` | `{ resources[] }` / `{ resourceTemplates[] }` | | S4 |
| `client.readResource(params, options?)` | `{ uri }` · `{ cacheMode? }` | `{ contents: [{ uri, mimeType?, text \| blob }] }` | Not found → `ProtocolError -32602` | S4, C4 |
| `client.listPrompts()` / `getPrompt(params)` | `{ name, arguments }` | `{ prompts[] }` / `{ messages[] }` | Bad arguments → `ProtocolError -32602`. Server without prompts → empty list, no request sent | S5, C2 |
| `client.complete(params)` | `{ ref: { type: 'ref/prompt', name } \| { type: 'ref/resource', uri }, argument: { name, value }, context? }` | `{ completion: { values[], total, hasMore } }` | | S4, S5 |
| `client.setLoggingLevel(level)` | `LoggingLevel` | `{}` | 2025 session-wide filter | S6 |

### Request options (2nd argument of every call)

| Option | Type | Effect | Example |
| --- | --- | --- | --- |
| `timeout` | ms (default 60 000) | `SdkError REQUEST_TIMEOUT` when exceeded | C2 |
| `onprogress` | `(p) => void` | Receives `{ progress, total, message }`; also makes the SDK send a `progressToken` | S6, C2 |
| `resetTimeoutOnProgress` | boolean | Each progress update restarts `timeout` | C2 |
| `maxTotalTimeout` | ms | Hard cap regardless of progress | C2 |
| `signal` | `AbortSignal` | Cancels the call; server sees `ctx.mcpReq.signal` aborted | S6 |
| `cacheMode` | `'use' \| 'refresh' \| 'bypass'` | Cache behaviour for list/read verbs | C4 |

### Change notifications

| Method | Input | Output | Notes / errors | Example |
| --- | --- | --- | --- | --- |
| `client.setNotificationHandler(method, handler)` | e.g. `'notifications/resources/updated'`, `'notifications/tools/list_changed'`, `'notifications/message'` | `void` | Same handler for both eras | S3, S6, C3 |
| `client.listen(filter)` | `{ resourceSubscriptions?: string[], toolsListChanged?, ... }` | `McpSubscription { honoredFilter, close(), closed }` | **2026 only** (on 2025 throws `METHOD_NOT_SUPPORTED_BY_PROTOCOL_VERSION`). `closed` resolves `'local' \| 'graceful' \| 'remote'` | C3 |
| `client.subscribeResource({ uri })` / `unsubscribeResource({ uri })` | resource URI | `{}` | **2025 only** | C3 |

### Answering server requests

| Method | Input | Output | Notes | Example |
| --- | --- | --- | --- | --- |
| `client.setRequestHandler('elicitation/create', handler)` | `request.params`: `{ message, requestedSchema }` | `{ action, content? }` | Needs `capabilities.elicitation.form`. Works for both eras (2026: the SDK retries the tool call for you) | S7 |
| `client.setRequestHandler('sampling/createMessage', handler)` | `request.params`: `{ messages, systemPrompt?, maxTokens }` | `{ role: 'assistant', model, content }` | Needs `capabilities.sampling`. The host plugs its LLM in here (M3: Gemini) | S7 |

---

## 3. How failures reach the client (C2)

| Failure | Surfaces as |
| --- | --- |
| Tool handler reports a problem | **result** `isError: true` (the LLM can read it and retry) |
| Tool arguments fail `inputSchema` | **result** `isError: true` |
| Unknown tool / bad prompt arguments / resource not found | **throws** `ProtocolError` code `-32602` |
| Missing client capability for a 2026 `inputRequired` | **throws** `ProtocolError` code `-32021` |
| Method not in the negotiated era | **throws** `SdkError METHOD_NOT_SUPPORTED_BY_PROTOCOL_VERSION` |
| Timeout | **throws** `SdkError REQUEST_TIMEOUT` |
| Pinned era not offered | **throws** `SdkError ERA_NEGOTIATION_FAILED` |
| Call after `close()` | **throws** `Error: Not connected` |
