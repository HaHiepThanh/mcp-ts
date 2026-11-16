# Lần 1 — nộp gì cho thầy

> 🧊 **Bản nộp Lần 1** nằm ở git tag **`phase1-final`**: <https://github.com/HaHiepThanh/mcp-ts/tree/phase1-final>
>
> Lưu ý: tag này được đóng **sau khi nhóm đã làm xong Lần 2**, nên code trong tag có cả phần Lần 2 (thêm server `finance`, các tool giảng viên/điểm danh/rèn luyện, dữ liệu mở rộng). Mọi thứ Lần 1 yêu cầu vẫn giữ nguyên và chạy được; phần Lần 2 chỉ là phần thêm. Tag cũ `phase1-freeze` (bản trước khi có Lần 2) vẫn còn để đối chiếu.

## Đối chiếu yêu cầu (`requirement.md`) → file trong repo

| Yêu cầu của đề | File | Ghi chú |
| --- | --- | --- |
| Mô tả bài toán | slide 13–17 · `mcp-academic/docs/architecture.md` | |
| Mô tả giải thuật | slide 18–24 · `mcp-academic/docs/architecture.md` | tool-calling loop, tính GPA, kiểm tra dữ liệu, elicitation, sampling |
| Lưu đồ xử lý | slide 20, 22, 23 · `mcp-academic/docs/architecture.md` (sơ đồ Mermaid) | |
| Mô tả thư viện sử dụng | slide 25–27 · `mcp-academic/package.json` · phần đầu `mcp-academic/docs/method-reference.md` | |
| Input/Output của các function/method | slide 28–32 · `mcp-academic/docs/method-reference.md` | mỗi method ghi input, output, lỗi và ví dụ tương ứng |
| Code ví dụ từng function cho nhóm khác làm theo | slide 33–39 · `mcp-academic/examples/` (server S1–S11, client C1–C5) | chạy: `cd mcp-academic && npm install && npm run examples` (không cần API key) |
| **(ipynb, data) ví dụ từng Method với từng bộ tham số** | code: `mcp-academic/examples/` · kết quả chạy thật: [`frozen/examples-output/`](frozen/examples-output/) · data: `mcp-academic/data/sample/` | mỗi ví dụ gọi method với tham số hợp lệ / biên / sai; file `.log` và `.json` ghi input + output thật của từng lần gọi. Thầy cho phép nộp code thay notebook |
| pptx 30+ slide | [`MCP-TS-SDK-phase1.pptx`](MCP-TS-SDK-phase1.pptx) | 46 slide, có speaker notes |
| txt 10–20 câu trắc nghiệm | [`quiz-draft.txt`](quiz-draft.txt) | 20 câu, có đáp án |
| ~~Bộ câu hỏi tình huống~~ | — | thầy đã bỏ |

Kịch bản thuyết trình và phân công người nói: [`docs/phase1-presentation-script.md`](../docs/phase1-presentation-script.md).

## Tạo gói nộp

```bash
bash build-submission.sh
```

→ **`phase1/submission/`** và **`phase1/submission.zip`** (code, tài liệu, dữ liệu lấy từ tag `phase1-final`). `submission/STATUS.txt` liệt kê từng mục. Script không bao giờ đưa file `.env` (API key) vào gói.

## File trong thư mục này

| File | Là gì |
| --- | --- |
| `requirement.md` | Đề bài Lần 1 |
| `MCP-TS-SDK-phase1.pptx` | Slide nộp |
| `quiz-draft.txt` | 20 câu trắc nghiệm nộp |
| `slides-content.md` | Nội dung nháp ban đầu của slide |
| `frozen/examples-output/` | Kết quả chạy `npm run examples` (16 ví dụ) tại thời điểm đóng tag `phase1-final` |
| `submission/`, `submission.zip` | Gói nộp — **tự sinh**, không sửa tay |
