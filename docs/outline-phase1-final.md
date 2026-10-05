# Outline slide Phase 1 — bản chốt (37 slide · 30 phút)

> **Đọc trước khi làm slide.** File này thay cho `outline.md` cũ. Bản cũ (26 slide) chỉ nói lý thuyết chung,
> chưa có gì về project của nhóm, nên chưa đạt 6 yêu cầu của thầy. Bản này giữ lại phần hay của bản cũ
> rồi bổ sung đúng những gì thầy chấm.
>
> Outline chia theo **5 khối nội dung**, không chia theo người. Nhóm trưởng sẽ phân ai nói khối nào sau.
> Cột cuối mỗi bảng ghi **lấy nội dung ở đâu**, nên người làm slide không phải tự nghĩ ra nội dung.
>
> **Nguồn nội dung** (đường dẫn tính từ thư mục `mcp-academic/`, trừ khi ghi khác):
> - `phase1/slides-content.md` — chữ cho từng slide, **đã viết sẵn bằng tiếng Anh, cứ chép dùng**
> - `docs/architecture.md` — 9 sơ đồ Mermaid (dán vào <https://mermaid.live> → Export PNG)
> - `docs/method-reference.md` — bảng Input/Output của 13 tool
> - `docs/results.md`, `docs/model-comparison.md`, `docs/model-observations.md` — số liệu đo thật
> - `phase1/frozen/examples-output/*.log` — kết quả chạy thật, chụp màn hình làm bằng chứng
>
> **Quy định chung:** slide **tiếng Anh** (chỉ tên người được để tiếng Việt) · tối đa 6 dòng chữ mỗi slide ·
> cùng 1 template · mọi con số phải lấy từ tài liệu trên, **không được tự bịa**.

## Đối chiếu 6 yêu cầu của thầy → slide nào

| Thầy yêu cầu | Slide |
| --- | --- |
| Mô tả bài toán | 15 – 18 |
| Mô tả giải thuật | 19 – 22 |
| Nêu lưu đồ xử lý | 20, 21, 22 (3 lưu đồ) |
| Mô tả thư viện sử dụng | 23 – 24 |
| Chi tiết Input – Output của từng Function | 25 – 26 |
| Code ví dụ từng Function cho nhóm khác làm theo | 27 – 31 |

Slide 1 – 14 là nền tảng để các nhóm khác hiểu được, không nằm trong 6 mục nhưng cần có.

---

## KHỐI 1 — Nền tảng: LLM, Data, Tool (slide 1–14 · 6 phút)

Lấy lại từ pptx cũ, **nén 26 slide xuống 14**. Cột cuối ghi rõ slide cũ nào ghép vào đâu.

| # | Tiêu đề slide | Nội dung | Lấy từ |
| --- | --- | --- | --- |
| 1 | Title | Tên đề tài **MCP.2502 — MCP TypeScript SDK**, tên 6 thành viên, lớp, ngày | slide cũ 1, sửa lại tiêu đề |
| 2 | Agenda | 6 mục của thầy + Demo | mới |
| 3 | What is an LLM? | Hiểu và sinh văn bản, học từ dữ liệu | slide cũ 3 + 4 **gộp** |
| 4 | How does an LLM work? | Input → Tokens → dự đoán token tiếp theo → Output | slide cũ 5 + 6 **gộp** |
| 5 | LLM as the brain of an agent | Hiểu → suy nghĩ → chọn hành động → trả lời | slide cũ 8 |
| 6 | Limits of an LLM | Không có dữ liệu riêng, không có dữ liệu thời gian thực, không tự hành động được | slide cũ 9 |
| 7 | Data = what the AI knows | Nguồn dữ liệu: file, database, API | slide cũ 10 + 11 **gộp** |
| 8 | Tool = what the AI can do | Tool là một hành động AI gọi được | slide cũ 14 + 15 **gộp** |
| 9 | How an LLM uses a tool | User → LLM → chọn tool → chạy tool → kết quả → trả lời | slide cũ 16 |
| 10 | LLM + Data + Tool | THINK / KNOW / ACT | slide cũ 18 |
| 11 | **The problem: M × N** | M ứng dụng × N dịch vụ = M×N đoạn tích hợp. **Sửa lại slide cũ 19 và 21**: vẽ 3 ứng dụng nối tới 3 dịch vụ = 9 đường | slide cũ 19 + 21, vẽ lại |
| 12 | **MCP: M + N** | Một chuẩn chung. Mỗi dịch vụ viết **1** server, mỗi ứng dụng cần **1** client → còn M+N. Ví von **USB‑C cho AI** | slide cũ 20 + 22, vẽ lại · `docs/architecture.md` §1 |
| 13 | Host · Client · Server | **Host** = ứng dụng người dùng nói chuyện, host giữ LLM · **Client** = 1 kết nối tới 1 server · **Server** = cung cấp tool. **Nhấn mạnh: LLM chỉ *đề nghị* gọi tool, host mới là bên thực thi** | slide cũ 23, bổ sung · `architecture.md` §2 |
| 14 | Tools · Resources · Prompts | Tool do **model** chọn · Resource do **ứng dụng/người dùng** gắn vào · Prompt do **người dùng** chọn như lệnh gạch chéo | slide cũ 24, bổ sung ai điều khiển cái gì |

**Bỏ hẳn:** slide cũ 2 (agenda cũ), 7 (Transformer/Attention — ngoài phạm vi đề), 12 (ví dụ doanh số), 13, 17 (ví dụ thời tiết — thay bằng ví dụ thật của nhóm), 25, 26 (chuyển về cuối bài).

---

## KHỐI 2 — Mô tả bài toán (slide 15–18 · 4 phút)

> **Yêu cầu 1** của thầy. Từ đây trở đi **nói về project của nhóm**, không nói chung chung nữa.

| # | Tiêu đề | Nội dung bắt buộc có | Nguồn |
| --- | --- | --- | --- |
| 15 | Our problem: academic records | Cần hỏi điểm sinh viên bằng tiếng tự nhiên: "GPA của sinh viên 2201010 là bao nhiêu?". LLM không có dữ liệu trường → phải nối qua MCP. Nêu **3 ràng buộc**: số liệu phải chính xác tuyệt đối, sửa điểm phải có người duyệt, đổi LLM không được sửa server | `phase1/slides-content.md` mục 7 |
| 16 | Our data | **40 sinh viên · 10 môn · 261 dòng điểm · 4 lớp**, định dạng CSV. Có **7 dòng sai cố ý** (điểm 11.5, thiếu điểm, mã sinh viên lạ, điểm âm, trùng dòng) để chứng minh phần kiểm tra dữ liệu | `data/sample/README_data.md` |
| 17 | Grading rules | Tổng = **40% quá trình + 60% cuối kỳ** → chữ **A/B/C/D/F** → **4/3/2/1/0** · GPA theo tín chỉ · học lại lấy điểm cao nhất. Nhấn mạnh: **mọi ngưỡng nằm trong `config/grading.json`, không hard-code** | `config/grading.json` |
| 18 | System overview | **2 MCP server** (`academic` 10 tool / 4 resource / 2 prompt · `utility` 3 tool) · **2 host** (CLI của nhóm, VS Code) · **2 LLM** (Gemini cloud, Qwen3 4B chạy máy) · **2 transport** (stdio, HTTP) | sơ đồ `architecture.md` §2 |

---

## KHỐI 3 — Giải thuật và lưu đồ (slide 19–22 · 5 phút)

> **Yêu cầu 2 và 3** của thầy. Mỗi slide 20–22 **phải có một lưu đồ**. Xuất PNG từ `architecture.md` qua mermaid.live.

| # | Tiêu đề | Nội dung | Lưu đồ |
| --- | --- | --- | --- |
| 19 | Algorithm — the tool-calling loop (các bước) | Viết thành **6 bước đánh số**: ① host gửi câu hỏi + mô tả 13 tool cho LLM ② LLM trả về lời gọi tool ③ host tìm đúng server ④ server chạy, trả kết quả ⑤ kết quả quay lại LLM ⑥ lặp cho tới khi LLM trả lời, tối đa `maxToolRounds` vòng. Tool lỗi thì trả lỗi về cho LLM tự sửa | — |
| 20 | **Flowchart 1 — tool-calling loop** | Lưu đồ của thuật toán vừa nêu | `architecture.md` §4 |
| 21 | **Flowchart 2 — GPA calculation** | Lưu đồ tính điểm. Kèm **ví dụ tính tay**: sinh viên **2201010 → 37/18 = 2.06 → Average** (tự tính lại bằng Excel để chắc chắn) | `architecture.md` §7 |
| 22 | **Flowchart 3 — CSV load & validation** | Lưu đồ đọc và kiểm tra dữ liệu: CSV → kiểm tra → bảng trong bộ nhớ, dòng sai bị loại và ghi vào báo cáo. **Bắt đủ 7/7 dòng sai** | `architecture.md` §8 |

---

## KHỐI 4 — Thư viện, Input/Output, code ví dụ (slide 23–31 · 9 phút)

> **Yêu cầu 4, 5, 6** — phần thầy chấm nặng nhất, và là phần "cho các nhóm khác làm theo".

### Thư viện sử dụng (yêu cầu 4)

| # | Tiêu đề | Nội dung |
| --- | --- | --- |
| 23 | Libraries we use | Bảng: `@modelcontextprotocol/server` 2.0 (viết server) · `@modelcontextprotocol/client` 2.0 (viết client) · `@modelcontextprotocol/node` (chạy stdio/HTTP) · `zod` 4 (khai báo kiểu tham số) · `@google/genai` (Gemini) · `openai` 7 (gọi Qwen qua Ollama) · `hono` (web server) · `tsx` (chạy TypeScript trực tiếp). Mỗi dòng ghi **dùng để làm gì**, lấy từ `package.json` |
| 24 | SDK v2 vs v1 | v1 gộp 1 package `@modelcontextprotocol/sdk`; **v2 tách nhiều package**, theo spec 2026‑07‑28 nhưng vẫn phục vụ client 2025. Khai báo kiểu bằng Zod v4 |

### Input – Output của từng method (yêu cầu 5)

| # | Tiêu đề | Nội dung |
| --- | --- | --- |
| 25 | SDK methods — Input / Output | Bảng các method **của SDK**: `new McpServer(info, options)` · `registerTool(name, config, handler)` · `registerResource` · `registerPrompt` · `serveStdio(factory)` · `createMcpHandler` · `new Client(info, options)` · `client.callTool(...)`. Mỗi dòng: **tham số vào → trả về gì** |
| 26 | Our 13 tools — Input / Output | Bảng 13 tool của nhóm: tên · tham số vào · kết quả ra. Nếu chật thì tách làm 2 slide (10 tool `academic`, 3 tool `utility`) · **chép thẳng từ `docs/method-reference.md`** |

### Code ví dụ (yêu cầu 6)

> Mỗi slide: **ảnh chụp code** (nền sáng, cỡ chữ ≥ 16) + bên dưới là **kết quả chạy thật**.
> Lấy code từ `src/server/...`, lấy kết quả từ `phase1/frozen/examples-output/*.log`.

| # | Tiêu đề | Code lấy ở đâu | Phải chỉ ra điều gì |
| --- | --- | --- | --- |
| 27 | Example 1 — create & serve a server | `src/server/academic/server.ts` + `main.ts` | Chỉ cần vài dòng là chạy được server |
| 28 | Example 2 — `registerTool` | `src/server/academic/tools.ts:126` (`calculate_gpa`) | **Tách 2 phần: phần khai báo LLM đọc được (description, inputSchema, outputSchema) và phần hàm xử lý LLM không thấy.** Nhấn mạnh: số liệu do code tính, LLM không tự tính |
| 29 | Example 2b — parameter sets | `examples/server/s2-*.ts` | **Thầy yêu cầu "bộ tham số"**: cùng 1 tool chạy 4 bộ — hợp lệ · có `semester` · sinh viên không tồn tại (trả `isError`) · sai kiểu (SDK chặn trước khi vào hàm). Kèm 4 kết quả thật |
| 30 | Example 3 — resource & prompt | `resources.ts`, `prompts.ts` | `academic://students/{student_id}` có gợi ý giá trị; prompt thiếu tham số → lỗi `-32602` |
| 31 | Example 4 — client calls the server | `examples/client/c1-*.ts` | Phía client: tạo Client → connect → `callTool` → đọc kết quả |

---

## KHỐI 5 — Demo, kết quả, kết luận (slide 32–37 · 6 phút)

| # | Tiêu đề | Nội dung |
| --- | --- | --- |
| 32 | **LIVE DEMO** (6 phút) | Chạy theo đúng `docs/demo-script.md`. Slide chỉ ghi 4 bước sẽ demo, để lỡ máy hỏng còn nói được. **Phải có video dự phòng** |
| 33 | Configuration is all a host needs | Đặt cạnh nhau `config/host.json` và `.vscode/mcp.json` — **cùng một server, 2 host, không sửa dòng code nào** |
| 34 | Results: two LLMs, same servers | 11 câu hỏi × 2 lần chạy, đáp án chuẩn lấy từ chính tool. **Gemini 3.5 Flash‑Lite 100% · 2.7 s** · **Qwen3 4B Instruct 100% · 2.1 s** · **Qwen3 4B Thinking 100% · 24.4 s**. LLM chiếm ~99% thời gian, gọi tool chỉ 2–40 ms |
| 35 | Lessons learned | Thiết kế tool (tên, mô tả, schema) quan trọng hơn model to hay nhỏ · hỏi xác nhận đã bắt được một lỗi thật của LLM (nó tự điền `process_score: 0`) · bản "thinking" chậm gấp 10 lần mà không chính xác hơn |
| 36 | Summary | MCP tách **"có dữ liệu và công cụ gì"** (server) khỏi **"ai suy luận"** (host + LLM) · SDK v2: API nhỏ, 2 phiên bản giao thức, 2 transport. Nhắc lại THINK / KNOW / ACT / CONNECT (slide cũ 26) |
| 37 | References & Q&A | modelcontextprotocol.io/specification/2026-07-28 · github.com/modelcontextprotocol/typescript-sdk · link repo của nhóm |

---

## Thời lượng (30 phút)

| Khối | Slide | Phút |
| --- | --- | --- |
| 1 · Nền tảng LLM / Data / Tool / MCP | 1–14 | 6 |
| 2 · Mô tả bài toán | 15–18 | 4 |
| 3 · Giải thuật + lưu đồ | 19–22 | 5 |
| 4 · Thư viện + I/O + code ví dụ | 23–31 | 9 |
| 5 · Demo + kết quả + kết luận | 32–37 | 6 |

Chia người nói theo khối, một khối một người là gọn nhất (khối 4 nặng nhất nên giao cho bạn nắm code rõ nhất,
khối 5 nên là người chạy demo). Ai nói khối nào cũng **tự bấm giờ nói thử một lần** trước buổi tổng duyệt;
quá giờ thì cắt bớt chữ trên slide, không nói nhanh hơn.

## Thứ tự làm việc

1. **Dựng khung pptx trước**: tạo đủ 37 slide trống, đúng tiêu đề, cùng template, đánh số trang → gửi nhóm xem bố cục.
2. **Xuất hình trước khi điền chữ**: 3 lưu đồ (mermaid.live → PNG), ảnh chụp code, ảnh chụp log.
3. **Điền chữ** theo cột "Nội dung" ở trên, chép từ `phase1/slides-content.md`.
4. **Người nắm code rà lại** số liệu và thuật ngữ ở khối 2, 3, 4.
5. Nộp về Drive `MCP-TS-Seminar/team/slides/MCP-TS-SDK-phase1.pptx` rồi báo nhóm trưởng chạy `bash build-submission.sh`.

## Checklist trước khi nộp pptx

- [ ] **≥ 30 slide** (bản này 37)
- [ ] Có **đủ 3 lưu đồ** ở slide 20, 21, 22 (yêu cầu riêng của thầy)
- [ ] Có **bảng Input/Output** ở slide 25 và 26
- [ ] Có **≥ 4 ảnh chụp code** kèm kết quả chạy thật ở slide 27–31
- [ ] Có **bộ tham số** (ít nhất 4 bộ cho 1 tool) ở slide 29
- [ ] Mọi slide **tiếng Anh**, tối đa 6 dòng chữ, cùng template
- [ ] Mọi con số khớp với `docs/results.md` và `docs/model-comparison.md`
- [ ] **Không có ảnh nào lộ API key** (che dòng `GEMINI_API_KEY` khi chụp màn hình)
- [ ] Tên 6 thành viên đầy đủ ở slide 1
