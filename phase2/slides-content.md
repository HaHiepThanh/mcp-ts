# Phase 2 slide content

27 slides. Content assembled by Khoa’s submission builder from the cited repository sources. Phú/Hoàng/Tiến did not supply separate slide files in this working session. Thiện can revise the editable deck layout.

## 1. MCP academic assistant Phase 2

- Test scenarios, measured results and integration
- Khoa’s submission, 18 October 2026

Source: TASKS.md; phase2/KHOA-HANDOFF.md

Narration: This is the Phase Two submission for our MCP academic assistant. The focus is validation and integration: realistic questions, independently checked answers, recorded measurements and evidence for the presentation. All records in this demonstration are generated sample data.

## 2. Scope and integration status


Member | Feature contribution | Status in this submission
--- | --- | ---
Phú | Teachers and course sections | Available on main
Hoàng | Attendance, conduct and risk | Available on main
Tiến | Tuition, scholarships and payroll | Separate PR #2 snapshot
Khoa | Questions, evidence, slides, quiz, video | This branch

Source: TASKS.md; phase2/KHOA-HANDOFF.md

Narration: Phu and Hoang provide the academic features already on main. Tien’s finance work remains in pull request two. This branch contains Khoa’s questions and delivery artifacts. It does not merge or rewrite the other members’ server implementations.

## 3. A model calls the same MCP servers

- English question
- Host and model
- Academic and utility tools
- Structured result and answer

Source: mcp-academic/docs/architecture.md; src/host/host.ts

Narration: A user asks a natural-language question. The host gives the model the enabled tool schemas. The model selects a tool and arguments, and the host calls the corresponding MCP server. The server calculates the result, and the model presents it to the user.

## 4. The source snapshot is reproducible


Academic input | Validated / raw rows
--- | ---
Students | 40 valid, 41 raw
Teachers / sections | 20 / 41
Grades | 261 valid, 267 raw
Attendance / conduct | 3,915 / 120

Source: phase2/reference-manifest.json; mcp-academic/data/sample/README_data.md

Narration: The academic answer key is pinned to commit 2c4110a. It includes forty valid students, twenty teachers and forty-one sections. Six invalid grade rows are excluded from academic calculations. The manifest records the source commit and file hashes so the expected answers can be reproduced.

## 5. The test pack contains 31 questions

- 26 academic cases execute on main
- 5 finance cases use the matching PR #2 snapshot
- 59 Excel formula metrics cross-checked against CSV calculations
- Valid inputs, boundary cases, missing records and a multi-tool briefing

Source: phase2/test-cases.csv; phase2/test-reference.xlsx

Narration: The test pack contains thirty-one natural English questions. Twenty-six can run against main. Five finance cases preserve expected values from the finance pull request and are skipped on main. The workbook supplies fifty-nine formula metrics and independent CSV cross-checks.

## 6. The Excel key is independent of the tools

- CSV inputs and visible rule thresholds
- Formula steps for totals, grade points, GPA and absence ratios
- An independent CSV calculation beside each expected answer
- Human review in Microsoft Excel remains pending

Source: phase2/scripts/prepare-reference.py; phase2/scripts/build-reference.mjs

Narration: The reference builder does not import the server’s business-rule functions. The workbook shows the CSV inputs, visible thresholds and formula steps. Every expected metric agrees with an independent CSV calculation under the artifact formula engine. A human review in Microsoft Excel is still required before claiming manual verification.

## 7. Phú: teacher search and class schedules

- search_teachers supports keyword, faculty, title and limit
- class_timetable joins course, semester and class
- IT01 in 2024-1 has 3 scheduled sections
- Unknown classes return a clear error

Source: mcp-academic/src/server/academic/tools.ts; test cases P2-01–P2-07

Narration: The first feature block covers teacher search and class schedules. Search supports several filters and a result limit. The timetable for class IT zero one in semester twenty twenty-four dash one contains three sections. A nonexistent class produces an error instead of a fabricated schedule.

## 8. Phú: teaching periods stay explicit


Teacher / semester | Sections | Periods per week
--- | --- | ---
T001 / 2024-1 | 3 | 9
T001 / 2025-1 | 6 | 18
T001 / 2099-1 | 0 | 0

Source: phase2/test-reference.xlsx; test cases P2-08–P2-10

Narration: Teacher workload counts assigned sections and weekly periods. T zero zero one has three sections and nine weekly periods in the first semester shown. A later semester has six sections and eighteen periods. A valid teacher with no assignments has a real zero workload, which differs from an unknown teacher.

## 9. Phú: grade reports count enrolments

- T001, 2024-1: 30 graded enrolments
- Mean course score: 7.4 out of 10
- Pass rate: 90.0%
- One student can appear in several sections

Source: test case P2-12; src/server/academic/tools.ts, teacher_grade_report

