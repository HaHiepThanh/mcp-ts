# Phân công Lần 1 — đề bài cho từng thành viên

> Tài liệu nội bộ (tiếng Việt). **Slide, trắc nghiệm, demo đều làm bằng tiếng Anh.**
> Code chỉ do nhóm trưởng + Claude làm — các bạn **không cần cài hay sửa code** (trừ TV5 chạy thử theo README).
> Mọi file nộp vào Google Drive: `My Drive/MCP-TS-Seminar/team/…`. Thư mục `code/` chỉ để **xem**, không sửa (bị ghi đè khi đồng bộ).

Tài liệu nguồn (trong `code/mcp-academic/docs/`):

| File | Dùng cho |
| --- | --- |
| `architecture.md` | Bài toán, kiến trúc, giải thuật, 8 lưu đồ Mermaid |
| `method-reference.md` | Bảng Input/Output của mọi method |
| `results.md` | Bảng số liệu chạy thật (ví dụ + chat với Gemini) |
| `demo-script.md` | Kịch bản demo 8 phút |
| `quiz-facts.md` | 30 "sự thật" để ra câu hỏi trắc nghiệm |
| `outputs/examples/*.log` | Output thật của từng ví dụ — chụp màn hình đưa vào slide |

---

## Dàn ý slide (≈ 34 slide · 30 phút)

| # | Slide | Nguồn | Người làm |
| --- | --- | --- | --- |
| 1 | Title — MCP.2502: MCP TypeScript SDK | — | TV3 |
| 2 | Agenda | — | TV3 |
| 3 | The problem: LLMs cannot reach your data (N×M connectors) | architecture §1 | TV3 |
| 4 | What is MCP — "USB-C for AI" | architecture §1 | TV3 |
| 5 | Host · Client · Server | architecture §2 (sơ đồ) | TV3 |
| 6 | Tools · Resources · Prompts — who controls what | architecture §2 (bảng) | TV3 |
| 7 | Our case study: academic records assistant (dataset, 2 servers, 2 hosts) | README, data/sample/README_data.md | TV3 |
| 8 | JSON-RPC 2.0 messages | architecture §3, C5 wire trace | TV3 |
| 9 | Session lifecycle 2025 vs 2026-07-28 (sequence) | architecture §3 | TV3 |
| 10 | Transports: stdio vs Streamable HTTP | architecture §3, results §3 | TV3 |
| 11 | Main algorithm: the tool-calling loop (flowchart) | architecture §4 | TV3 |
| 12 | Example run: report for IT01 across 2 servers (sequence) | architecture §4 | TV3 |
| 13 | Elicitation — human in the loop (sequence, 2 eras) | architecture §5 | TV3 |
| 14 | Sampling — server borrows the host's LLM | architecture §6 | TV3 |
| 15 | Domain algorithm: scores → letter → GPA (flowchart + worked example) | architecture §7 | TV3 |
| 16 | Data loading & validation (7 injected errors caught) | architecture §8 | TV3 |
| 17 | The TypeScript SDK v2: packages, v1 vs v2 | README gốc SDK, method-reference | TV4 |
| 18 | Server API: `new McpServer`, `serveStdio`, `createMcpHandler` | method-reference §1 | TV4 |
| 19 | `registerTool` — input/output + S2 parameter sets | method-reference, results §2 | TV4 |
| 20 | Tool lifecycle: disable / enable / update / remove (S3) | S3 log | TV4 |
| 21 | Resources & templates (S4) | method-reference, S4 log | TV4 |
| 22 | Prompts & completion (S5) | S5 log | TV4 |
| 23 | Progress, logging, cancellation (S6) | S6 log | TV4 |
| 24 | Elicitation & sampling API (S7) | results §7 | TV4 |
| 25 | Client API: connect options, eras (C1) | results §4 | TV4 |
| 26 | Request options & error taxonomy (C2) | results §5 | TV4 |
| 27 | Subscriptions (C3) & caching (C4) | results §6, C3 log | TV4 |
| 28 | Configuration = the only thing a host needs (`config/host.json`, `.vscode/mcp.json`) | config files | TV4 |
| 29 | **Live demo** (nhóm trưởng) | demo-script | Nhóm trưởng |
| 30 | Results: two LLMs (Gemini vs local Qwen) — accuracy, speed, cost; LLM ≈ 99 % of the time | model-comparison, model-observations, results §8 | TV4 |
| 31 | Lessons learned (LLM filled `process_score: 0` → elicitation saved us; model choice matters) | architecture §5, results §8 | TV4 |
| 32 | Summary | — | TV3 |
| 33 | References | — | TV3 |
| 34 | Q&A | — | TV3 |

Phân bổ thời gian: slide 1–16 ≈ 11 phút · 17–28 ≈ 9 phút · demo 8 phút · 30–34 ≈ 2 phút.

---

## TV2 — Dữ liệu thật

**Nộp vào:** `team/data/` · **Hạn:** sớm nhất có thể (code đang chạy bằng data mẫu tạm).

1. Mở `code/mcp-academic/data/sample/` xem **mẫu định dạng** (3 file CSV + `README_data.md`).
2. Làm 3 file theo **đúng tên cột tiếng Anh**:
   - `students.csv` (~200 dòng): `student_id, full_name, gender, date_of_birth, class_id, faculty, enrollment_year, email`
   - `courses.csv` (~15 dòng): `course_id, course_name, credits, faculty` — tên môn **bằng tiếng Anh**
   - `grades.csv` (~1.500 dòng): `student_id, course_id, semester, process_score, final_score` — **không có cột điểm tổng**
