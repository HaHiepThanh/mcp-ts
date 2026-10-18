# Khoa — phép tính và kiểm tra đáp án Phase 2

Tài liệu này ghi các bước tính để làm lại và kiểm tra trong `test-reference.xlsx`. Các số đầu vào lấy từ CSV ở hai commit đã ghi trong README, không lấy câu trả lời của LLM làm đáp án. Mỗi mục trỏ tới ô Excel dùng trong `test-cases.csv`.

Đã đối chiếu các phép tính từ CSV và đọc lại câu trả lời trong log, gồm biên K07/K08 và lý do từng sinh viên ở K12. Workbook có sheet Manual ghi phép tính số học và sheet Answers tính từ nguồn CSV. Các công thức được tính lại bằng Artifact Tool, không gọi đó là kiểm tra tự động trong Microsoft Excel.

## Quy tắc chung

- Điểm môn = ROUND(0.4 × process_score + 0.6 × final_score, 1). Điểm chữ và điểm hệ 4 tra từ `grading.json`. GPA dùng tín chỉ làm trọng số.
- Chỉ dùng dòng điểm hợp lệ; không cộng dòng sai khóa ngoại, thiếu điểm, ngoài miền hoặc trùng lượt học. Mỗi dòng nối section bằng course + semester + class của sinh viên.
- Tỷ lệ vắng = absent / số buổi. So sánh tỷ lệ chưa làm tròn với 0.20; chỉ làm tròn phần trăm để hiển thị.
- Học vụ dùng các sheet không có tiền tố F_. Finance dùng F_Teachers, F_Sections, F_Conduct tương ứng PR #2. Không trộn hai nguồn conduct/giảng viên.

## Phạm vi

K01–K15 là bộ dùng chung trên main. K16–K24 chỉ là kỳ vọng tạm của PR finance, được đánh dấu provisional trong finance-pending.csv và cột scope của Excel. Không đưa các số finance vào benchmark chung trước khi PR #2 rebase/merge và tính lại từ dataset chung.

## Các phép tính theo câu hỏi

### K01

Find teacher T006 and tell me how many matching teacher records exist.

Filter Teachers by teacher_id T006. The only matching row is T006 (Hoàng Bảo Lan): count = 1.

| Chỉ số | Đáp án | Ô đối chiếu |
| --- | --- | --- |
| total_matches | 1 | Answers!C5 |

### K02

Find all professors in the Information Technology faculty. How many are there?

Filter Teachers by faculty Information Technology AND title exactly Professor. The matching IDs are T001 and T010: 1 + 1 = 2. Do not count Associate Professor.

| Chỉ số | Đáp án | Ô đối chiếu |
| --- | --- | --- |
| total_matches | 2 | Answers!C6 |

### K03

How many course sections are on the weekly timetable for class IT01 in semester 2024-1?

Filter Sections by class_id IT01 AND semester 2024-1. The matching IDs are SEC014, SEC029, SEC037: 1 + 1 + 1 = 3.

| Chỉ số | Đáp án | Ô đối chiếu |
| --- | --- | --- |
| total_sections | 3 | Answers!C7 |

### K04

How many sections and weekly teaching periods does T001 have in semester 2024-1?

Filter Sections by teacher_id T001 AND semester 2024-1. The three rows are SEC014, SEC029, SEC037. Weekly periods = 3 + 3 + 3 = 9; sections = 3.

| Chỉ số | Đáp án | Ô đối chiếu |
| --- | --- | --- |
| total_sections | 3 | Answers!C8 |
| total_periods_per_week | 9 | Answers!C9 |

### K05

How many sections and weekly teaching periods does T001 have in semester 2099-1?

T001 exists, but no Sections row matches semester 2099-1. Count = 0; sum of periods over the empty selection = 0. This is an empty assignment, not an unknown-teacher error.

| Chỉ số | Đáp án | Ô đối chiếu |
| --- | --- | --- |
| total_sections | 0 | Answers!C10 |
| total_periods_per_week | 0 | Answers!C11 |

### K06

For T001 in semester 2024-1, report the number of graded enrolments, mean course score and pass percentage.

Select the 30 valid Grades rows joining the three T001 sections above. Their rounded total scores sum to 220.5. Mean = ROUND(220.5 / 30, 1) = 7.4. Passing enrolments = 27; pass percentage = 27 / 30 × 100 = 90%. Count enrolments rather than distinct students.

