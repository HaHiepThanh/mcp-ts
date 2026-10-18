# Phase 2 backup video

This is a narrated replay of recorded evidence, not a live screen capture and not Khoa’s own voice. Narration uses the local Windows English speech synthesizer. All data is synthetic. Five trace scenes show actual recorded questions, tool arguments and answer excerpts from the selected stdio run. Full answers are in the cited JSONL.

For the final presentation, the team can replace the synthetic voice with their own recording. `demo-phase2.srt` contains timed English captions.

## Scene 1: MCP academic assistant Phase 2

This is the Phase Two submission for our MCP academic assistant. The focus is validation and integration: realistic questions, independently checked answers, recorded measurements and evidence for the presentation. All records in this demonstration are generated sample data.

Source: TASKS.md; phase2/KHOA-HANDOFF.md

## Scene 2: Scope and integration status

Phu and Hoang provide the academic features already on main. Tien’s finance work remains in pull request two. This branch contains Khoa’s questions and delivery artifacts. It does not merge or rewrite the other members’ server implementations.

Source: TASKS.md; phase2/KHOA-HANDOFF.md

## Scene 3: A model calls the same MCP servers

A user asks a natural-language question. The host gives the model the enabled tool schemas. The model selects a tool and arguments, and the host calls the corresponding MCP server. The server calculates the result, and the model presents it to the user.

Source: mcp-academic/docs/architecture.md; src/host/host.ts

## Scene 4: The source snapshot is reproducible

The academic answer key is pinned to commit 2c4110a. It includes forty valid students, twenty teachers and forty-one sections. Six invalid grade rows are excluded from academic calculations. The manifest records the source commit and file hashes so the expected answers can be reproduced.

Source: phase2/reference-manifest.json; mcp-academic/data/sample/README_data.md

## Scene 5: The test pack contains 31 questions

The test pack contains thirty-one natural English questions. Twenty-six can run against main. Five finance cases preserve expected values from the finance pull request and are skipped on main. The workbook supplies fifty-nine formula metrics and independent CSV cross-checks.

Source: phase2/test-cases.csv; phase2/test-reference.xlsx

## Scene 6: The Excel key is independent of the tools

The reference builder does not import the server’s business-rule functions. The workbook shows the CSV inputs, visible thresholds and formula steps. Every expected metric agrees with an independent CSV calculation under the artifact formula engine. A human review in Microsoft Excel is still required before claiming manual verification.

Source: phase2/scripts/prepare-reference.py; phase2/scripts/build-reference.mjs

## Scene 7: Phú: teacher search and class schedules

The first feature block covers teacher search and class schedules. Search supports several filters and a result limit. The timetable for class IT zero one in semester twenty twenty-four dash one contains three sections. A nonexistent class produces an error instead of a fabricated schedule.

Source: mcp-academic/src/server/academic/tools.ts; test cases P2-01–P2-07

## Scene 8: Phú: teaching periods stay explicit

Teacher workload counts assigned sections and weekly periods. T zero zero one has three sections and nine weekly periods in the first semester shown. A later semester has six sections and eighteen periods. A valid teacher with no assignments has a real zero workload, which differs from an unknown teacher.

Source: phase2/test-reference.xlsx; test cases P2-08–P2-10

## Scene 9: Recorded trace P2-08

Here is the recorded teacher workload question. The model called academic teacher workload with teacher T zero zero one and semester twenty twenty-four dash one. The returned result shows three assigned sections and nine teaching periods per week. The complete arguments and result remain in the raw trace.

Source: gemini-stdio-llm-2026-10-18T11-14-50-444Z.jsonl

## Scene 10: Phú: grade reports count enrolments

The grade report aggregates graded enrolments across a teacher’s sections. It does not count unique students. Each course total first uses the configured component weights and rounding. The report then averages those totals and calculates the pass percentage. The workbook preserves those intermediate calculations.

Source: test case P2-12; src/server/academic/tools.ts, teacher_grade_report

