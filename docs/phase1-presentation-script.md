# Phase 1 — Kịch bản thuyết trình và phân công

Deck: `phase1/MCP-TS-SDK-phase1.pptx` (46 slide). Lời nói lấy từ speaker notes của deck. Dòng in nghiêng *(chuyển người)* là câu nối được thêm vào để đổi người nói cho tự nhiên.

Thời gian ước tính khoảng 140 từ/phút. Tổng khoảng **25 phút** (khung của thầy: 20–30 phút).

## Phân công

| # | Người nói | Slide | Nội dung | Thời gian (phút) |
| --- | --- | --- | --- | --- |
| 1 | **Nguyễn Hữu Thiện** | 1–9 | Mở đầu và nền tảng: LLM, dữ liệu, tool, vì sao cần MCP | ~3,5 |
| 2 | **Lê Tuấn Khoa** | 10–17 | Kiến trúc MCP và bài toán của nhóm | ~3,5 |
| 3 | **Trần Huy Hoàng** | 18–24 | Thuật toán và lưu đồ (yêu cầu 2–3) | ~4 |
| 4 | **Hà Văn Trường Phú** | 25–32 | Thư viện và Input/Output (yêu cầu 4–5) | ~3 |
| 5 | **Nguyễn Minh Tiến** | 33–39 | Code mẫu (yêu cầu 6) | ~3,5 |
| 6 | **Hà Hiệp Thanh** | 40–46 | Demo, kết quả, bài học, tổng kết | ~2,5 nói + ~5 demo |

**Lưu ý khi tập**
- Mỗi người mở phần của mình bằng slide chương (13, 18, 25, 33, 40), nên việc đổi người diễn ra tự nhiên.
- Hai phần dễ quá giờ nhất là phần code (Tiến) và demo (Thanh): nên bấm giờ riêng hai phần này.
- Slide 12 (JSON-RPC, 2 thế hệ giao thức) là slide khó nhất của Khoa; nếu cần, Phú có thể nói thay slide này.
- Không đọc nguyên văn: nắm ý chính của từng slide, chỉ vào hình/bảng trên slide khi nói.

---

## 1. Nguyễn Hữu Thiện — slide 1–9 (~3,5 phút)

*Mở đầu và nền tảng: LLM, dữ liệu, tool, vì sao cần MCP*

### Slide 1 · Title — Model Context Protocol with the TypeScript SDK

> Hello everyone. We are group MCP.2502. Our topic is the Model Context Protocol and its TypeScript SDK. We did not only study the SDK: we built a real system with it — an academic records assistant — and today we show both the theory and the code.

### Slide 2 · Agenda

> We follow the six points the lecturer asked for. First some background so everyone can follow, then the problem, the algorithms and flowcharts, the libraries, the input and output of every method, and code examples you can copy. We finish with a live demo and our results.

### Slide 3 · Section — Background

> Before our project, a short background in four ideas: LLM, data, tools, and MCP.

### Slide 4 · What is a Large Language Model?

> An LLM is a model trained on huge amounts of text. It reads our text as tokens and predicts the next token again and again — that is how it writes an answer. It is very good at language, but it only knows what was in its training data.

### Slide 5 · What a standalone LLM cannot do

> But an LLM alone has three limits. It does not know private data, like our university grades. It does not know live data, like today's date. And it cannot act — it cannot save a file or change a record. Worse, if you ask anyway, it may invent a number. So it needs data and tools from outside.

### Slide 6 · Data and tools fill the gap

> So we give the LLM two things. Data, so it knows. And tools, so it can act. Together with the LLM that thinks, we get THINK, KNOW, ACT. Note one important thing: a tool is normal code. The number comes from code, not from the model.

### Slide 7 · How an LLM calls a tool

> Here is tool calling in five steps with a real example. The user asks for a GPA. The model does not answer directly — it replies "please call calculate_gpa with this student ID". The application runs the function, gets 2.06, and gives it back. Only then does the model write the answer. The key point: the model only requests the call; the application executes it.

### Slide 8 · The problem: M × N integrations

> Now the problem MCP solves. Imagine M AI applications — Claude, VS Code, our own chat app — and N data sources. Without a standard, every application writes its own connector to every source. Three apps and four sources already means twelve connectors, each written and maintained separately.

### Slide 9 · MCP: one standard, M + N

> MCP — the Model Context Protocol — is an open standard, like USB-C for AI. Each data source is wrapped once as an MCP server. Each application implements one MCP client. Then any app can use any server. Twelve connectors become seven pieces. This is exactly what we proved: the same server works in our app and in VS Code without changing one line.

