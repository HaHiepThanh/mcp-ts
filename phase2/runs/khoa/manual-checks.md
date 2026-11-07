# Khoa — phép tính và kiểm tra đáp án Phase 2

K01–K24 đều được tính lại từ dataset chung main `18f3818` sau khi PR #2 đã merge. Học vụ và finance dùng chung Teachers, Sections, Conduct; workbook đã bỏ ba sheet F_* cũ. Không dùng câu trả lời LLM để tạo đáp án.

Khoa đã xác nhận tự xem Manual, hiểu biên K07/K08 và lý do cảnh báo K12 (người dùng xác nhận ngày 03-11-2026). Xác nhận này nói về các mục học vụ đã xem; lượt đo finance mới do công cụ chạy và được đối chiếu riêng. Workbook được tính lại bằng Artifact Tool, không tuyên bố đã kiểm tra trực tiếp trong Microsoft Excel.

## Quy tắc chung

- Điểm môn = ROUND(0.4 × process_score + 0.6 × final_score, 1), GPA dùng tín chỉ làm trọng số; chỉ lấy lượt học hợp lệ.
- Cấm thi khi absent / meetings > 0.20. Late/excused không phải absent; không làm tròn trước khi so ngưỡng.
- Finance lấy GPA, conduct và section từ cùng nguồn học vụ; dữ liệu tiền ở data/sample-finance. Các quy tắc lấy từ config/finance.json và scholarships.csv.
- Lượt đo cố định FINANCE_AS_OF=2026-11-03. Tất cả dữ liệu là mẫu giả.

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

### K16

For student 2201001 in semester 2024-1, how much tuition is due, how much has been paid and what balance remains? Give the payment status.

Due = 8 × 1,050,000 × (1 − 0%) = 8,400,000 VND. Paid = 8,400,000. Balance = 0; status paid.

| Metric | Expected | Excel cell |
| --- | --- | --- |
| records.0.amount_due | 8400000.0 | Answers!C34 |
| records.0.amount_paid | 8400000.0 | Answers!C35 |
| records.0.balance | 0.0 | Answers!C36 |
| records.0.status | paid | Answers!C37 |

### K17

For student 2201002 in semester 2024-1, how much tuition is due, how much has been paid and what balance remains? Give the payment status.

Due = 8 × 1,050,000 = 8,400,000 VND. Paid = 0. Balance = 8,400,000; status unpaid. Due date 2024-10-15 is before fixed as-of 2026-11-03, so overdue.

| Metric | Expected | Excel cell |
| --- | --- | --- |
| records.0.amount_due | 8400000.0 | Answers!C38 |
| records.0.amount_paid | 0.0 | Answers!C39 |
| records.0.balance | 8400000.0 | Answers!C40 |
| records.0.status | unpaid | Answers!C41 |

### K18

For student 2201003 in semester 2024-1, how much tuition is due, how much has been paid and what balance remains? Give the payment status.

Due = 8 × 1,050,000 × (1 − 20%) = 6,720,000 VND. Paid = 6,720,000. Balance = 0; status paid. A discount is not partial payment.

| Metric | Expected | Excel cell |
| --- | --- | --- |
| records.0.amount_due | 6720000.0 | Answers!C42 |
| records.0.amount_paid | 6720000.0 | Answers!C43 |
| records.0.balance | 0.0 | Answers!C44 |
| records.0.status | paid | Answers!C45 |

### K19

How many IT01 students still owe tuition for semester 2024-1, and what is their total outstanding balance?

IT01 / 2024-1 has two positive balances: 2201002 and 2201009, each 8,400,000 VND. Count = 2; total = 16,800,000 VND.

| Metric | Expected | Excel cell |
| --- | --- | --- |
| students_with_balance | 2 | Answers!C49 |
| total_balance | 16800000.0 | Answers!C50 |

### K20

Check whether student 2201001 qualifies for scholarship SCH02 in semester 2024-1. State GPA, conduct, tuition status and the eligibility decision.

GPA = (2×4 + 3×3 + 3×3) / 8 = 3.25. Shared Conduct gives 92, identical to K10. SCH02 requires GPA ≥3.2 and conduct ≥80. Tuition balance = 0 and no course is owed up to this first semester. All four conditions hold; eligible = TRUE.

| Metric | Expected | Excel cell |
| --- | --- | --- |
| semester_gpa | 3.25 | Answers!C51 |
| conduct_score | 92.0 | Answers!C52 |
| scholarships.1.eligible | True | Answers!C53 |

### K21

Rank the Information Technology candidates for scholarship SCH02 in semester 2024-1. How many are eligible and who is first?

Five IT candidates meet all four SCH02 conditions. Sort GPA descending, then conduct descending, then student ID ascending. First: 2201019, GPA 4.00, conduct 95. Five eligible candidates are distinct from the four available award places.