3. Quy định: CSV **UTF-8**, dòng đầu là tên cột, ngày `YYYY-MM-DD`, điểm dấu chấm (`7.5`), học kỳ dạng `2024-1`, **dữ liệu giả** (không dùng thông tin thật).
4. Cho khoảng 10 sinh viên **học lại** một môn ở học kỳ sau; cố ý chèn **~10 dòng lỗi** (điểm > 10, thiếu điểm, mã SV không tồn tại, dòng trùng) và liệt kê trong `README_data.md`.
5. `test_cases.csv` (30–50 dòng): `id, question, expected_tool, expected_answer, note` — câu hỏi **tiếng Anh tự nhiên**, đáp án **tính tay bằng Excel** theo quy tắc:
   - Điểm tổng = 0.4 × quá trình + 0.6 × cuối kỳ, làm tròn 1 chữ số
   - A ≥ 8.5 → 4 · B ≥ 7.0 → 3 · C ≥ 5.5 → 2 · D ≥ 4.0 → 1 · F < 4.0 → 0
   - GPA = Σ(điểm hệ 4 × tín chỉ) / Σ tín chỉ, 2 chữ số; GPA tích lũy lấy **lần học điểm cao nhất** của mỗi môn
   - Xếp loại: ≥3.6 Excellent · ≥3.2 Very good · ≥2.5 Good · ≥2.0 Average · còn lại Weak
6. **Xác nhận với quy chế trường**: tỷ lệ 40/60 và mốc điểm chữ có đúng không — sai chỗ nào báo nhóm trưởng (chỉ sửa file cấu hình, không sửa code).

## TV3 — Slide lý thuyết (slide 1–16, 32–34)

**Nộp vào:** `team/slides/` · file `part-A-theory.pptx`.

1. Dùng **template chung** nhóm chọn (TV3 chọn và chia sẻ cho TV4 trước).
2. Nội dung theo dàn ý trên, nguồn chính là `architecture.md`. Viết **tiếng Anh**, mỗi slide ≤ 6 dòng chữ, ưu tiên hình.
3. **Lưu đồ:** copy từng khối ` ```mermaid ` trong `architecture.md` dán vào <https://mermaid.live> → *Actions → PNG/SVG* → chèn vào slide (hoặc vẽ lại bằng draw.io cho đẹp).
4. Slide 16 và 15: giữ nguyên **ví dụ tính GPA làm tay** (37/18 = 2.06) — đây là phần "mô tả giải thuật".
5. Mọi con số phải lấy từ `results.md` / log — không tự đặt số.

## TV4 — Slide kỹ thuật (slide 17–28, 30–31)

**Nộp vào:** `team/slides/` · file `part-B-technical.pptx` (cùng template TV3).

1. Mỗi slide method: **bảng Input → Output** lấy từ `method-reference.md` + **1 ảnh chụp output thật** từ `outputs/examples/<tên>.log` (mở bằng Notepad/TextEdit, phóng to, chụp phần liên quan).
2. Ít nhất 1 slide cho mỗi nhóm ví dụ S1–S8, C1–C5; nêu rõ "**parameter sets**" (hợp lệ / biên / sai) như đề yêu cầu.
3. Slide 28: đặt `config/host.json` và `.vscode/mcp.json` cạnh nhau → "same servers, only configuration".
4. Slide 30–31: bảng và nhận xét trong `results.md` §8.
5. Có chỗ không hiểu → ghi câu hỏi vào `team/slides/questions.txt`, nhóm trưởng trả lời.

## TV5 — Trắc nghiệm, kiểm thử, video dự phòng

**Nộp vào:** `team/quiz/questions.txt`, `team/quiz/test-report.md`, `team/video/`.

1. **Trắc nghiệm (10–20 câu, tiếng Anh):** chọn từ `quiz-facts.md` — trả lời được từ slide/demo; mỗi câu 4 đáp án, dùng cột "tempting wrong answers" làm đáp án nhiễu; định dạng ở cuối `quiz-facts.md`. Trộn 3 mức: dễ (khái niệm), vừa (API), khó (so sánh 2025/2026, kết quả đo).
2. **Kiểm thử như một nhóm khác:** trên máy mình, làm theo `README.md` từ đầu (cài Node ≥ 20 → `npm install` → tạo `.env` với **Gemini key của chính bạn** tại <https://aistudio.google.com/apikey> → `npm run doctor` → `npm run examples` → `npm run chat`). Ghi lại mọi chỗ khó hiểu/lỗi vào `test-report.md` (bước nào, lỗi gì, ảnh chụp). **Không gửi API key cho ai, không chụp key lên ảnh.**
3. **Video dự phòng:** quay màn hình demo theo `demo-script.md` (Part A + B, ~8 phút, có tiếng thuyết minh tiếng Anh) → `team/video/demo-backup.mp4`.

## Nhóm trưởng

- Duyệt slide TV3/TV4 trước khi ghép; ghép thành `MCP-TS-SDK-phase1.pptx` (≥ 30 slide).
- Tập demo theo `demo-script.md` ít nhất 2 lần.
- Khi TV2 nộp data: báo Claude chuyển `dataDir` sang `data/real` và chạy lại `npm run examples && npm run results`.
