## Giai đoạn 1 — hoàn thiện Phase1

| Ai | Việc | Đầu vào | Nộp (Drive `MCP-TS-Seminar/team/`) | Xong khi |
| --- | --- | --- | --- | --- |
| **Phú** | Slide phần A: bài toán, kiến trúc, giao thức, giải thuật, lưu đồ | `phase1/slides-content.md`, `mcp-academic/docs/architecture.md` (sơ đồ Mermaid → <https://mermaid.live> → PNG) | `slides/part-A-theory.pptx` | Đủ 19 slide, mọi số liệu lấy từ tài liệu, tiếng Anh |
| **Hoàng** | Slide phần B: SDK API, ví dụ từng method + bộ tham số, kết quả 2 LLM · **ghép A + B** | `phase1/slides-content.md`, `docs/method-reference.md`, `phase1/frozen/examples-output/*.log` (chụp màn hình) | `slides/part-B-technical.pptx` → bản ghép **`slides/MCP-TS-SDK-phase1.pptx`** | ≥ 30 slide tổng, cùng 1 template |
| **Khoa** | Trắc nghiệm Lần 1: duyệt 20 câu nháp (đúng đáp án? trả lời được từ slide?), sửa/thay câu khó hiểu | `phase1/quiz-draft.txt`, `docs/quiz-facts.md` | `quiz/questions-phase1.txt` | 10–20 câu, định dạng như bản nháp |
| **Khoa** | Kiểm thử "như nhóm khác": cài đặt theo `setup-guide.md` trên máy mình từ đầu, chạy `npm run examples` + `npm run chat` | `setup-guide.md` | `quiz/test-report.md` (bước nào vướng, ảnh chụp lỗi) | Chạy được hoặc có báo cáo lỗi cụ thể |
| **Khoa** | Video demo dự phòng Lần 1 (~8 phút, thuyết minh tiếng Anh) | `docs/demo-script.md` | `video/demo-phase1.mp4` | Theo đúng kịch bản Part A + B |
| **Tiến** | Duyệt độ chính xác kỹ thuật của slide phần B trước khi Hoàng ghép | slide của Hoàng | góp ý trong nhóm chat | — |

## Giai đoạn 2 — xây Lần 2 (code)

Lần 2 cần: **tình huống chạy thử · các bộ tham số (cấu hình) · kết quả + so sánh · nhận xét · cải tiến · LOG**. Nhóm mở rộng dữ liệu (thêm giảng viên, điểm danh, rèn luyện, tài chính) để có tình huống phong phú, rồi đo nhiều cấu hình.

### Phú — dữ liệu + tool giảng viên / lớp học phần (làm TRƯỚC, Tiến và Hoàng cần dữ liệu này)

1. Mở rộng `scripts/generate-sample-data.ts` (giữ seed cố định):
   - `teachers.csv` (~20): `teacher_id, full_name, faculty, title (Lecturer|Senior Lecturer|Associate Professor|Professor), degree (MSc|PhD), hire_date, email`
   - `sections.csv` (~40): `section_id, course_id, semester, class_id, teacher_id, room, weekday (Mon–Sat), start_period, periods` — mỗi dòng `grades.csv` phải thuộc đúng 1 section (cùng course, semester, class)
2. Load + kiểm tra dữ liệu trong `src/server/academic/data.ts` (khóa ngoại sai → ghi vào data-quality report, như hiện tại).
3. Tool mới trong server `academic`: `search_teachers`, `class_timetable(class_id, semester)`, `teacher_workload(teacher_id, semester)` (số lớp, số tiết), `teacher_grade_report(teacher_id, semester?)` (điểm TB, tỷ lệ đạt các lớp của GV).
4. Resource: `academic://teachers/{teacher_id}`.
5. Ví dụ `examples/server/s9-teachers.ts` (≥ 3 bộ tham số mỗi tool: hợp lệ / biên / sai).

### Hoàng — điểm danh, rèn luyện, cảnh báo học vụ + thí nghiệm cấu hình

1. Dữ liệu (thêm vào generator, sau khi Phú có `sections.csv`):
   - `attendance.csv`: `student_id, section_id, week (1–15), status (present|absent|late|excused)`
   - `conduct.csv` (điểm rèn luyện): `student_id, semester, score (0–100)`
2. Quy tắc trong `config/academic-rules.json` (không hard-code): vắng > 20% số buổi → cấm thi; xếp loại rèn luyện (≥90 Excellent, ≥80 Good, ≥65 Fairly good, ≥50 Average, <50 Weak); ngưỡng cảnh báo học vụ.
3. Tool: `attendance_summary(student_id | section_id, semester)`, `conduct_score(student_id, semester?)`, **`at_risk_students(class_id | faculty, semester)`** (GPA thấp + vắng nhiều + rèn luyện kém, nêu lý do từng em).
4. Prompt: `advisor_meeting(student_id)` (gom điểm + điểm danh + rèn luyện).
5. **Thí nghiệm cấu hình** (mỗi thí nghiệm = 1 bộ tham số, chạy benchmark, ghi kết quả vào `mcp-academic/docs/experiments.md`):
   - mô tả tool **rõ ràng vs sơ sài** (tạo bản config/biến thể mô tả ngắn) → độ chính xác thay đổi?
   - `agent.maxToolRounds` = 2 / 4 / 8 · `llm.temperature` = 0 / 0.2 / 1.0
   - stdio vs HTTP (`host.json` vs `host.http.json`) — thời gian end-to-end
6. Ví dụ `examples/server/s10-attendance-conduct.ts`.

### Tiến — server thứ 3 `finance` (dữ liệu nhạy cảm, tách riêng)

1. Server mới `src/server/finance/` (theo mẫu `src/server/utility/`), cổng HTTP 3003, đăng ký trong `config/host*.json` và `.vscode/mcp.json`.
2. Dữ liệu (generator riêng hoặc mở rộng generator chung):
   - `tuition.csv`: `student_id, semester, credits_registered, fee_per_credit, discount_pct, amount_due, amount_paid, due_date, paid_date`
   - `scholarships.csv`: `scholarship_id, name, type (merit|need), amount, min_gpa, min_conduct, slots_per_faculty` · `scholarship_awards.csv`: `student_id, semester, scholarship_id, amount`
   - `payroll.csv` (lương thưởng GV, **dữ liệu giả**): `teacher_id, month (YYYY-MM), base_salary, bonus, deductions` — số tiết lấy từ `sections.csv` của Phú
3. Quy tắc trong `config/finance.json`: đơn giá tiết theo học hàm, thưởng vượt giờ, điều kiện học bổng.
4. Tool: `tuition_status(student_id, semester)`, `outstanding_tuition(class_id | faculty)`, `check_scholarship_eligibility(student_id, semester)` (GPA + rèn luyện + không nợ môn + đã đóng học phí — **tính bằng code, không để LLM tự suy**), `rank_scholarship_candidates(faculty, semester, scholarship_id)`, `calculate_teacher_pay(teacher_id, month)`, `payroll_summary(month, faculty?)`. Tool thay đổi dữ liệu (nếu có, ví dụ `approve_payroll`) **phải hỏi xác nhận** (elicitation) như `update_grade`.
5. **Least privilege**: cấu hình host chỉ bật `academic` + `utility` (không `finance`) → LLM có từ chối đúng câu hỏi lương/học phí không? Ghi vào `docs/experiments.md`.
6. Đo ngân sách token: 3 server ≈ 25+ tool có vượt ngữ cảnh 8k của Qwen không? Đề xuất cách xử lý (tăng context / bật tắt server theo cấu hình).
7. Ví dụ `examples/server/s11-finance.ts`. Duyệt kỹ thuật các PR của Hoàng và Phú trước khi nhóm trưởng duyệt cuối.

### Khoa — câu hỏi kiểm thử, chạy đo, ghép Lần 2

1. **Câu hỏi kiểm thử** cho tính năng mới: ≥ 15 câu tiếng Anh tự nhiên + đáp án **tính tay bằng Excel** từ CSV mà Phú/Hoàng/Tiến sinh ra → `phase2/test-cases.csv` (`id, question, expected_tools, expected_values, note`). Tiến/Hoàng chuyển chúng thành case trong `demo/benchmark.ts`.
2. **Chạy đo** trên máy mình (Gemini và/hoặc Qwen theo `setup-guide.md`) sau mỗi đợt tính năng mới; chép log vào `phase2/runs/khoa/` (xem mục Log bên dưới).
3. **Slide Lần 2** (≥ 20): mỗi bạn code gửi 2–3 slide về phần mình; Khoa làm phần chung (tình huống, bảng so sánh, nhận xét, cải tiến — nguồn: `phase2/improvements.md`, `docs/model-observations.md`, `docs/experiments.md`) và ghép → Drive `slides/MCP-TS-SDK-phase2.pptx`.
4. **Trắc nghiệm Lần 2**: hoàn thiện từ `phase2/quiz-draft.txt` + câu về tính năng mới → Drive `quiz/questions-phase2.txt`.
5. Video demo dự phòng Lần 2 → `video/demo-phase2.mp4`.

### Thứ tự phụ thuộc

```
Phú: teachers + sections ──┬──▶ Hoàng: attendance + conduct ──▶ at_risk_students
                            └──▶ Tiến: payroll (cần số tiết)
Tiến: tuition + scholarships (làm song song ngay từ đầu; eligibility cần conduct của Hoàng)
Khoa: test-cases sau khi có CSV ──▶ benchmark ──▶ chạy đo ──▶ slide + quiz Lần 2
```

---

### Checklist trước khi tạo PullRequest

- [ ] `npm run typecheck` sạch · `npm run examples` tất cả ✔
- [ ] Tên tool, tham số, cột CSV, mô tả: **tiếng Anh**, `snake_case`, mỗi tham số có `.describe(...)`
- [ ] Tool trả số liệu dùng `outputSchema` + `structured(...)`; lỗi nghiệp vụ dùng `fail(...)` (xem `src/lib/results.ts`)
- [ ] Quy tắc/ngưỡng nằm trong file `config/*.json`, **không hard-code** trong code
- [ ] Tool chỉ đọc có `annotations: READ_ONLY`; tool thay đổi dữ liệu phải hỏi xác nhận (elicitation)
- [ ] Mỗi tool có ví dụ (≥ 3 bộ tham số) trong `examples/server/` và ≥ 1 case trong `demo/benchmark.ts`
- [ ] Cập nhật `docs/method-reference.md` và bảng tool trong `mcp-academic/README.md`
- [ ] **Không** commit `.env`, `node_modules/`, `outputs/`
- [ ] Không sửa `phase1/`, tag `phase1-freeze` (Lần 1 đã khóa)
- [ ] Dùng AI hỗ trợ code thì được, nhưng **phải tự chạy checklist này** và hiểu code mình nộp

### Log (yêu cầu của đề Phase2)

`outputs/` không lên git. Sau mỗi lần chạy đo, chép log cần nộp vào **`phase2/runs/<tên>/`** (có commit):
- `outputs/benchmarks/compare-*.json` (benchmark), `outputs/logs/chat-*.jsonl` (chat)
- đặt tên có ngữ cảnh, vd `phase2/runs/hoang/maxToolRounds-2.json`

Script `build-submission.sh` tự gom `phase2/runs/` vào gói nộp Lần 2.
