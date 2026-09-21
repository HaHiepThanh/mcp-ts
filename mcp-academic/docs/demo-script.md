# Live demo script (~8 minutes)

Two hosts, the same two MCP servers: **our chat host with Gemini** (terminal) and **VS Code** (Copilot Chat, agent mode). Everything below was rehearsed on the presenter's Mac.

## Before the talk (T – 15 min)

```bash
cd mcp-academic
npm run doctor          # Node, SDK, Gemini key must be ✅
npm run check:vscode    # both servers start from .vscode/mcp.json
rm -f outputs/reports/IT01-report.md   # so step 5 saves a fresh file (or keep it to show the overwrite question)
```

- Close heavy apps (Chrome tabs) — the Mac is shared with screen recording.
- Terminal font ≥ 18 pt, dark theme, window half the screen; VS Code on the other half.
- Open VS Code on the `seminar-emt` folder once, run **MCP: List Servers**, start and **trust** `academic` and `utility` (first-time prompt).
- Keep the backup video (`team/video/` on Drive) ready in a browser tab.

## Part A — our host (terminal), 5 minutes

Start: `npm run chat` → the banner shows the model and both servers ("protocol 2026-07-28 · 10 tools").

| # | Type this | Point out |
| --- | --- | --- |
| 1 | `/tools` | 13 tools from **two independent servers**, names `academic.*` / `utility.*` |
| 2 | `What is the cumulative GPA of student 2201010, and how is it classified?` | The model **chose** `calculate_gpa` and filled `student_id`; the server computed 2.06 → Average. Tool call ≈ 30 ms, LLM ≈ 1 s |
| 3 | `What grades did Hải get in semester 2024-1?` | Only a **name** is given → two rounds: `search_students` → `get_transcript` |
| 4 | `Change the final score of student 2201005 in CS202 for semester 2025-1 to 8.` | **Elicitation**: the server stops and asks *us* (`y`). Only the final score changes; the server keeps the process score |
| 5 | `Write a performance report for class IT01 and save it as a file named IT01-report.` | **Two servers combined** by the LLM: statistics + ranking (academic) → date + `save_report` (utility). Open `outputs/reports/IT01-report.md` |
| 6 | `Write short encouraging feedback for student 2201010.` | **Sampling**: the server has no API key; it borrows the host's Gemini (line `✎ sampling request`) |
| 7 | `/prompt academic:class_report class_id=BA01` | A **prompt** chosen by the user, not the model |

Optional if time allows: `/attach academic://rules/grading` then ask *"Explain how my GPA is computed"* — a **resource** attached by the user.

## Part B — VS Code, 2 minutes

1. Show `.vscode/mcp.json`: *"same servers, same command lines as `config/host.json` — only a config file, no code."*
2. Chat view → **Agent** mode → tool picker shows `academic` and `utility` tools.
3. Ask: `Rank the top 3 students of the Business Administration faculty by GPA.` → VS Code asks permission to run the tool → answer.
4. Type `/academic.class_report` to show prompts; **Add Context → MCP Resources** to show resources.

## Part C — show the evidence, 1 minute

- `outputs/logs/chat-YYYY-MM-DD.jsonl`: every turn with tool calls, timings and tokens.
- `docs/results.md`: *"LLM ≈ 99 % of the time, MCP tool calls < 1 %."*

## If something goes wrong

| Symptom | Fix |
| --- | --- |
| Gemini `503` / slow | Host retries and falls back automatically; if it keeps failing: `npm run chat -- --model gemini-3.1-flash-lite` |
| No internet | Switch to the backup video; run `npm run examples` (no LLM needed) to show the SDK working |
| VS Code server not starting | **MCP: List Servers → academic → Show Output**; run `npm run check:vscode` in the terminal |
| Report question asks to overwrite | Answer `y` — it is the elicitation feature, mention it |