> *(chuyển người)* That is why MCP exists. Now Khoa will show how MCP works inside.

---

## 2. Lê Tuấn Khoa — slide 10–17 (~3,5 phút)

*Kiến trúc MCP và bài toán của nhóm*

### Slide 10 · Roles: Host · Client · Server

> *(chuyển người)* Thank you, Thiện.

> There are three roles. The host is the application the user talks to; it owns the LLM. Inside the host there is one client per server connection. A server exposes tools, resources and prompts. In our project the host is our chat app or VS Code, and we have two servers: academic and utility.

### Slide 11 · What a server offers: Tools · Resources · Prompts

> A server offers three kinds of things, and the difference is who is in control. Tools are chosen by the model — like calculate_gpa. Resources are data the application or the user attaches — like a student profile. Prompts are templates the user picks, like a slash command. We implemented all three.

### Slide 12 · Under the hood: JSON-RPC, two protocol eras, two transports

> Under the hood every message is JSON-RPC 2.0: a request with an id, a response with the same id, or a notification without one. The SDK supports two protocol versions. The 2025 version starts with an initialize handshake — two messages. The new 2026 version needs only one discover request, or zero if the client remembers the server. Messages travel over stdio, where the host starts the server as a child process, or over HTTP.

### Slide 13 · Section — Problem description

> Now requirement one: our problem.

### Slide 14 · Our problem: ask about grades in plain English

> Our problem: staff and students want to ask about grades in plain language — "what is the GPA of this student", "how did class IT01 do". The grades live in CSV files the LLM has never seen. So we build MCP servers over the data. We set three hard requirements: numbers must be exact, any change to a grade needs a human to confirm, and we must be able to swap the LLM without touching the servers.

### Slide 15 · Our dataset

> Our data is generated with a fixed seed so everyone gets the same files: 40 students, 10 courses, 261 grade rows across 4 classes. We deliberately put 7 broken rows inside — a score of 11.5, a missing score, an unknown student and so on — to prove the server validates its input. All 7 are caught.

### Slide 16 · Grading rules (university 4-point scale)

> These are the business rules the server must follow. The course total is 40 percent process score plus 60 percent final score. The total maps to a letter A to F and a 4-point value. GPA is weighted by credits, and for a retaken course the cumulative GPA keeps the best attempt. Important: every threshold is in config/grading.json, not hard-coded.

### Slide 17 · Our system: "2" of everything

> Here is our whole system. To show MCP really decouples things, we built two of everything: two MCP servers, two hosts, two LLMs — one in the cloud and one running locally — and two transports. Every combination works with the same server code.

> *(chuyển người)* So that is our problem and our system. Hoàng will now explain the algorithms behind it.

---

## 3. Trần Huy Hoàng — slide 18–24 (~4 phút)

*Thuật toán và lưu đồ (yêu cầu 2–3)*

### Slide 18 · Section — Algorithms & flowcharts

> *(chuyển người)* Thank you, Khoa.

> Requirements two and three: the algorithms and their flowcharts. We have three: the tool-calling loop in the host, the GPA calculation in the server, and data loading with validation.

### Slide 19 · Algorithm 1 — the tool-calling loop (in the host)

> This is the main algorithm, implemented in our host. One: send the question plus the definitions of all 13 tools to the LLM. Two: the LLM answers with text or with tool calls. Three: for each call, the host finds the right server. Four: the server runs it and returns a result. Five: the result goes back to the LLM. Six: repeat until the LLM gives a text answer, with a limit on rounds so it can never loop forever. If a tool returns an error, we send the error back so the model can fix its own call.

### Slide 20 · Flowchart 1 — tool-calling loop

> The same algorithm as a flowchart. Follow the main path down: question, call the LLM, check for tool calls, check the round limit, execute the calls, send the results back — and the loop on the left returns to the LLM. The two exits on the right are the normal answer and the safety stop.

### Slide 21 · The loop in action: two servers combined by the LLM

> A real run of the loop. We asked: write a performance report for class IT01 and save it. The model used three rounds and four tool calls on two different servers. The servers never talk to each other — the LLM combines them. Total time 5.7 seconds.

### Slide 22 · Flowchart 2 — from scores to GPA

> The second flowchart is the domain algorithm in the academic server. Compute the course total, convert it to a letter and a point, choose semester or cumulative scope — cumulative keeps the best attempt — then the credit-weighted average and the classification. On the right, our hand-checked example: student 2201010 has 37 quality points over 18 credits, which is 2.06, Average.