## Scene 11: Hoàng: the absence boundary matters

These two recorded attendance cases test the exact boundary. Three absences out of fifteen meetings equal twenty percent, so the strict greater-than rule does not ban the student. Four absences produce about twenty-six point seven percent and trigger an exam ban in that section.

Source: config/academic-rules.json; test cases P2-13 and P2-14

## Scene 12: Recorded trace P2-14

This recorded case asks about four absences out of fifteen meetings. The model used both the student identifier and the section identifier. The result is approximately twenty-six point seven percent, with an exam ban. The companion case with three absences confirms that the exact twenty percent boundary is not banned.

Source: gemini-stdio-llm-2026-10-18T11-14-50-444Z.jsonl

## Scene 13: Hoàng: exam bans are per section

Only the absent status currently contributes to the configured absence ratio. Late and excused attendance remain separate. The overall percentage summarizes a student’s records, but the exam restriction is evaluated per section. A low overall average can therefore hide a problematic individual section.

Source: mcp-academic/config/academic-rules.json; src/server/academic/tools.ts, attendance_summary

## Scene 14: Hoàng: conduct uses configured bands

Conduct classification comes from the rule file. The lower boundary belongs to the higher band: a score of fifty is Average, while ninety is Excellent. The test cases also cover a student’s history and a semester with no conduct record, which must remain unavailable rather than becoming zero.

Source: mcp-academic/config/academic-rules.json; test cases P2-18–P2-22

## Scene 15: Recorded trace P2-20

This trace shows the conduct boundary case. The tool returns a conduct score of fifty for the selected student and semester. The classification is Average. The model obtains the value from the tool, rather than inventing a score or confusing a missing record with zero.

Source: gemini-stdio-llm-2026-10-18T11-14-50-444Z.jsonl

## Scene 16: Hoàng: one risk condition is enough

The current risk tool flags a student when any configured condition applies. It does not require all three conditions together. In this snapshot, two of ten students in IT zero one are flagged, and four of twenty in Business Administration are flagged. Reasons must explain each student’s actual risk factors.

Source: test cases P2-23–P2-25; src/server/academic/tools.ts, at_risk_students

## Scene 17: Recorded trace P2-23

The recorded class risk query evaluates ten students and flags two. The response contains the student-level reasons. A reviewer should compare those reasons with the complete structured results, because a numeric count alone does not prove that the final answer preserved every risk explanation.

Source: gemini-stdio-llm-2026-10-18T11-14-50-444Z.jsonl

## Scene 18: Tiến: finance stays behind its own server

The finance feature is a separate dependency. Its human-resources and conduct data differ from main, so mixing the two snapshots would change expected values. The workbook keeps finance source sheets separate. The five finance cases are ready for review but are not reported as executed on main.

Source: https://github.com/HaHiepThanh/mcp-ts/pull/2; phase2/reference-manifest.json

## Scene 19: Tiến: tuition balances have a visible formula

This tuition example is calculated from the finance pull request’s sample CSV. The visible formula subtracts the paid amount from the amount due. Student twenty-two zero one zero zero two has an unpaid balance in the selected semester. This slide explains the reference calculation; it is not a claim that the finance tool ran on main.

Source: finance PR #2 snapshot; test cases P2-26–P2-28

## Scene 20: Tiến: teacher pay uses its matching sections

Teacher pay combines the payroll row with teaching periods from the matching finance snapshot. Title rates, weeks per month and the overtime threshold come from finance configuration. The workbook calculates each component before net pay. These are fictional payroll records for testing.

Source: finance PR #2, config/finance.json and rules.ts; test cases P2-29–P2-30

## Scene 21: An advising briefing needs several tools

The advising scenario combines several sources. The model must obtain the transcript, attendance summary and conduct score for the same student and semester. The trace records the tool calls. A human reviewer must still check that the final briefing includes every relevant restriction and does not lose a risk reason.

Source: phase2/test-cases.csv, P2-31; recorded LLM traces

