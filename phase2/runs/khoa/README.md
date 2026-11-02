# Khoa — Phase 2

Bộ hiện tại có **24 câu K01–K24 trên cùng main `18f3818`**, sau khi finance PR #2 được merge ngày 02-11-2026. Toàn bộ đáp án finance đã tính lại từ dữ liệu chung. Hai bản `test-cases.csv` giống hệt nhau và giữ đúng 5 cột trong TASKS.md. Tiến/Hoàng có thể dùng bộ này để bổ sung vào `demo/benchmark.ts`.

## Tệp nộp

| Tệp | Nội dung |
| --- | --- |
| `test-cases.csv` | 24 câu tiếng Anh, tham số, kỳ vọng và ô Excel đối chiếu |
| `test-reference.xlsx` | 18 sheet; 55 chỉ số nguồn và 62 phép kiểm tra Manual |
| `manual-checks.md` | Phép tính từng câu, bảng ứng viên/lương, đối chiếu nội dung Gemini |
| `reference-manifest.json` | Commit chung, nguồn và hash CSV/quy tắc |
| `check-stdio.jsonl`, `check-http.jsonl`, `gemini-stdio.jsonl` | Ba lượt đo mới trên cùng 24 câu |
| `comparison.csv` | Số đo lấy từ ba log mới |
| `configs/` | Cấu hình academic + utility + finance từ checkout hiện tại |
| `MCP-TS-SDK-phase2.pptx` | 31 slide tiếng Anh; số liệu và giới hạn khớp log mới |
| `MCP-TS-SDK-phase2-script.docx` | Lời thuyết trình tiếng Anh khớp từng slide, kèm FAQ |
| `questions-phase2.txt` | 20 câu; 5 đáp án mỗi chữ A/B/C/D, không theo chu kỳ |
| `historical/` | Bằng chứng cũ, giữ nguyên log và cấu hình từng lượt |

## Chạy lại bằng một lệnh

Cài dependency theo `mcp-academic/docs/setup-guide.md` bằng `npm ci`, dùng Node ≥20.12. Đặt `GEMINI_API_KEY` trong `.env` được Git ignore. Từ `mcp-academic/`:

```powershell
npx tsx scripts/run-khoa-cases.ts --suite
```

Runner đọc trực tiếp `phase2/test-cases.csv`, chạy MCP stdio, tự mở/đóng HTTP academic 3001, utility 3002, finance 3003, rồi chạy Gemini stdio. Dừng các server đang chiếm ba cổng này trước khi chạy suite. Không cần checkout hay `cwd` ngoài repo. Log đi vào thư mục mới `outputs/khoa/<timestamp>/`, không ghi đè bằng chứng đã lưu.

Các chế độ riêng:

```powershell
npx tsx scripts/run-khoa-cases.ts --dry-run
npx tsx scripts/run-khoa-cases.ts --only K07,K08,K12
npx tsx scripts/run-khoa-cases.ts --llm
npx tsx scripts/run-khoa-cases.ts --config ../phase2/runs/khoa/configs/host-http.json --start-http
```

`--cases <file>`, `--config <file>`, `--out <folder>` chọn đầu vào và thư mục log mới. `--pace-ms` chỉnh khoảng nghỉ khi gọi model. Ngày tài chính mặc định cố định `2026-11-03`. `--as-of YYYY-MM-DD` đặt ngày cho HTTP được runner tự mở. Nếu đổi ngày, cần đổi cả `mcpServers.finance.env.FINANCE_AS_OF` trong cấu hình stdio cho khớp; cấu hình server tường minh được ưu tiên hơn môi trường của runner. HTTP bên ngoài cần tự đặt `FINANCE_AS_OF` cùng ngày. Metadata giữ cả ngày runner và effectiveConfig để đối chiếu.

Runner từ chối case provisional, ID sai/trùng, CSV sai cấu trúc và tool thay đổi dữ liệu. Log giữ hash CSV, runner, cấu hình, cả CSV/quy tắc học vụ và finance, commit checkout, ngày tài chính, tool/args, structured result đầy đủ, câu trả lời, thời gian, token và số lần thử API. Fallback tắt, hội thoại mới mỗi câu. Lượt lỗi/chưa đủ câu có `complete: false` hoặc lỗi tương ứng và exit code khác 0. `answerScreenPass` chỉ kiểm tra sự xuất hiện của giá trị; phải đọc riêng nội dung câu trả lời.

