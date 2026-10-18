# Khoa — Phase 2 handoff

This branch contains Khoa's validation and delivery artifacts. It changes no application server, generator, existing benchmark, Phase 1 material or another member's experiment report.

All files for this contribution are grouped under `phase2/runs/khoa/`. Raw trace configuration paths reflect the original run location before this reorganization.

## Deliverables

| Requirement | File | Evidence / limit |
| --- | --- | --- |
| At least 15 natural English questions | [test-cases.csv](test-cases.csv) | 31 cases with the required five columns; arguments and exact expected-value subsets are JSON inside `expected_values` |
| CSV-derived Excel answer key | [test-reference.xlsx](test-reference.xlsx) | 59 formula metrics and independent CSV cross-checks; all agree under Artifact Tool; human review in Microsoft Excel remains pending |
| Measured runs | [README.md](README.md) | Gemini on stdio and HTTP, full traces, provider usage and retry counts; 26/26 direct MCP checks on each transport |
| Final quiz | [questions-phase2.txt](questions-phase2.txt) | 20 English questions, four choices and one answer per question; reviewed from the Phase 2 draft and extended for new features |

Slides, video and their authoring sources were removed from this PR at the user's request. The quiz has **not** been uploaded to Google Drive; no Drive session was connected. Copy it to `team/quiz/` when assembling the team submission. The existing Mac-only `build-submission.sh` was not modified for this Windows task.

## What was measured

All records are synthetic. Main's source is pinned to `2c4110ab6ff60e84e386ace7f0d158bf0ab4a0e2`. Read [reference-manifest.json](reference-manifest.json) for file hashes, raw counts and the separate finance reference.

- TypeScript: the application and Khoa's runner pass their checks.
- Existing examples: 15/15 passed, with S9/S10 outputs retained.
- Direct MCP: 26/26 academic cases pass on stdio and HTTP.
- Gemini strict tool/argument/value subsets: stdio 25/26, HTTP 26/26. The stdio failure is P2-03 retrieving `limit: 50` instead of the intended `limit: 1`, while presenting one teacher and the correct total. This is a retrieval-configuration mismatch; a human should assess the final answer separately.
- Gemini median question time: about 2.07 s over stdio and 2.01 s over HTTP. One sweep per transport, retries included, is insufficient to claim a general speed advantage.
- Qwen was not run because Ollama was unavailable.

The report preserves the exact selected traces and explains an initial HTTP harness cleanup error. Complete recorded case data is retained, and the reconstructed summary is explicitly labelled. Earlier incomplete/debug runs are not part of the submission. Do not substitute the historical 11-case model-comparison accuracy for the new test-pack accuracy.

## Excel review and test-case consumption

The workbook starts with `Answers`. Column C contains calculated Excel answers, D contains independent CSV calculations, and E checks agreement. Raw source values and visible calculation steps remain in separate sheets. `Rules` contains the thresholds. `Grades` preserves invalid source rows and records why the academic calculations exclude them. `AttendanceGroups` evaluates bans per student and section. `Risk` applies the current implementation's OR rule. `F_*` sheets refer exclusively to the finance PR snapshot.

The independent CSV builder uses Python's decimal rounding and imports no production grading/tool functions. The workbook builder uses Artifact Tool, recalculates all formulas, checks 59 reference values, scans formula errors and temporarily changes/restores a conduct input to check dependent recalculation. This is automated verification, **not** a claim that Khoa manually calculated the answers in Excel. Khoa should review the relevant source rows and formula steps in Microsoft Excel and record their sign-off before final submission.

`expected_values` has the shape:

```json
{"snapshot":"main","calls":[{"tool":"teacher_workload","arguments":{"teacher_id":"T001","semester":"2024-1"},"checks":[{"path":"total_sections","value":3,"excel_cell":"Answers!C12"}]}]}
```

The sample above illustrates the structure; use the actual row's `excel_cell` in the CSV, not the illustrative address. Dot paths traverse structured results. Expected errors use `error_contains`. Every numerical comparison is exact within a small floating-point tolerance. The answer-presence screen is only a diagnostic; zero expressed as “no records”, boolean decisions, risk reasons and the advising narrative require human semantic review.

Tiến/Hoàng can import these independent expectations into `mcp-academic/demo/benchmark.ts`. That production benchmark is intentionally unchanged because its integration belongs to their tasks. In particular, preserve the independent values instead of replacing them with calls to the same tool being tested.

## Finance dependency

Finance references are pinned to [PR #2](https://github.com/HaHiepThanh/mcp-ts/pull/2), commit `5d72748e7aebbc6af69c18afeafd89a72d3158b1`. Its teachers, sections and conduct differ from main. P2-26 through P2-30 cover tuition and teacher-pay values from that **complete** snapshot. They are skipped on main, not counted as passes. They cover two finance tools; scholarship eligibility, scholarship ranking, outstanding tuition and payroll summary still need additional cases after the final integration dataset is agreed.

After PR #2 is merged, update the pinned source choices and refresh the Excel key from the final combined CSVs. Review the joins and thresholds before adding finance capabilities to Khoa's runner. Run the finance questions and the enabled/disabled finance privacy scenarios, then refresh the reports. Do not merely remove the skip or reuse finance values with main's HR records.

## Reproduction

Start with `npm install` in `mcp-academic/`. Keep the Gemini key in local `.env`, which Git ignores. Never put it in a config, command transcript or committed log. The run configs enable academic and utility only, decline mutations, deny sampling and use a fresh conversation per question. The runner disables Gemini model fallback and captures complete MCP results before the host's display preview truncates them.

Run commands in [README.md](README.md). Type-check Khoa's runner with:

```powershell
cd mcp-academic
node node_modules/typescript/bin/tsc --noEmit -p ../phase2/runs/khoa/tsconfig.json
```

To rebuild the independent reference, run `python phase2/runs/khoa/scripts/prepare-reference.py` from the repository root. The pinned finance commit must exist locally (`git fetch origin feat/tien-finance` if necessary). Authoring intermediates are kept in a sibling `_khoa-build/`, outside the repository, and must not be committed. Use the bundled Artifact Tool runtime and its documented creation marker before spreadsheet authoring. Copy `build-reference.mjs` into that private folder with a `node_modules` junction to the bundled runtime, then pass the repository root as the first argument. Run `summarize-runs.py` to refresh the measurement reports.

## Before the team submits

- Khoa reviews and signs off the Excel calculations and semantic answer completeness.
- Tiến/Hoàng consume the cases in the shared benchmark and complete finance coverage after integration.
- Tiến performs the team's technical review.
- The team uploads the final quiz to its Drive folder.

These are documented review/dependency steps, not fabricated completed actions.
