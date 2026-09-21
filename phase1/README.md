# Lần 1 — nộp gì cho thầy

> 🧊 **Đã đóng băng** tại git tag `phase1-freeze`: code, tài liệu, dữ liệu Lần 1 luôn lấy từ tag này; kết quả ví dụ lấy từ `frozen/examples-output/`. Chỉ slide và trắc nghiệm (từ Drive `team/`) còn được cập nhật. Phân công: [`TASKS.md`](../TASKS.md).

Tạo gói nộp (chạy lại khi có slide/trắc nghiệm mới trên Drive):

```bash
bash build-submission.sh
```

→ thư mục **`phase1/submission/`** và file **`phase1/submission.zip`**. File `submission/STATUS.txt` cho biết mục nào đã là bản của nhóm (✅), mục nào vẫn là bản nháp (⚠️).

## Đối chiếu yêu cầu (`requirement.md`) → file

| Yêu cầu của đề | Nằm ở đâu trong `submission/` | Trạng thái |
| --- | --- | --- |
| Mô tả bài toán | `05-docs/architecture.md` §1–2 · slide 3–7 | ✅ nội dung có sẵn |
| Mô tả giải thuật | `05-docs/architecture.md` §3–7 (tool-calling loop, elicitation, sampling, tính GPA + ví dụ tính tay) | ✅ |
| Lưu đồ xử lý | `05-docs/architecture.md` — 9 sơ đồ Mermaid (đã kiểm tra render được) | ✅ (TV3 xuất PNG cho slide) |
| Mô tả thư viện sử dụng | `05-docs/method-reference.md` (phần đầu) · slide 17 · `02-code/mcp-academic/package.json` | ✅ |
| Input/Output của các function/method | `05-docs/method-reference.md` (≈ 60 method, server + client + request options + lỗi) | ✅ |
| Code ví dụ từng function cho nhóm khác làm theo | `02-code/mcp-academic/examples/` — S1–S8, C1–C5 (13 file) · chạy: `npm run examples` | ✅ |
| Ví dụ từng method với từng bộ tham số (ipynb/data) | `04-examples-per-method/*.json` + `*.log` (kết quả chạy thật của từng bộ tham số) · `03-data/` | ✅ — thầy cho phép nộp code thay notebook |
| ~~Bộ câu hỏi tình huống~~ | — | ❌ thầy đã bỏ |
| pptx 30+ slide | `01-slides/` — **file pptx do Phú + Hoàng làm**, đặt trên Drive `team/slides/` tên có chữ `phase1`; nội dung nháp từng slide: `01-slides/slides-content.md` | ⏳ nhóm đang làm |
| txt 10–20 câu trắc nghiệm | `06-quiz/` — bản nháp 20 câu `quiz-draft.txt`; Khoa duyệt/sửa rồi đặt `team/quiz/questions-phase1.txt` | ⚠️ đang là bản nháp |

## Thêm (không bắt buộc nhưng nên nộp kèm)

| Nội dung | File |
| --- | --- |
| Kịch bản demo 8 phút | `05-docs/demo-script.md` |
| Hướng dẫn chạy trong VS Code | `05-docs/vscode-guide.md` |
| Bảng số liệu đo thật | `05-docs/results.md` |

## Nên nộp phần nào?

- **Tối thiểu** (đúng đề): `01-slides/*.pptx` + `02-code/` + `03-data/` + `04-examples-per-method/` + `06-quiz/questions*.txt`.
- **Đầy đủ** (khuyên dùng): nộp cả `submission.zip` — thầy có đủ tài liệu, lưu đồ và bằng chứng chạy thật.
- **Không bao giờ nộp** file `.env` (API key) — script đã tự loại ra.

## File trong thư mục này

| File | Là gì |
| --- | --- |
| `requirement.md` | Đề bài Lần 1 |
| `slides-content.md` | Nội dung nháp 34 slide (tiêu đề, ý chính, hình, nguồn số liệu) cho Phú/Hoàng |
| `quiz-draft.txt` | 20 câu trắc nghiệm nháp (tiếng Anh, có đáp án) cho Khoa duyệt |
| `frozen/examples-output/` | Kết quả chạy 13 ví dụ tại thời điểm đóng băng |
| `submission/`, `submission.zip` | Gói nộp — **tự sinh**, không sửa tay |