### Slide 23 · Flowchart 3 — loading and validating the data

> The third flowchart: how data gets in. The server parses each CSV file and checks every row. Bad rows — missing IDs, unknown students, scores outside 0 to 10, duplicates — go to an issues list that anyone can read as a resource. Only valid rows reach the in-memory tables used by the tools. If update_grade changes a grade, subscribers get a notification.

### Slide 24 · Algorithm detail: the server asks back

> Two more algorithms that make MCP different from simple function calling. Elicitation: before update_grade changes anything, the server stops and asks the user to accept or decline. This caught a real mistake — the model filled a process score of zero that nobody asked for. Sampling: generate_student_feedback has no API key; it asks the host's LLM to write the text. The SDK supports both protocol eras — the 2025 one where the server pushes a request, and the 2026 one where the tool returns "input required" and the client retries.

> *(chuyển người)* Those are our algorithms. Next, Phú will present the libraries and the input and output of every method.

---

## 4. Hà Văn Trường Phú — slide 25–32 (~3 phút)

*Thư viện và Input/Output (yêu cầu 4–5)*

### Slide 25 · Section — Libraries

> *(chuyển người)* Thank you, Hoàng.

> Requirement four: the libraries.

### Slide 26 · Libraries used

> These are all our runtime libraries. The core is the MCP TypeScript SDK version 2, split into a server package, a client package and a Node adapter. Zod declares the types of tool inputs and outputs. The Google GenAI SDK talks to Gemini, and the OpenAI SDK talks to Qwen through Ollama's OpenAI-compatible API. tsx runs TypeScript directly without a build step.

### Slide 27 · SDK v2 vs v1

> Why version 2? Version 1 was a single package called @modelcontextprotocol/sdk. Version 2 splits server and client into separate packages, implements the newest specification 2026-07-28, and still serves older 2025 clients. Every server is created by a factory that the SDK calls per connection, and it tells the factory which protocol era the caller speaks.

### Slide 28 · Section — Input / Output

> Requirement five: the input and output of every method. First the SDK methods, then our 13 tools. The full reference with every option is in docs/method-reference.md in our repository.

### Slide 29 · SDK methods — server side

> The server-side methods. new McpServer takes the server name and options. registerTool takes a name, a config with the schemas, and a handler — and the handler returns content, structured content, or an error flag. Resources and prompts follow the same pattern. serveStdio and createMcpHandler take the factory and serve it.

### Slide 30 · SDK methods — client side

> The client side, used by our host. new Client takes the client info and options, including how to negotiate the protocol version. connect takes a transport. listTools returns the tool definitions we hand to the LLM, and callTool returns the result. Note the difference: a tool problem comes back as a result with isError, so the LLM can recover; an unknown tool throws a protocol error.

### Slide 31 · Our tools — academic server (10)

> Our ten academic tools with inputs and outputs. Most are read-only. Two are special: update_grade changes data, so it always asks for confirmation, and generate_student_feedback uses sampling. The last three are generic: list, describe and query any table, so the model can answer questions we did not write a dedicated tool for.

### Slide 32 · Our tools — utility server (3), resources and prompts

> The utility server is small on purpose: the current time and semester, score conversion, and saving a report file — which asks before overwriting. Then our five resources and two prompts. The two servers know nothing about each other; the LLM combines them.

> *(chuyển người)* Now that we know every input and output, Tiến will show the code.

---

## 5. Nguyễn Minh Tiến — slide 33–39 (~3,5 phút)

*Code mẫu (yêu cầu 6)*

### Slide 33 · Section — Code examples

> *(chuyển người)* Thank you, Phú.

> Requirement six: code examples that other groups can follow. All of them are in our repository and run with one command.

### Slide 34 · Example 1 — create and serve an MCP server

> Creating a server takes a few lines. Write a factory that builds an McpServer and registers tools, resources and prompts. Then pass the factory to serveStdio, or to createMcpHandler for HTTP. The SDK calls the factory for each connection and tells it the protocol era.

### Slide 35 · Example 2 — registerTool: calculate_gpa

> Here is a real tool. The top part is what the LLM reads: the description and the input and output schemas. The bottom part is the handler, normal code the LLM never sees. That is why the number is always correct: the model only chooses the tool and fills student_id; the code computes the GPA.

### Slide 36 · Example 2b — parameter sets for one tool