## Kết quả mới ngày 03-11-2026

| Lượt chạy | Số câu | Qua kiểm tra | Lỗi | Median mỗi câu |
| --- | --- | --- | --- | --- |
| MCP stdio | 24 | 24 | 0 | 4 ms |
| MCP HTTP | 24 | 24 | 0 | 8 ms |
| Gemini stdio | 24 | 24 | 0 | 2.540 s |

Gemini `gemini-3.5-flash-lite`, temperature 0.2, maxToolRounds 8. Token vào/ra **246,402 / 3,632**, số lần thử API bổ sung **0**. Nghỉ 9 giây giữa câu, ngoài thời gian từng câu. Mỗi cấu hình chỉ có một lượt mới; chưa đủ để kết luận transport/model luôn tốt hơn. Số đo Qwen và thí nghiệm của Hoàng/Tiến trên slide được ghi riêng theo nguồn.

## Đối chiếu theo review

- **Một dataset:** K10 và K20 cùng conduct **92**. T001 cùng là **Đỗ Mai My, Professor**, có **9 tiết/tuần**. Workbook finance dùng Teachers/Sections/Conduct chung; đã bỏ ba sheet F_* cũ. `finance-pending.csv` chuyển vào lịch sử, chín câu mới chỉ được khôi phục sau khi tính lại.
- **K07/K08:** vắng 3/15 = 20% chưa cấm thi; 4/15 ≈ 26.7% bị cấm thi. Late/excused không tính absent.
- **K12:** IT01 có 10 sinh viên, hai em 2201005 và 2201010 bị cảnh báo; GPA 0.63/0.38 và các section vượt ngưỡng được ghi cụ thể. Conduct 50/60 không tạo lý do rèn luyện kém vì ngưỡng là `<50`.
- **K21:** 5 ứng viên SCH02 đủ điều kiện, đứng đầu **2201019**, GPA 4.00, conduct 95; không đồng nhất số ứng viên với 4 suất học bổng.
- **K22:** T001 có 36 tiết/tháng, 12 tiết vượt định mức, bonus **1,500,000 VND**, net **24,372,000 VND**.
- **K23:** khoa IT có 10 giảng viên, 72 tiết, tổng net **126,949,000 VND**.

**Khoa đã tự xem sheet Manual và hiểu K07/K08, K12**, theo xác nhận của người dùng ngày 03-11-2026. Đây là xác nhận cho các mục đã xem; không ghi rằng Khoa tự chạy lượt finance mới. Phép tính finance mới được tính lại từ CSV, đối chiếu workbook và kết quả MCP. Workbook được tính lại, quét lỗi bằng Artifact Tool; đã thử đổi conduct 2201001 để xác minh cả đáp án học vụ và finance cùng cập nhật rồi khôi phục đầu vào. Không tuyên bố đã thao tác trực tiếp trong Microsoft Excel.

Đã đọc đủ 24 câu trả lời Gemini, gồm lý do cảnh báo, tư vấn và finance. K06 ghi đúng graded enrolments; K12 phân biệt maximum section absence rate. K15 nói rõ 31.1% là tỷ lệ vắng dù tiêu đề dùng cụm “Overall Attendance Rate”; khi thuyết trình dùng absence rate. Chi tiết ở `manual-checks.md`.

## Bằng chứng cũ

- `historical/` gốc: 24 câu trộn main `2c4110a` và finance `530d5da`, chỉ mô tả hai snapshot cũ.
- `historical/main-before-clarification/`: lượt 15 câu trước khi làm rõ cách diễn đạt.
- `historical/main-before-finance-integration/`: lượt 15 câu sau làm rõ, cùng CSV và kỳ vọng finance provisional trước khi ghép dữ liệu.

Không chỉnh nội dung các JSONL lịch sử để biến chúng thành lượt đo mới. Nguồn phần chung bài thuyết trình: `phase2/improvements.md`, `mcp-academic/docs/model-observations.md`, `model-comparison.md`, `experiments.md` và log Hoàng/Tiến. Không sửa server, generator, dữ liệu hay benchmark của các bạn khác trong phần thay đổi của Khoa.

Nộp qua PR, không đẩy trực tiếp main. Drive làm sau; không có video theo phạm vi đã thống nhất.