| Chỉ số | Đáp án | Ô đối chiếu |
| --- | --- | --- |
| students_graded | 30 | Answers!C12 |
| overall_average_score | 7.4 | Answers!C13 |
| overall_pass_rate_pct | 90.0 | Answers!C14 |

### K07

Check attendance for student 2202015 in section SEC002 in semester 2024-1. Give total meetings, absences and absence percentage, and whether the student is banned from the exam.

For student 2202015 in SEC002, weeks 7, 9 and 13 are absent. There are 15 records: 3 / 15 × 100 = 20%. The comparison is 0.20 > 0.20, which is FALSE, so there is no exam ban. Late and excused do not count as absent.

| Chỉ số | Đáp án | Ô đối chiếu |
| --- | --- | --- |
| total_sessions | 15 | Answers!C15 |
| absent | 3 | Answers!C16 |
| absence_rate_pct | 20.0 | Answers!C17 |
| banned_from_exam | False | Answers!C18 |

### K08

Check attendance for student 2202010 in section SEC001 in semester 2024-1. Give total meetings, absences and absence percentage, and whether the student is banned from the exam.

For student 2202010 in SEC001, weeks 2, 4, 13 and 14 are absent. There are 15 records: ROUND(4 / 15 × 100, 1) = 26.7%. Since 4 / 15 > 0.20, the exam ban is TRUE.

| Chỉ số | Đáp án | Ô đối chiếu |
| --- | --- | --- |
| total_sessions | 15 | Answers!C19 |
| absent | 4 | Answers!C20 |
| absence_rate_pct | 26.7 | Answers!C21 |
| banned_from_exam | True | Answers!C22 |

### K09

Check attendance for student 2201005. Give total meetings, absences and absence percentage.

No semester is requested, so include all seven sections. Meetings = 7 × 15 = 105. Absences = 4 + 1 + 5 + 3 + 4 + 5 + 5 = 27. ROUND(27 / 105 × 100, 1) = 25.7%. Exam restrictions are determined for each section, not from this aggregate alone.

| Chỉ số | Đáp án | Ô đối chiếu |
| --- | --- | --- |
| total_sessions | 105 | Answers!C23 |
| absent | 27 | Answers!C24 |
| absence_rate_pct | 25.7 | Answers!C25 |

### K10

What conduct score and classification did student 2201001 receive in semester 2024-1?

Filter Conduct by student 2201001 and semester 2024-1. Score = 92. Compare bands from highest to lowest: 92 ≥ 90, therefore Excellent.

| Chỉ số | Đáp án | Ô đối chiếu |
| --- | --- | --- |
| records.0.score | 92.0 | Answers!C26 |
| records.0.grade | Excellent | Answers!C27 |

### K11

What conduct score and classification did student 2201005 receive in semester 2024-1?

Filter Conduct by student 2201005 and semester 2024-1. Score = 50. It is below 65 but exactly ≥ 50, therefore Average. Weak requires score < 50.

| Chỉ số | Đáp án | Ô đối chiếu |
| --- | --- | --- |
| records.0.score | 50.0 | Answers!C28 |
| records.0.grade | Average | Answers!C29 |

### K12

How many students in IT01 are at academic risk in semester 2024-1? Also report how many students were evaluated and give the reasons for each flagged student.

Filter Students by IT01: 10 valid students. The risk condition is GPA < 2 OR any section absence ratio > 0.20 OR conduct < 50. Only 2201005 and 2201010 are flagged: 2 / 10 students. Both have low GPA and at least one banned section. Conduct scores 50 and 60 do not add a low-conduct reason.

| Chỉ số | Đáp án | Ô đối chiếu |
| --- | --- | --- |
| total_evaluated | 10 | Answers!C30 |
| at_risk_count | 2 | Answers!C31 |

### K13

How many students in Business Administration are at academic risk in semester 2024-1? Also report how many students were evaluated and give the reasons for each flagged student.

Filter Students by Business Administration: 20 valid students. Apply the same OR rule. Flagged IDs are 2202005, 2202010, 2202015, 2202020: count = 4. Each has low GPA and high section absence; conduct adds a reason only for scores 43 and 48.

| Chỉ số | Đáp án | Ô đối chiếu |
| --- | --- | --- |
| total_evaluated | 20 | Answers!C32 |
| at_risk_count | 4 | Answers!C33 |

### K14

Check attendance for student 9999999 in semester 2024-1. Say if no records exist.

Search Students for ID 9999999. The ID does not exist. Expected outcome is the missing-student business error; no attendance percentage should be invented.