Narration: The grade report aggregates graded enrolments across a teacher’s sections. It does not count unique students. Each course total first uses the configured component weights and rounding. The report then averages those totals and calculates the pass percentage. The workbook preserves those intermediate calculations.

## 10. Hoàng: the absence boundary matters


Recorded meetings | Absences | Ratio | Exam ban
--- | --- | --- | ---
15 | 3 | 20.0% | No
15 | 4 | 26.7% | Yes

Source: config/academic-rules.json; test cases P2-13 and P2-14

Narration: These two recorded attendance cases test the exact boundary. Three absences out of fifteen meetings equal twenty percent, so the strict greater-than rule does not ban the student. Four absences produce about twenty-six point seven percent and trigger an exam ban in that section.

## 11. Hoàng: exam bans are per section

- Only the configured absent status counts
- Late and excused records stay distinct
- Overall absence percentage is useful context
- The exam restriction is evaluated for each section

Source: mcp-academic/config/academic-rules.json; src/server/academic/tools.ts, attendance_summary

Narration: Only the absent status currently contributes to the configured absence ratio. Late and excused attendance remain separate. The overall percentage summarizes a student’s records, but the exam restriction is evaluated per section. A low overall average can therefore hide a problematic individual section.

## 12. Hoàng: conduct uses configured bands


Minimum score | Classification
--- | ---
90 | Excellent
80 | Good
65 | Fairly good
50 | Average
0 | Weak

Source: mcp-academic/config/academic-rules.json; test cases P2-18–P2-22

Narration: Conduct classification comes from the rule file. The lower boundary belongs to the higher band: a score of fifty is Average, while ninety is Excellent. The test cases also cover a student’s history and a semester with no conduct record, which must remain unavailable rather than becoming zero.

## 13. Hoàng: one risk condition is enough

- IT01, 2024-1: 2 of 10 students flagged
- Business Administration: 4 of 20 flagged
- Current implementation uses GPA OR absence OR conduct
- Each flagged student includes reasons

Source: test cases P2-23–P2-25; src/server/academic/tools.ts, at_risk_students

Narration: The current risk tool flags a student when any configured condition applies. It does not require all three conditions together. In this snapshot, two of ten students in IT zero one are flagged, and four of twenty in Business Administration are flagged. Reasons must explain each student’s actual risk factors.

## 14. Tiến: finance stays behind its own server

- Finance PR #2 is not merged into main
- Its teacher, section and conduct CSVs differ from main
- Finance expected values keep the complete PR snapshot
- Five finance cases are skipped in these main-branch runs

Source: https://github.com/HaHiepThanh/mcp-ts/pull/2; phase2/reference-manifest.json

Narration: The finance feature is a separate dependency. Its human-resources and conduct data differ from main, so mixing the two snapshots would change expected values. The workbook keeps finance source sheets separate. The five finance cases are ready for review but are not reported as executed on main.

## 15. Tiến: tuition balances have a visible formula

- Student 2201002, 2024-1: due 8,400,000 VND
- Paid 0 VND
- Balance 8,400,000 VND
- Balance equals amount due minus amount paid

Source: finance PR #2 snapshot; test cases P2-26–P2-28

Narration: This tuition example is calculated from the finance pull request’s sample CSV. The visible formula subtracts the paid amount from the amount due. Student twenty-two zero one zero zero two has an unpaid balance in the selected semester. This slide explains the reference calculation; it is not a claim that the finance tool ran on main.

## 16. Tiến: teacher pay uses its matching sections

- Monthly periods = weekly assigned periods × weeks per month
- Teaching pay = monthly periods × title rate
- Overtime adds the configured bonus above the standard
- Net pay = base + teaching + overtime + bonus − deductions

Source: finance PR #2, config/finance.json and rules.ts; test cases P2-29–P2-30

Narration: Teacher pay combines the payroll row with teaching periods from the matching finance snapshot. Title rates, weeks per month and the overtime threshold come from finance configuration. The workbook calculates each component before net pay. These are fictional payroll records for testing.

## 17. An advising briefing needs several tools

- P2-31 asks about student 2201005 in 2024-1
- get_transcript supplies academic results
- attendance_summary supplies meetings and exam restrictions
- conduct_score supplies conduct and classification

Source: phase2/test-cases.csv, P2-31; recorded LLM traces

Narration: The advising scenario combines several sources. The model must obtain the transcript, attendance summary and conduct score for the same student and semester. The trace records the tool calls. A human reviewer must still check that the final briefing includes every relevant restriction and does not lose a risk reason.

## 18. The transport comparison holds settings fixed


Setting | Both configurations
--- | ---
Model | gemini-3.5-flash-lite
Temperature / rounds | 0.2 / 8
Conversation | Fresh for each question
Model fallback | Disabled
Enabled servers | academic and utility

Source: phase2/configs/gemini-stdio.json; phase2/configs/gemini-http.json

Narration: The comparison changes the transport while keeping the model, temperature, tool-round limit and system prompt fixed. Each question starts a fresh conversation. Fallback is disabled so every model call has an unambiguous attribution. Both configurations enable only the academic and utility servers.

