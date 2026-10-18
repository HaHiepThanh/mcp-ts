# Lần 2 (Phase 2) — nộp gì cho thầy

Thầy đã xác nhận: Lần 2 **không có Training/Test**. Thay vào đó nhóm **trình diễn cấu hình MCP**: mỗi cấu hình chạy ra kết quả khác nhau và có LOG ghi lại.
Kế hoạch chi tiết: [`PLAN.md`](PLAN.md). Code nằm trên nhánh `phase2/core`.

Tạo gói nộp: `bash build-submission.sh` → **`phase2/submission/`** + **`phase2/submission.zip`**.

## Đối chiếu yêu cầu (`requirement.md`) → file

| Yêu cầu của đề | File | Nội dung |
| --- | --- | --- |
| Các tình huống chạy thử | `mcp-academic/docs/scenarios.md` · `mcp-academic/demo/scenarios.ts` | 24 tình huống, 8 nhóm A–H, đáp án chuẩn lấy từ chính các tool MCP (oracle) |
| Đáp án có đúng không? | [`manual-check.md`](manual-check.md) · `manual_check.py` | Python tính lại độc lập từ CSV; 9/9 giá trị khớp oracle |
| Các bộ tham số | `mcp-academic/config/experiments/E1…E8.json` · `config/host.experiment.json` | 8 thí nghiệm, 27 cấu hình, mỗi thí nghiệm chỉ đổi 1 tham số |
| Kết quả + so sánh + nhận xét | `mcp-academic/docs/experiments.md` | Bảng cho từng thí nghiệm, theo nhóm tình huống, theo từng tình huống, kèm nhận xét |
| (Cải tiến) | [`improvements.md`](improvements.md) | Cải tiến có bằng chứng trước/sau |
| Code + data | `mcp-academic/` (3 server, 22 tool) · `mcp-academic/data/sample/` | `npm run experiment -- E3` chạy lại 1 thí nghiệm |
| LOG | [`runs/E1…E8/`](runs/) | Mỗi lượt chạy là 1 dòng JSONL: câu hỏi, tool gọi + tham số, câu trả lời, từng bước kiểm tra, thời gian, token. Kèm `summary.json`, `config-used.json` |
| pptx 20+ slide | `MCP-TS-SDK-phase2.pptx` | Có note lời thoại |
| txt 10–20 câu trắc nghiệm | `quiz-phase2.txt` | 15 câu, đáp án lấy từ kết quả thí nghiệm |

## Chạy lại các thí nghiệm

```bash
cd mcp-academic
npm install
npm run data:sample                      # sinh lại dữ liệu (seed cố định, ra đúng y hệt)
npm run experiment -- E7                 # không cần LLM (~10 giây)
npm run experiment -- E8                 # không cần LLM (~1 giây)
npm run experiment -- E3                 # cần Ollama + Qwen (xem bên dưới)
npm run experiments:report               # sinh lại docs/experiments.md từ log
python3 ../phase2/manual_check.py        # đối chiếu đáp án độc lập
```

Thí nghiệm có LLM dùng Qwen chạy trên máy qua Ollama (`docs/setup-guide.md`). E6 cần thêm 3 biến thể ngữ cảnh. Các biến thể này dùng chung trọng số với `qwen3:4b-instruct` nên không tốn thêm ổ cứng:

```bash
for n in 4096 8192 16384; do printf 'FROM qwen3:4b-instruct\nPARAMETER num_ctx %s\n' $n > /tmp/Modelfile; ollama create qwen3-4b-ctx$((n/1024))k -f /tmp/Modelfile; done
```

E1 có thêm Gemini, cần `GEMINI_API_KEY` trong `.env`.

## File trong thư mục này

| File | Là gì |
| --- | --- |
| `requirement.md` | Đề bài Lần 2 |
| `PLAN.md` | Kế hoạch đã duyệt |
| `runs/E*/` | LOG của từng thí nghiệm (được commit) |
| `manual-check.md`, `manual_check.py` | Đối chiếu đáp án độc lập |
| `improvements.md` | Cải tiến |
| `quiz-phase2.txt`, `quiz-draft.txt` | Trắc nghiệm (bản chính / bản nháp cũ) |
| `MCP-TS-SDK-phase2.pptx` | Slide |
| `submission/`, `submission.zip` | Gói nộp, **tự sinh** |