Đây là ca kiểm tra lỗi hoặc tổng hợp; đối chiếu thông báo lỗi / nội dung đầy đủ trong log và các bước tính trên.

### K15

Prepare an advising briefing for student 2201005 in semester 2024-1 using the transcript, attendance and conduct. Include GPA, absence percentage, exam restrictions and conduct classification.

For 2201005 in 2024-1, course credits are 3 + 2 + 3 = 8. Grade points are 0, 1, 1: GPA = ROUND((3×0 + 2×1 + 3×1) / 8, 2) = 0.63. Earned credits = 2 + 3 = 5. Attendance = 45 meetings and 4 + 5 + 5 = 14 absences: ROUND(14/45×100,1) = 31.1%. SEC014, SEC029 and SEC037 all exceed 20%, so all three are restricted. Conduct 50 is Average.

| Chỉ số | Đáp án | Ô đối chiếu |
| --- | --- | --- |
| records.0.score | 50 | Answers!C28 |

### K16 — PROVISIONAL finance PR2

For student 2201001 in semester 2024-1, how much tuition is due, how much has been paid and what balance remains? Give the payment status.

For 2201001 in 2024-1: amount_due = 8 credits × 1,050,000 VND × (1 − 0%) = 8,400,000 VND. Paid = 8,400,000. Balance = 8,400,000 − 8,400,000 = 0; status paid.

| Chỉ số | Đáp án | Ô đối chiếu |
| --- | --- | --- |
| records.0.amount_due | 8400000.0 | Answers!C34 |
| records.0.amount_paid | 8400000.0 | Answers!C35 |
| records.0.balance | 0.0 | Answers!C36 |
| records.0.status | paid | Answers!C37 |

### K17 — PROVISIONAL finance PR2

For student 2201002 in semester 2024-1, how much tuition is due, how much has been paid and what balance remains? Give the payment status.

For 2201002 in 2024-1: amount_due = 8 × 1,050,000 × (1 − 0%) = 8,400,000 VND. Paid = 0. Balance = 8,400,000 − 0 = 8,400,000; status unpaid. At the fixed as-of date 2026-10-18, the debt is overdue.

| Chỉ số | Đáp án | Ô đối chiếu |
| --- | --- | --- |
| records.0.amount_due | 8400000.0 | Answers!C38 |
| records.0.amount_paid | 0.0 | Answers!C39 |
| records.0.balance | 8400000.0 | Answers!C40 |
| records.0.status | unpaid | Answers!C41 |

### K18 — PROVISIONAL finance PR2

For student 2201003 in semester 2024-1, how much tuition is due, how much has been paid and what balance remains? Give the payment status.

For 2201003 in 2024-1: amount_due = 8 × 1,050,000 × (1 − 20%) = 6,720,000 VND. Paid = 6,720,000. Balance = 0; status paid. The 20% discount is not a partial payment.

| Chỉ số | Đáp án | Ô đối chiếu |
| --- | --- | --- |
| records.0.amount_due | 6720000.0 | Answers!C42 |
| records.0.amount_paid | 6720000.0 | Answers!C43 |
| records.0.balance | 0.0 | Answers!C44 |
| records.0.status | paid | Answers!C45 |

### K19 — PROVISIONAL finance PR2

How many IT01 students still owe tuition for semester 2024-1, and what is their total outstanding balance?

Join Tuition with Students by student_id, then filter class IT01 and semester 2024-1. Only 2201002 and 2201009 have positive balances. Count = 2; total balance = 8,400,000 + 8,400,000 = 16,800,000 VND.

| Chỉ số | Đáp án | Ô đối chiếu |
| --- | --- | --- |
| students_with_balance | 2 | Answers!C49 |
| total_balance | 16800000.0 | Answers!C50 |

### K20 — PROVISIONAL finance PR2

Check whether student 2201001 qualifies for scholarship SCH02 in semester 2024-1. State GPA, conduct, tuition status and the eligibility decision.

Use the finance snapshot conduct score, 80, for 2201001. Shared grade inputs give totals 8.6, 7.1, 7.8, mapping to points 4, 3, 3 on credits 2, 3, 3. GPA = (2×4 + 3×3 + 3×3) / 8 = 3.25. SCH02 requires GPA ≥ 3.2 and conduct ≥ 80. Tuition balance = 0 and failed-course count = 0. All four checks are TRUE, so eligible = TRUE.

| Chỉ số | Đáp án | Ô đối chiếu |
| --- | --- | --- |
| semester_gpa | 3.25 | Answers!C51 |
| conduct_score | 80.0 | Answers!C52 |
| scholarships.1.eligible | True | Answers!C53 |