## Scene 22: Recorded trace P2-31

The final recorded scenario is an advising briefing. The model calls the transcript, attendance and conduct tools with the same student and semester. The answer combines academic performance with exam restrictions and conduct. This is a replay of the measured response. It is not a fresh model request during video playback.

Source: gemini-stdio-llm-2026-10-18T11-14-50-444Z.jsonl

## Scene 23: The transport comparison holds settings fixed

The comparison changes the transport while keeping the model, temperature, tool-round limit and system prompt fixed. Each question starts a fresh conversation. Fallback is disabled so every model call has an unambiguous attribution. Both configurations enable only the academic and utility servers.

Source: phase2/configs/gemini-stdio.json; phase2/configs/gemini-http.json

## Scene 24: Direct MCP checks passed on both transports

The independent numeric subset checks passed all twenty-six executable academic cases over both transports. These direct tests do not use a language model. They verify the MCP route, expected argument handling, numeric outputs and expected error behavior. The five finance cases remain explicitly skipped.

Source: phase2/runs/khoa/comparison.csv; selected direct MCP traces

## Scene 25: Gemini results retain strict failures

These are the recorded Gemini results. The strict subset score checks requested tools, required argument values and selected structured values. It is not a complete semantic answer score. Latency includes API retry time within each question, so a slow outlier must not automatically be attributed to HTTP.

Source: phase2/runs/khoa/comparison.csv; README.md, scoring limits

## Scene 26: Token totals describe this measured workload

The token totals come from the recorded provider usage for these twenty-six questions. They include repeated tool schemas and the conversation rounds. The model receives more than the user’s question alone. A complete three-server context-budget experiment still requires the finance integration and its actual tool list.

Source: phase2/runs/khoa/comparison.json; per-turn usage and llmCalls

## Scene 27: Retrieval limits need a separate check

The limit test exposes a useful distinction. A model may retrieve fifty teachers and then show one person, satisfying much of the visible question while ignoring the intended retrieval limit. That increases unnecessary context. The report preserves the strict argument failure and leaves semantic correctness for review.

Source: P2-03 in recorded Gemini traces; phase2/runs/khoa/README.md

## Scene 28: A single sweep cannot rank transports generally

One sweep per transport is enough to report what happened, but not enough to establish a general speed ranking. Retries, network conditions and warm-up all matter. Repeated randomized sweeps are the next step. Historical model-comparison results from another machine must remain separate from these measurements.

Source: phase2/runs/khoa/README.md; historical docs/experiments.md

## Scene 29: Evidence led to submission improvements

The submission adds an independent reference, full tool-result capture, source hashes and fresh conversations. These changes make failures easier to diagnose. The original model observations and improvement log remain useful context, but their historical scores are not relabelled as new Phase Two measurements.

Source: phase2/scripts/; phase2/improvements.md; docs/model-observations.md

## Scene 30: Remaining integration gates are explicit

The remaining gates are explicit: human review of the Excel key and final answers, finance integration with a refreshed reference, a local Qwen run when Ollama is available, and a genuine tool-description experiment. A terse host prompt alone does not shorten the registered tool schemas.

Source: phase2/KHOA-HANDOFF.md; mcp-academic/docs/experiments.md

## Scene 31: The backup demo replays recorded evidence

The backup video is a narrated replay of recorded evidence. It shows selected questions, tool arguments and observed answers, with English synthetic narration and subtitles. It is labelled as a replay so it cannot be mistaken for a fresh live run or a recording spoken by Khoa.

Source: video/demo-phase2.mp4; video/demo-phase2.srt; recorded LLM JSONL

## Scene 32: Submission files and review path

The delivery contains the test CSV, formula workbook, configuration snapshots, raw traces, comparison tables, editable slides, quiz and backup video. The pull request isolates Khoa’s work from main. The handoff guide explains reproduction and identifies the review steps that still require the team.

Source: phase2/KHOA-HANDOFF.md