> Same tool, different parameter sets — this is what the lecturer asked for. Valid input gives a result. A semester narrows the scope. An unknown student reaches our handler, which returns isError, so the LLM can read it and fix the call. A bad semester format or a wrong type never reaches our code: the SDK rejects it using the Zod schema. All results here are real output from npm run examples.

### Slide 37 · Example 3 — a resource template and a prompt

> A resource template: one URI pattern serves every student, and the complete function suggests IDs as the user types. If the student does not exist we throw ResourceNotFoundError, and the client gets protocol error -32602. Below, a prompt: the user picks class_report, gives a class ID with autocompletion, and gets a ready-made message for the LLM.

### Slide 38 · Example 4 — the client side: connect and call

> Finally the client — this is how our host and VS Code talk to a server. Create a Client, choose a transport — here stdio starts the server as a child process — connect, list the tools, and call one. With version negotiation set to auto, the client tries the 2026 protocol first and falls back to 2025.

### Slide 39 · Try it yourself

> If you want to follow along: clone our repository, install, and run npm run examples. You do not need any API key for this — it runs all 13 SDK examples and prints the real input and output. For chat, you need either a free Gemini key or Ollama with Qwen.

> *(chuyển người)* That is the code. Now Thanh will show it running live.

---

## 6. Hà Hiệp Thanh — slide 40–46 (~2,5 nói + ~5 demo phút)

*Demo, kết quả, bài học, tổng kết*

### Slide 40 · Section — Demo & results

> *(chuyển người)* Thank you, Tiến.

> Now let us see it working.

### Slide 41 · Configuration is all a host needs

> Before the demo, one important slide. Left is the config of our own chat app; right is the config of VS Code. Same command lines, same servers. Connecting a new host is only configuration — no code change. And switching the LLM from Gemini to Qwen is one line in the config.

### Slide 42 · Live demo plan

> Demo plan. In the terminal: list the tools, ask for a GPA, ask by name so the model chains two tools, change a grade to show the confirmation, and write and save a class report using both servers. Then the same servers inside VS Code. If something fails, we switch to the backup screenshots on the next slide.

**Thao tác demo (theo bảng trên slide):**

| # | Gõ | Chỉ cho khán giả |
| --- | --- | --- |
| 1 | `/tools` | 13 tool từ 2 server độc lập |
| 2 | `What is the cumulative GPA of student 2201010?` | model chọn `calculate_gpa` → 2.06, Average |
| 3 | `What grades did Hải get in semester 2024-1?` | chỉ có tên → `search_students` → `get_transcript` |
| 4 | `Change the final score of 2201005 in CS202, 2025-1, to 8.` | elicitation: server hỏi xác nhận |
| 5 | `Write a performance report for class IT01 and save it.` | 2 server phối hợp; file được lưu |
| 6 | `VS Code → Agent mode → hỏi một câu xếp hạng` | cùng server, host khác |

**Trước giờ thuyết trình:** chạy `npm run doctor` (Gemini ✅ hoặc Ollama đang chạy), mở sẵn terminal ở `mcp-academic/` và VS Code. Nếu đã bấm *Accept* ở bước 4 trong lúc tập, chạy `npm run data:sample` để đưa điểm về như cũ.

### Slide 43 · Demo screenshots (backup if the live demo fails)

> These screenshots are our backup in case the live demo has a problem. Left: the terminal answering the GPA question with the tool call visible. Right: VS Code using the same server.

### Slide 44 · Results: two LLMs, same servers

> We benchmarked the models on 11 questions, twice each, with the correct answers taken from the tools themselves. All three configurations scored 100 percent. The local Qwen instruct model was the fastest at 2.1 seconds per turn. The thinking version was just as accurate but more than ten times slower. And note: the LLM takes about 99 percent of the time — MCP tool calls take only milliseconds.

### Slide 45 · Lessons learned

> Three lessons. First, tool design matters more than model size: a small 4-billion-parameter local model was perfect because our tool names, descriptions and schemas are clear. Second, human-in-the-loop is not decoration — it caught a real model mistake. Third, a thinking model is ten times slower with no gain on tool tasks, and free cloud quotas were our real bottleneck.

### Slide 46 · Summary

> To summarise: the LLM thinks, data lets it know, tools let it act, and MCP connects them. MCP separates the data and tools from whoever does the reasoning. With the TypeScript SDK version 2 we built two servers that work unchanged with two hosts and two LLMs. Thank you — we are happy to take your questions.

