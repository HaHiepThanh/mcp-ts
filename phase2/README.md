# Lần 2 — nộp gì cho thầy

Thầy đã xác nhận: Lần 2 **không có Training/Test**, thay vào đó **trình diễn cấu hình MCP**, mỗi cấu hình chạy ra kết quả khác nhau, có LOG ghi lại.

Tạo gói nộp: `bash build-submission.sh` (cùng lệnh với Lần 1) → **`phase2/submission/`** + **`phase2/submission.zip`**.

## Đối chiếu yêu cầu (`requirement.md`) → file

| Yêu cầu của đề | Nằm ở đâu trong `submission/` | Trạng thái |
| --- | --- | --- |
| Nêu các tình huống chạy thử | `04-scenarios/benchmark.ts` (11 tình huống: 1 tool, chuỗi tool, 2 server, tool lỗi, elicitation, sampling…) · `questions.txt` | ✅ có sẵn · ⏳ sẽ thêm tình huống với dataset mở rộng |
| Các bộ tham số (cấu hình) | `03-configurations/` — `host.json` (Gemini), `host.qwen.json` (Qwen local), `host.http.json` (HTTP), `academic.json` (dữ liệu + cache), `grading.json` (quy chế điểm), `vscode-mcp.json` | ✅ |
| Các kết quả và so sánh kết quả | `05-results/model-comparison.md` (4 model × 11 câu × 2 lần) · `results.md` (stdio vs HTTP, 2025 vs 2026, cache, lỗi) | ✅ |
| Nhận xét | `07-observations-improvements/model-observations.md` | ✅ |
| (Cải tiến) | `07-observations-improvements/improvements.md` — 10 cải tiến có bằng chứng trước/sau | ✅ |
| Code + data với từng cấu hình ra kết quả khác nhau | `02-code/` · chạy `npm run compare` / `npm run chat -- --config …` | ✅ |
| LOG ghi lại kết quả | `06-logs/` — mọi lượt chat (`chat-*.jsonl`: câu hỏi, tool gọi, thời gian, token) + mọi lần benchmark (`compare-*.json`) | ✅ |
| pptx 20+ slide | `01-slides/` — pptx tên có chữ `phase2` trên Drive `team/slides/` | ⏳ chưa làm |
| txt 10–20 câu trắc nghiệm | `08-quiz/` — bản nháp 12 câu `quiz-draft.txt` | ⚠️ bản nháp |

## Việc còn lại cho Lần 2 (đề xuất — chờ nhóm trưởng duyệt)

1. **Mở rộng dataset + tool mới** (xem đề xuất trong cuộc trao đổi với Claude; sau khi duyệt sẽ ghi lại tại đây).
2. **Thí nghiệm cấu hình** — mỗi cái là 1 "bộ tham số" với kết quả so sánh:
   - Mô tả tool rõ ràng vs sơ sài → độ chính xác của LLM thay đổi thế nào
   - `maxToolRounds` 2 / 4 / 8 → câu hỏi nhiều bước có bị cắt không
   - `temperature` 0 / 0.2 / 1.0 → độ ổn định câu trả lời
   - stdio vs HTTP, giao thức 2025 vs 2026 → thời gian end-to-end
   - Bật/tắt từng server (least privilege) → LLM còn trả lời được gì
3. **Benchmark khó hơn** + `test_cases.csv` của TV2 để các model thật sự khác nhau về độ chính xác.

## File trong thư mục này

| File | Là gì |
| --- | --- |
| `requirement.md` | Đề bài Lần 2 |
| `improvements.md` | Cải tiến đã làm (có bằng chứng) + dự kiến |
| `quiz-draft.txt` | 12 câu trắc nghiệm nháp về kết quả so sánh |
| `submission/`, `submission.zip` | Gói nộp — **tự sinh** |
