# Khoa — Phase 2

Bộ dùng chung hiện tại có **15 câu K01–K15 trên dữ liệu main `2c4110a`**. Chín câu finance K16–K24 được chuyển sang `finance-pending.csv`, đánh dấu **provisional**, chờ PR #2 rebase/merge và tính lại từ dataset chung. Không dùng kết quả hai snapshot làm một benchmark trên main.

## Tệp nộp

| Tệp | Nội dung |
| --- | --- |
| `test-cases.csv` | 15 câu tiếng Anh; giống hệt `phase2/test-cases.csv`, để chuyển vào benchmark chung |
| `finance-pending.csv` | 9 câu finance provisional; chưa chuyển vào benchmark |
| `test-reference.xlsx` | 21 sheet; Answers và Manual có cột scope main/provisional |
| `manual-checks.md` | Phép tính từng bước, lý do cảnh báo và đối chiếu câu trả lời |
| `check-stdio.jsonl`, `check-http.jsonl`, `gemini-stdio.jsonl` | Ba lượt đo mới trên cùng 15 câu main |
| `comparison.csv` | Kết quả lấy từ ba log mới |
| `configs/` | Academic + utility, không có finance hay cwd ngoài repo |
| `historical/` | Log 24 câu, cấu hình và bảng so sánh cũ; giữ nguyên để truy vết hai snapshot |
| `MCP-TS-SDK-phase2.pptx` | 31 slide; finance ghi provisional, bảng kết quả dùng lượt đo mới |
| `MCP-TS-SDK-phase2-script.docx` | Lời thuyết trình tiếng Anh khớp từng slide và FAQ |
| `questions-phase2.txt` | 20 câu trắc nghiệm; đã trộn lựa chọn, 5 đáp án mỗi chữ A/B/C/D |

Runner được commit tại `mcp-academic/scripts/run-khoa-cases.ts`. Không sửa code server, dữ liệu, Phase 1 hay `demo/benchmark.ts` của các bạn khác.

## Chạy lại bằng một lệnh

Cài dependency theo `mcp-academic/docs/setup-guide.md` (`npm ci`), dùng Node ≥20.12 và cấu hình `GEMINI_API_KEY` trong `.env` được Git ignore. Từ `mcp-academic/`:

```powershell
npx tsx scripts/run-khoa-cases.ts --suite
```

Lệnh đọc trực tiếp `phase2/test-cases.csv`, chạy MCP stdio, tự mở/đóng HTTP academic cổng 3001 và utility 3002, rồi chạy Gemini stdio. Log được lưu vào thư mục mới `outputs/khoa/<timestamp>/`, đường dẫn được in cuối lệnh. Mỗi lượt có JSONL đầy đủ và `comparison.csv`; không ghi đè bằng chứng đã có. Dừng các server đang chiếm 3001/3002 trước khi chạy suite.

Các chế độ riêng:

```powershell
npx tsx scripts/run-khoa-cases.ts --dry-run
npx tsx scripts/run-khoa-cases.ts --only K07,K08,K12
npx tsx scripts/run-khoa-cases.ts --llm
```

`--config <file>` chọn cấu hình khác; `--start-http` tự khởi động HTTP cho lượt chạy riêng; `--out <folder>` chọn thư mục log mới; `--pace-ms` chỉnh thời gian nghỉ giữa câu khi gọi LLM. Runner từ chối CSV provisional, ID trùng/sai cấu trúc và công cụ thay đổi dữ liệu. Không cần checkout finance hay thư mục `_khoa-rebuild` để chạy bộ hiện tại.

Log giữ hash CSV, runner, cấu hình, các CSV/quy tắc nguồn, commit checkout, tool/args, structured result đầy đủ, câu trả lời, thời gian, token và số lần thử API. Fallback bị tắt, hội thoại mới mỗi câu. `answerScreenPass` chỉ kiểm tra sự xuất hiện của giá trị; không thay cho đọc nội dung. Lượt chạy lỗi/chưa đủ câu có `complete: false` hoặc lỗi tương ứng và exit code khác 0.

## Kết quả mới ngày 18-10-2026

| Lượt chạy | Số câu | Qua kiểm tra | Lỗi | Median mỗi câu |
| --- | --- | --- | --- | --- |
| MCP stdio | 15 | 15 | 0 | 3 ms |
| MCP HTTP | 15 | 15 | 0 | 8 ms |
| Gemini stdio | 15 | 15 | 0 | 2.187 s |