### K21 — PROVISIONAL finance PR2

Rank the Information Technology candidates for scholarship SCH02 in semester 2024-1. How many are eligible and who is first?

For each Information Technology student, apply the four SCH02 conditions in K20. Nine students qualify. Sort by GPA descending, then conduct descending, then student_id ascending. 2201016 has GPA 4.00 and conduct 97, higher conduct than the other GPA-4 candidates, so it ranks first. The candidate count is not the number of awards.

| Chỉ số | Đáp án | Ô đối chiếu |
| --- | --- | --- |
| eligible_count | 9 | Answers!C54 |
| ranking.0.student_id | 2201016 | Answers!C55 |
| ranking.0.semester_gpa | 4.0 | Answers!C56 |

### K22 — PROVISIONAL finance PR2

Calculate the net teacher pay for T001 in October 2024. Include monthly teaching periods and the overtime bonus.

Use finance teacher T001, a Lecturer with one section of 3 weekly periods. Monthly periods = 3 × 4 = 12. Teaching pay = 12 × 120,000 = 1,440,000 VND. Overtime periods = MAX(12 − 24, 0) = 0; overtime bonus = 0. Gross = 7,500,000 + 1,440,000 + 0 + 0 = 8,940,000. Net = 8,940,000 − 788,000 = 8,152,000 VND.

| Chỉ số | Đáp án | Ô đối chiếu |
| --- | --- | --- |
| periods | 12 | Answers!C46 |
| overtime_bonus | 0.0 | Answers!C47 |
| net | 8152000.0 | Answers!C48 |

### K23 — PROVISIONAL finance PR2

What is the total net payroll and total teaching periods for the Information Technology faculty in October 2024? Also state the number of teachers.

Select the eight finance teachers in Information Technology for 2024-10. Monthly periods = 12 + 12 + 0 + 0 + 0 + 0 + 0 + 0 = 24. Sum the eight net pay values in the table below: 75,462,000 VND. Include teachers with zero teaching periods because their base salary still applies.

| Chỉ số | Đáp án | Ô đối chiếu |
| --- | --- | --- |
| teachers | 8 | Answers!C57 |
| total_periods | 24 | Answers!C58 |
| total_net | 75462000.0 | Answers!C59 |

### K24 — PROVISIONAL finance PR2

Calculate teacher T999 pay for October 2024. Tell me if the teacher does not exist.

Search F_Teachers for T999. No matching teacher exists. Expected outcome is the missing-teacher business error, not zero salary.

Đây là ca kiểm tra lỗi hoặc tổng hợp; đối chiếu thông báo lỗi / nội dung đầy đủ trong log và các bước tính trên.

## Bảng kiểm tra bổ sung

### Điểm của 2201005 trong 2024-1 — K15

| Môn | Quá trình | Cuối kỳ | Tính tổng | Điểm hệ 4 | Tín chỉ |
| --- | --- | --- | --- | --- | --- |
| CS101 | 3.5 | 4.0 | ROUND(3.5×0.4 + 4.0×0.6,1) = 3.8 | 0 | 3 |
| GE101 | 3.8 | 4.3 | ROUND(3.8×0.4 + 4.3×0.6,1) = 4.1 | 1 | 2 |
| GE102 | 4.2 | 3.8 | ROUND(4.2×0.4 + 3.8×0.6,1) = 4.0 | 1 | 3 |

### Danh sách ứng viên SCH02 — K21, PROVISIONAL

| Hạng | student_id | GPA | Conduct | Nợ học phí | Môn chưa đạt |
| --- | --- | --- | --- | --- | --- |
| 1 | 2201016 | 4 | 97 | 0 | 0 |
| 2 | 2201003 | 4 | 95 | 0 | 0 |
| 3 | 2201019 | 4 | 94 | 0 | 0 |
| 4 | 2201004 | 4 | 89 | 0 | 0 |
| 5 | 2201017 | 3.63 | 90 | 0 | 0 |
| 6 | 2201008 | 3.63 | 80 | 0 | 0 |
| 7 | 2201018 | 3.38 | 88 | 0 | 0 |
| 8 | 2201006 | 3.38 | 87 | 0 | 0 |
| 9 | 2201001 | 3.25 | 80 | 0 | 0 |

### Cộng lương khoa IT tháng 2024-10 — K23, PROVISIONAL

