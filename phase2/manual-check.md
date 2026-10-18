# Manual cross-check of the ground truth

`phase2/manual_check.py` recomputes the key scenario answers **directly from the CSV files in plain Python** (no TypeScript server code reused) and compares them with the values the MCP tools return (the oracle used to grade every LLM answer).

| Scenario | What | Independent Python | MCP tools (oracle) | Match |
| --- | --- | --- | --- | --- |
| A1 | cumulative GPA + classification of 2201010 | `[2.06, 'Average']` | `[2.06, 'Average']` | ✔ |
| A2 | IT01 average course total, average GPA | `[7.24, 2.92]` | `[7.24, 2.92]` | ✔ |
| D1 | GPA of 2201001 in 2024-1 | `[3.25]` | `[3.25]` | ✔ |
| B2 | lecturer of CS202/IT01/2025-1 and their total periods | `['Phạm Mai Lan', 345]` | `['Phạm Mai Lan', 345]` | ✔ |
| C2 | 2201001 · MERIT-B · 2025-1 | `['not eligible']` | `['not eligible']` | ✔ |
| C3 | net pay of T02 for 2025-10, teaching periods | `[22867500, 86.25]` | `[22867500, 86.25]` | ✔ |
| G1 | IT01 students at risk in 2025-1 | `['2201005', '2201010']` | `['2201005', '2201010']` | ✔ |
| G2 | MERIT-A winners, IT faculty, 2025-1 | `['2201018', '2201004']` | `['2201018', '2201004']` | ✔ |
| G3 | lecturers over the quota in 2025-1 | `['T02 +165']` | `['T02 +165']` | ✔ |

**Result: all values match.**