## 19. Direct MCP checks passed on both transports


Configuration | Executed | Passed | Finance skipped
--- | --- | --- | ---
stdio | 26 | 26 | 5
HTTP | 26 | 26 | 5

Source: phase2/runs/khoa/comparison.csv; selected direct MCP traces

Narration: The independent numeric subset checks passed all twenty-six executable academic cases over both transports. These direct tests do not use a language model. They verify the MCP route, expected argument handling, numeric outputs and expected error behavior. The five finance cases remain explicitly skipped.

## 20. Gemini results retain strict failures


Transport | Strict subset | Median E2E | Extra attempts
--- | --- | --- | ---
stdio | 25/26 | 2.07 s | 4
http | 26/26 | 2.01 s | 6

Source: phase2/runs/khoa/comparison.csv; README.md, scoring limits

Narration: These are the recorded Gemini results. The strict subset score checks requested tools, required argument values and selected structured values. It is not a complete semantic answer score. Latency includes API retry time within each question, so a slow outlier must not automatically be attributed to HTTP.

## 21. Token totals describe this measured workload


Transport | Input tokens | Output tokens | Median tool time
--- | --- | --- | ---
stdio | 188,089 | 3,595 | 2 ms
http | 188,014 | 3,625 | 7 ms

Source: phase2/runs/khoa/comparison.json; per-turn usage and llmCalls

Narration: The token totals come from the recorded provider usage for these twenty-six questions. They include repeated tool schemas and the conversation rounds. The model receives more than the user’s question alone. A complete three-server context-budget experiment still requires the finance integration and its actual tool list.

## 22. Retrieval limits need a separate check

- P2-03 asks for one teacher and the total count
- Some runs retrieve limit 50, then display one teacher
- The final answer can be useful while retrieval is excessive
- Report argument compliance separately from semantic correctness

Source: P2-03 in recorded Gemini traces; phase2/runs/khoa/README.md

Narration: The limit test exposes a useful distinction. A model may retrieve fifty teachers and then show one person, satisfying much of the visible question while ignoring the intended retrieval limit. That increases unnecessary context. The report preserves the strict argument failure and leaves semantic correctness for review.

## 23. A single sweep cannot rank transports generally

- Cloud retries and network variability affect total time
- Server startup is outside the per-question measurement
- The first calls can include cache warm-up
- Repeat randomized sweeps before making a speed claim

Source: phase2/runs/khoa/README.md; historical docs/experiments.md

Narration: One sweep per transport is enough to report what happened, but not enough to establish a general speed ranking. Retries, network conditions and warm-up all matter. Repeated randomized sweeps are the next step. Historical model-comparison results from another machine must remain separate from these measurements.

## 24. Evidence led to submission improvements

- Independent Excel expectations reduce shared-oracle errors
- Full MCP results avoid truncated-output grading errors
- Pinned source hashes prevent accidental dataset mixing
- Fresh conversations reduce contamination between questions

Source: phase2/scripts/; phase2/improvements.md; docs/model-observations.md

Narration: The submission adds an independent reference, full tool-result capture, source hashes and fresh conversations. These changes make failures easier to diagnose. The original model observations and improvement log remain useful context, but their historical scores are not relabelled as new Phase Two measurements.

## 25. Remaining integration gates are explicit

- Human Excel review and semantic answer review
- Finance PR merge, then refresh and execute finance cases
- Qwen run when Ollama is available
- True terse tool schemas and the full temperature/round matrix

Source: phase2/KHOA-HANDOFF.md; mcp-academic/docs/experiments.md

Narration: The remaining gates are explicit: human review of the Excel key and final answers, finance integration with a refreshed reference, a local Qwen run when Ollama is available, and a genuine tool-description experiment. A terse host prompt alone does not shorten the registered tool schemas.

## 26. The backup demo replays recorded evidence

- Recorded Gemini questions and complete tool results
- Teacher report, attendance boundaries and advising examples
- English synthetic narration with captions
- Replay format is labelled throughout

Source: video/demo-phase2.mp4; video/demo-phase2.srt; recorded LLM JSONL

Narration: The backup video is a narrated replay of recorded evidence. It shows selected questions, tool arguments and observed answers, with English synthetic narration and subtitles. It is labelled as a replay so it cannot be mistaken for a fresh live run or a recording spoken by Khoa.

## 27. Submission files and review path

- 31-case CSV and Excel reference workbook
- Configurations, raw traces and comparison tables
- 27-slide editable deck and 20-question quiz
- Narrated demo video and reproduction guide

Source: phase2/KHOA-HANDOFF.md

Narration: The delivery contains the test CSV, formula workbook, configuration snapshots, raw traces, comparison tables, editable slides, quiz and backup video. The pull request isolates Khoa’s work from main. The handoff guide explains reproduction and identifies the review steps that still require the team.