Gemini `gemini-3.5-flash-lite`, temperature 0.2, maxToolRounds 8. Token vào/ra **111,391 / 2,458**, số lần thử API bổ sung: 0. Nghỉ 9 giây giữa câu, nằm ngoài thời gian từng câu. Đây là một lượt đo mỗi cấu hình; không suy ra transport hay model luôn tốt hơn.

Các con số **24/24**, median 2.8515 s và token 237,665/3,692 chỉ thuộc `historical/`, không còn là kết quả bộ dùng chung hiện tại. Không sửa log lịch sử để biến thành lượt đo 15 câu.

## Những phần đã đối chiếu

- **K07:** 15 buổi, vắng các tuần 7/9/13. `3/15 = 20%`; điều kiện cấm là `>20%`, nên không cấm thi.
- **K08:** 15 buổi, vắng các tuần 2/4/13/14. `4/15 ≈ 26.7% >20%`, nên cấm thi. Late/excused không tính là absent.
- **K12:** IT01 có 10 sinh viên, hai em 2201005 và 2201010 bị cảnh báo. GPA lần lượt 0.63 và 0.38; section vượt ngưỡng lần lượt SEC014/029/037 và SEC029. Conduct 50/60 không tạo lý do rèn luyện kém vì ngưỡng là `<50`.
- **K06:** 30 lượt học hợp lệ, tổng điểm môn đã làm tròn 220.5; `ROUND(220.5/30,1)=7.4`; 27 đạt nên `27/30=90%`.
- **K15:** GPA `(3×0+2×1+3×1)/8=0.63`, vắng `14/45=31.1%`, đủ ba section bị cấm, conduct 50 là Average. Đọc lại câu tư vấn để kiểm tra các hạn chế thi không bị bỏ sót.

Excel có **29 chỉ số nguồn cho main**, **26 chỉ số provisional finance**. Manual có 35 phép tính/kiểm tra main và 27 provisional; tổng 62 kết quả khớp đối chiếu. Công thức nguồn, biên vắng và số trung gian được kiểm tra từ CSV; workbook được tính lại và quét lỗi bằng Artifact Tool. Nội dung log hiện tại và bảng lý do được đối chiếu riêng; không đồng nhất điểm tự động với độ đúng toàn bộ câu trả lời.

## Cải tiến cách diễn đạt

Trong lượt main-only đầu, K12 gọi tỷ lệ vắng cao nhất của một section là overall, và K06 gắn đơn vị students cho số lượt học. Đã làm rõ hai nghĩa này trong systemPrompt của cấu hình Khoa rồi chạy lại đủ suite. Lượt cuối ghi đúng maximum section absence rate và graded enrolments. Log/cấu hình trước sửa nằm ở `historical/main-before-clarification/`; không sửa nội dung các log đó. Đây là quan sát trước/sau cho lượt đo này, không phải khẳng định prompt luôn sửa được mọi lỗi.

## Finance chờ ghép dữ liệu

Các số cũ dùng PR #2 `530d5da`, có T001/conduct khác main. Các sheet F_*, Tuition, Payroll, Scholarships và phần tính finance đều ghi provisional. Conduct 92 ở K10 không được dùng chung với conduct 80 trong kỳ vọng finance cũ như cùng một dataset.

Sau khi PR #2 được rebase và merge:

1. Lấy commit main chung đã có finance.
2. Tính lại K16–K24 từ CSV chung; đổi Excel F_* sang nguồn main và đối chiếu GPA/conduct/section với học vụ.
3. Cập nhật trạng thái, đáp án và ô Excel của các câu finance rồi mới thêm lại vào `phase2/test-cases.csv` và bản trong thư mục Khoa.
4. Bật finance trong cấu hình với đường dẫn mặc định trong repo, chạy lại toàn bộ suite và cập nhật slide/Word/bảng so sánh bằng số đo mới.

Nguồn phần chung bài thuyết trình: `phase2/improvements.md`, `mcp-academic/docs/model-observations.md`, `model-comparison.md`, `experiments.md` và log của Hoàng. So sánh model/tham số của nhóm được phân biệt với lượt đo mới của Khoa.

Nộp qua PR, không đẩy trực tiếp vào main. Drive làm sau theo yêu cầu; không có video. Tiến/Hoàng chuyển 15 ca hiện tại vào `demo/benchmark.ts` theo phân công.