| GV | Tiết tháng | Lương cơ bản | Tiền tiết | Khấu trừ | Lương thực nhận |
| --- | --- | --- | --- | --- | --- |
| T001 | 12 | 7,500,000 | 1,440,000 | 788,000 | 8,152,000 |
| T002 | 12 | 8,400,000 | 1,440,000 | 882,000 | 8,958,000 |
| T003 | 0 | 10,100,000 | 0 | 1,061,000 | 9,039,000 |
| T004 | 0 | 8,400,000 | 0 | 882,000 | 7,518,000 |
| T005 | 0 | 13,200,000 | 0 | 1,386,000 | 11,814,000 |
| T006 | 0 | 10,100,000 | 0 | 1,061,000 | 9,039,000 |
| T007 | 0 | 15,900,000 | 0 | 1,670,000 | 14,230,000 |
| T008 | 0 | 7,500,000 | 0 | 788,000 | 6,712,000 |

Tổng thực nhận = 8,152,000 + 8,958,000 + 9,039,000 + 7,518,000 + 11,814,000 + 9,039,000 + 14,230,000 + 6,712,000 = **75,462,000 VND**.

## Đọc lại câu trả lời Gemini lịch sử

Đã đọc 24 câu trả lời trong `historical/gemini-stdio.jsonl`, so với câu hỏi, dữ liệu và kết quả tool đầy đủ. Phạm vi này là kiểm tra nội dung của lượt chạy cụ thể, không phải cam kết model luôn đúng. Giữ nguyên log gốc và các cờ `requiresHumanReview`. Phần finance của lần đo cũ vẫn chỉ là provisional.

| Nhóm câu | Nội dung đã đối chiếu | Kết quả |
| --- | --- | --- |
| K01–K06 | ID, khoa/chức danh, học kỳ, số section, số tiết, enrolment, điểm trung bình, tỷ lệ đạt | Khớp |
| K07–K11 | 3/15 không cấm thi; 4/15 cấm thi; tổng 105/27; conduct 92 Excellent và 50 Average | Khớp |
| K12 | Đúng hai ID, GPA thấp và các section vượt ngưỡng; không gán conduct 50/60 là kém | Khớp |
| K13 | Đúng bốn ID; có đủ lý do GPA/vắng và conduct 43/48 ở hai em tương ứng | Khớp |
| K14 | Thông báo sinh viên không tồn tại, không suy ra số liệu | Khớp |
| K15 | GPA 0.63, 8/5 tín chỉ, 14/45 buổi, ba section bị cấm, conduct 50 Average | Khớp |
| K16–K19 | Số tiền, đơn vị VND, paid/unpaid/overdue, khoản giảm 20%, hai sinh viên nợ | Khớp |
| K20–K21 | GPA + conduct đúng snapshot, tuition paid, không nợ môn, SCH02 eligible, 9 ứng viên và ID đầu | Khớp |
| K22–K23 | 12 tiết, không thưởng vượt giờ, net 8,152,000; khoa 8 GV/24 tiết/net 75,462,000 | Khớp |
| K24 | Thông báo giảng viên không tồn tại, không bịa mức lương | Khớp |

## Thao tác kiểm tra trong Excel

1. Mở `test-reference.xlsx`, xem phép tính từng bước ở sheet Manual rồi tìm ID ở sheet Answers; cột C là công thức, D là đối chiếu CSV độc lập, E là kiểm tra khớp.
2. Bấm vào ô C được chỉ ra ở mỗi câu, đọc công thức và lần về sheet nguồn. Dùng các phép tính trong tài liệu này để đối chiếu số trung gian.
3. Kiểm tra riêng các biên K07, K08, K11 và các khoản tiền K18, K22; không làm tròn trước khi so ngưỡng vắng.
4. Phần tính tay ở Manual cố định theo snapshot CSV đã ghi. Nếu thay nguồn, cập nhật số đầu vào tính tay rồi đối chiếu với Answers. Nếu tự ký duyệt, chỉ ghi tên/ngày sau khi đã kiểm tra.

## Đối chiếu lượt chạy main hiện tại

Đã đọc lại 15 câu trả lời trong `gemini-stdio.jsonl` sau khi làm rõ cấu hình. K07/K08 đúng biên cấm thi, K12 đủ hai sinh viên và đúng các section/lý do; tỷ lệ 33.3% được gọi là maximum section rate. K06 ghi 30 graded enrolments. K15 giữ GPA 0.63, tỷ lệ tổng 31.1%, ba section bị cấm và conduct Average. Các phần finance phía trên vẫn provisional; log lịch sử không bị ghi lại.