| Metric | Expected | Excel cell |
| --- | --- | --- |
| eligible_count | 5 | Answers!C54 |
| ranking.0.student_id | 2201019 | Answers!C55 |
| ranking.0.semester_gpa | 4.0 | Answers!C56 |

### K22

Calculate the net teacher pay for T001 in October 2024. Include monthly teaching periods and the overtime bonus.

Shared T001 is Đỗ Mai My, Professor, with SEC014/029/037: weekly periods = 3+3+3 = 9; monthly = 9×4 = 36. Rate = 250,000. Overtime = MAX(36−24,0) = 12; bonus = 12×250,000×0.5 = 1,500,000 VND. Net = 15,500,000 + 36×250,000 + 1,500,000 + 0 − 1,628,000 = 24,372,000 VND.

| Metric | Expected | Excel cell |
| --- | --- | --- |
| periods | 36 | Answers!C46 |
| overtime_bonus | 1500000.0 | Answers!C47 |
| net | 24372000.0 | Answers!C48 |

### K23

What is the total net payroll and total teaching periods for the Information Technology faculty in October 2024? Also state the number of teachers.

There are 10 IT teachers in shared main. October teaching periods = 36+36+0+0+0+0+0+0+0+0 = 72. Sum all ten net pay rows, including zero-period teachers receiving base pay: 126,949,000 VND.

| Metric | Expected | Excel cell |
| --- | --- | --- |
| teachers | 10 | Answers!C57 |
| total_periods | 72 | Answers!C58 |
| total_net | 126949000.0 | Answers!C59 |

### K24

Calculate teacher T999 pay for October 2024. Tell me if the teacher does not exist.

Teachers contains no T999. Expected outcome is the missing-teacher business error, not a zero or an invented salary.

## Danh sách ứng viên SCH02 — K21

| Rank | student_id | GPA | Conduct | Tuition balance | Owed courses |
| --- | --- | --- | --- | --- | --- |
| 1 | 2201019 | 4 | 95 | 0 | 0 |
| 2 | 2201008 | 3.63 | 88 | 0 | 0 |
| 3 | 2201017 | 3.63 | 82 | 0 | 0 |
| 4 | 2201018 | 3.38 | 91 | 0 | 0 |
| 5 | 2201001 | 3.25 | 92 | 0 | 0 |

## Cộng lương IT tháng 2024-10 — K23

| Teacher | Monthly periods | Base | Teaching pay | Overtime bonus | Deductions | Net VND |
| --- | --- | --- | --- | --- | --- | --- |
| T001 | 36 | 15500000 | 9000000 | 1500000 | 1628000 | 24372000 |
| T002 | 36 | 13400000 | 7200000 | 1200000 | 1407000 | 20393000 |
| T003 | 0 | 13100000 | 0 | 0 | 1376000 | 11724000 |
| T004 | 0 | 13400000 | 0 | 0 | 1407000 | 11993000 |
| T005 | 0 | 10200000 | 0 | 0 | 1071000 | 9129000 |
| T006 | 0 | 10100000 | 0 | 0 | 1061000 | 9039000 |
| T007 | 0 | 12900000 | 0 | 0 | 1355000 | 11545000 |
| T008 | 0 | 7500000 | 0 | 0 | 788000 | 6712000 |
| T009 | 0 | 7700000 | 0 | 0 | 809000 | 6891000 |
| T010 | 0 | 15700000 | 0 | 0 | 1649000 | 15151000 |

## Đọc lại câu trả lời Gemini mới

Đã đọc đủ 24 câu trả lời của lượt đo mới và so với dữ liệu/kết quả tool: K06 dùng graded enrolments; K07 không cấm thi ở 20%; K08 cấm thi ở 26.7%; K12/K13 nêu đúng các ID và lý do; K15 đủ GPA 0.63, 14/45 buổi, ba section bị cấm, conduct 50 Average; K20 conduct 92; K21 đủ 5 ứng viên và đúng ID đầu; K22/K23 đúng số tiết, bonus và tiền; K14/K24 báo ID không tồn tại. K15 dùng cụm “Overall Attendance Rate” rồi nói rõ 31.1% là absence rate; khi thuyết trình nên gọi chính xác là absence rate. Các cờ requiresHumanReview trong log được giữ nguyên vì kiểm tra số không tự chấm ngữ nghĩa.

Kết quả này chỉ mô tả lượt chạy đã lưu. Log lịch sử trong historical/ giữ nguyên và không được thay tên thành bằng chứng trên main chung. Để làm lại, dùng một lệnh --suite trong README; đọc từng ô Answers và Manual, lần về CSV nguồn, rồi đọc câu trả lời tương ứng.
