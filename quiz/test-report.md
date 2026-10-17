Node.js	v24.18.0

npm	11.16.0

Git commit	b2ff8098e352e244bfded365a7d27e3472c98aae



\# Phase 1 — Installation and Test Report



\## 1. Tester and environment



\- Tester: Khoa

\- Test date: 2026-10-17

\- Operating system: Windows

\- Shell: PowerShell

\- Node.js: v24.18.0

\- npm: 11.16.0

\- Git commit: b2ff8098e352e244bfded365a7d27e3472c98aae

\- Setup guide: mcp-academic/docs/setup-guide.md

\- Host configuration: config/host.json

\- Configured model: gemini-3.5-flash-lite

\- Transport: stdio

\- Negotiated protocol: 2026-07-28



\## 2. SDK examples



Command: npm run examples



Result: 13/13 examples passed.



The successful examples covered:

\- Server creation and tool registration

\- Tool lifecycle

\- Resources and prompts

\- Logging, progress and cancellation

\- Elicitation and sampling

\- Transports

\- Client connections

\- Request options and errors

\- Subscriptions

\- Caching

\- Wire traces



Example outputs were generated in outputs/examples/.



Status: PASS



\## 3. Chat host and server connection



Command: npm run chat



The chat host started and connected to:

\- academic: 10 tools

\- utility: 3 tools



The /tools command listed all 13 tools.



Status: PASS



\## 4. End-to-end chat test



Question:

What is the cumulative GPA of student 2201010, and how is it classified?



Expected result from the setup guide:

GPA 2.06, classification Average.



Observed tool call:

academic.calculate\_gpa



Arguments:

{"student\_id":"2201010"}



Actual answer:

The cumulative GPA of student 2201010 (Trần Đức Phúc) is 2.06,

and it is classified as Average.



Observed measurements from this turn:

\- Tool calls: 1

\- Tool rounds: 1

\- Tool execution time: 24 ms

\- Total turn time: approximately 3.0 seconds

\- Input tokens: 4864

\- Output tokens: 61



The tool, arguments and answer matched the test expectation.



Status: PASS



\## 5. Problems encountered and resolutions



\### 5.1 Missing Gemini API key



Command:

npm run chat



Error:

GEMINI\_API\_KEY is missing — add it to .env



Cause:

The Gemini API key was not configured.



Resolution:

Created or edited .env and entered the API key after GEMINI\_API\_KEY=.



Retest:

The chat host started successfully and answered the GPA question.



\### 5.2 API key pasted into PowerShell



Symptom:

PowerShell reported that the entered text was not recognized as a command.



Cause:

The key was entered in the terminal instead of the .env file.



Resolution:

Opened .env using Notepad and entered the key in the correct variable.



API key values are omitted from this report.



\## 6. Evidence



\- SDK examples: screenshots/run-examples.png

\- Type checking: screenshots/run-typecheck.png

\- Chat test: screenshots/rum-chat.png

Screenshot collection status:

All three screenshots saved.



\## 7. Conclusion



All 13 SDK examples passed on the tester's Windows machine.

The chat host connected to both MCP servers and listed 13 tools.

The GPA question triggered the expected tool with the correct student ID

and returned the expected GPA and classification.



This report covers the SDK example suite and one end-to-end Gemini chat

question. It does not establish the accuracy of all possible chat questions.

