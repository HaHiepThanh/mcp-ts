# Khoa — Phase 2

Bộ nộp làm lại theo phạm vi của Khoa. Không có video. Không sửa code hay dữ liệu của Phú, Hoàng và Tiến.

## Mở tệp nào

| Tệp | Nội dung |
| --- | --- |
| `MCP-TS-SDK-phase2.pptx` | 31 slide thuyết trình toàn bộ Phase 2 bằng tiếng Anh |
| `MCP-TS-SDK-phase2-script.docx` | Lời nói tiếng Anh dễ hiểu theo từng slide và câu hỏi thường gặp |
| `test-cases.csv` | 24 câu kiểm thử, đúng 5 cột yêu cầu |
| `test-reference.xlsx` | 55 đáp án bằng công thức Excel từ CSV, có phép tính trung gian |
| `questions-phase2.txt` | 20 câu trắc nghiệm và đáp án |
| `check-stdio.jsonl`, `check-http.jsonl` | Log kiểm tra trực tiếp MCP, có kết quả đầy đủ |
| `gemini-stdio.jsonl` | Log chạy Gemini: câu hỏi, tool/args, kết quả, câu trả lời, thời gian, token |
| `comparison.csv` | Bảng so sánh lấy từ log |
| `configs/` | Hai cấu hình được dùng khi đo |

`phase2/test-cases.csv` ở vị trí yêu cầu của đề và bản CSV trong thư mục này có nội dung giống hệt nhau. Tiến/Hoàng dùng tệp đó để bổ sung vào benchmark chung; PR này không sửa `demo/benchmark.ts`.

## Tình huống và đáp án

15 câu học vụ/tư vấn và 9 câu tài chính, bao phủ toàn bộ 4 tool giảng viên, 3 tool điểm danh/rèn luyện/cảnh báo và 6 tool đọc finance. Có tham số hợp lệ, ID sai, học kỳ không có dữ liệu và hai biên vắng 3/15, 4/15 buổi.

Trong CSV, `expected_values` chứa đáp án theo từng tool. `note` chứa tham số, nguồn snapshot và ô Excel đối chiếu. `Answers` là trang đầu workbook: cột C tính bằng công thức, D đối chiếu độc lập từ CSV, E kiểm tra khớp. Các trang sau giữ nguồn và bước tính. Có thể dùng workbook để tự kiểm tra từng phép tính trong Excel; không ghi nhận người dùng đã duyệt tay thay họ.

## Chạy đo thật ngày 18 tháng 10 năm 2026

Môi trường Windows, Node.js 24.18.0. Dữ liệu sample giả; ngày tài chính cố định `2026-10-18`.

| Lượt chạy | Số câu | Qua kiểm tra | Lỗi chạy | Median mỗi câu |
| --- | --- | --- | --- | --- |
| MCP stdio | 24 | 24 | 0 | 3.0 ms |
| MCP HTTP | 24 | 24 | 0 | 7.5 ms |
| Gemini stdio | 24 | 24 | 0 | 2,851.5 ms |

Gemini: `gemini-3.5-flash-lite`, temperature 0.2, maxToolRounds 8, hội thoại mới mỗi câu, tắt fallback. Tổng token vào/ra: 237,665/3,692; số lần thử API bổ sung: 3. Có nhịp nghỉ 9 giây giữa câu để phù hợp quota 15 request/phút; nhịp nghỉ đó không nằm trong thời gian từng câu.

Điểm là kiểm tra tool, tham số yêu cầu và giá trị kết quả, không phải thước đo đầy đủ cho độ đúng ngữ nghĩa. Các câu tư vấn và lý do cảnh báo vẫn cần đọc nội dung. Log giữ nguyên cả retry và lỗi nếu có; không tự điền kết quả cho câu chưa chạy.

## Nguồn dùng cho bản trình bày

- Học vụ: `main` tại `2c4110ab6ff60e84e386ace7f0d158bf0ab4a0e2`.
- Finance: PR #2 tại `530d5da97e12a9ecaece0fd4e7066dec8c888621`, chạy từ checkout riêng. **Finance đã được kiểm thử nhưng chưa merge vào main.** HR/conduct của snapshot đó khác main, nên các phép tính finance dùng trọn bộ CSV tương ứng.
- Hoàng: `phase2/runs/hoang/maxToolRounds-*.jsonl`, `temperature-*.jsonl` và `mcp-academic/docs/experiments.md`.
- Nhận xét model: `mcp-academic/docs/model-observations.md` và `model-comparison.md`. Đây là kết quả cũ trên bộ 11 câu và máy khác, được phân biệt trong slide.
- Cải tiến: `phase2/improvements.md`.

## Nhận xét và cải tiến

- Kết quả kiểm tra MCP khớp 55 chỉ số Excel độc lập, gồm cả finance. Cách này giúp phát hiện lỗi nếu tool và oracle của cùng code cùng tính sai.
- HTTP có thêm chi phí trao đổi cục bộ; một lượt đo chưa đủ kết luận transport nào luôn nhanh hơn.
- Lưu toàn bộ structured result; không dùng đoạn preview 400 ký tự để chấm JSON.
- Tắt fallback khi so model, giữ tên model và số lần thử trong log.
- Thí nghiệm mô tả tool ngắn thật chưa được đo; không coi việc đổi system prompt là đổi schema.
- Sau khi merge finance và thống nhất dataset, chạy lại đủ 24 câu trên snapshot chung. Qwen 27 tool cần đo ngân sách context lại; không áp số đo 20 tool cũ cho bản này.

## Chạy lại các câu hỏi

Cài dependency theo `mcp-academic/docs/setup-guide.md` và giữ API key trong `.env` được Git ignore. Với snapshot đang đo, finance chạy từ checkout riêng tại thư mục cùng cấp repo: `_khoa-rebuild/finance/mcp-academic`. Cấu hình stdio ghi đường dẫn làm việc đó; khi finance đã merge, bỏ trường `cwd` của finance để dùng chung app.

Để lấy đúng bản finance đã đo, chạy một lần từ thư mục gốc repo:

```powershell
git clone https://github.com/HaHiepThanh/mcp-ts.git ../_khoa-rebuild/finance
git -C ../_khoa-rebuild/finance checkout 530d5da97e12a9ecaece0fd4e7066dec8c888621
npm --prefix ../_khoa-rebuild/finance/mcp-academic ci
```

Sau đó thử một câu với cấu hình đã lưu:

```powershell
cd mcp-academic
npm run chat -- --config ../phase2/runs/khoa/configs/host-stdio.json --ask "How many sections and weekly teaching periods does T001 have in semester 2024-1?"
```

HTTP cần khởi động academic cổng 3001, utility 3002 từ main và finance 3003 từ snapshot finance, rồi dùng `configs/host-http.json`. Công cụ dựng tệp và file tạm không đưa vào bộ nộp. Các log chứa cấu hình thực, commit nguồn và toàn bộ expected cases để đối chiếu.

Các tệp đã đưa lên GitHub qua PR; chưa upload Google Drive. Không có video theo yêu cầu.
