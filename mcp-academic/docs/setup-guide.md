# Hướng dẫn cài đặt & chạy (cho thành viên nhóm)

> Tài liệu nội bộ (tiếng Việt). Làm lần lượt từ trên xuống. Gặp lỗi → xem bảng cuối trang, vẫn không được thì chụp màn hình gửi nhóm trưởng.

## 0. Chọn LLM cho máy của bạn

Project cần **1 LLM** để chat. Có 2 lựa chọn — chọn theo máy:

| Máy của bạn | Chọn | Vì sao |
| --- | --- | --- |
| **RAM ≥ 16 GB** và (Mac chip M1/M2/M3/M4 **hoặc** PC có card NVIDIA ≥ 6 GB VRAM), ổ cứng trống ≥ 6 GB | **A. Qwen chạy local** (+ nên tạo thêm key Gemini để so sánh) | Miễn phí, không giới hạn lượt, không cần mạng |
| RAM **8 GB**, máy cũ, không có GPU rời, hoặc ổ cứng gần đầy | **B. Gemini cloud** (chỉ cần key) | Model local sẽ rất chậm hoặc làm treo máy |
| Không chắc | **B trước**, thử A sau | B luôn chạy được |

Kiểm tra RAM: macOS → *Apple menu → About This Mac*; Windows → *Task Manager → Performance → Memory*.

## 1. Cài công cụ (bắt buộc cho mọi người)

1. **Node.js ≥ 20** (khuyên dùng bản LTS 22 hoặc 24): tải tại <https://nodejs.org>. Kiểm tra: mở Terminal (macOS) / PowerShell (Windows) → `node -v` → phải ra `v20` trở lên.
2. **Git**: macOS có sẵn (`git --version`, nếu hỏi cài Command Line Tools thì đồng ý); Windows tải tại <https://git-scm.com>.
3. **VS Code** (<https://code.visualstudio.com>) — dùng để code và để chạy MCP trong Copilot Chat.

## 2. Lấy code

```bash
git clone https://github.com/HaHiepThanh/mcp-ts.git
cd mcp-ts/mcp-academic
npm install
```

Chạy thử **không cần LLM** (chứng minh SDK và 2 server hoạt động):

```bash
npm run examples
```

Kết quả đúng: dòng cuối `13/13 examples passed` (con số có thể tăng khi nhóm thêm ví dụ).

## 3A. Qwen chạy local (Ollama)

**Tốn:** ~2.5 GB ổ cứng cho model, ~3.3 GB RAM khi chạy. Chỉ chạy khi cần, tắt khi xong.

1. Cài Ollama:
   - macOS: tải app tại <https://ollama.com/download> (hoặc `brew install ollama`)
   - Windows: tải bản cài tại <https://ollama.com/download>
2. Tải model **bản instruct** (không "suy nghĩ", nhanh hơn ~10 lần — bản `qwen3:4b` là bản *thinking*, rất chậm):
   ```bash
   ollama pull qwen3:4b-instruct
   ```
> ⚠️ **Hai loại "server", đừng nhầm:**
> - **Ollama** = server chạy *model Qwen* (cổng 11434) → **bạn phải tự bật** ở bước 3 dưới đây.
> - **MCP server** `academic` + `utility` → **KHÔNG cần bật**: `npm run chat` tự khởi động chúng (stdio). Chỉ bật tay `npm run academic:http` / `utility:http` khi dùng `config/host.http.json`.
>
> Lỗi `Cannot reach http://127.0.0.1:11434/v1 … Is Ollama running?` nghĩa là **chưa chạy `ollama serve`** (hoặc đã tắt cửa sổ đó).

3. **Bật Ollama với ngữ cảnh 8k** — bắt buộc, vì phần mô tả 13 tool đã ~4.8k token, mặc định 4k sẽ cắt mất tool:
   - macOS (Terminal):
     ```bash
     OLLAMA_CONTEXT_LENGTH=8192 OLLAMA_FLASH_ATTENTION=1 OLLAMA_KV_CACHE_TYPE=q8_0 ollama serve
     ```
   - Windows (PowerShell):
     ```powershell
     $env:OLLAMA_CONTEXT_LENGTH="8192"; $env:OLLAMA_FLASH_ATTENTION="1"; $env:OLLAMA_KV_CACHE_TYPE="q8_0"; ollama serve
     ```
   - Nếu app Ollama đã tự chạy ở góc màn hình (biểu tượng con lạc đà) → **Quit** nó trước, rồi chạy lệnh trên (nếu không lệnh sẽ báo cổng 11434 đã bị chiếm).
   - Để cửa sổ này mở trong lúc dùng.
   - Kiểm tra (ở cửa sổ khác): `curl http://127.0.0.1:11434/api/version` → ra `{"version":"..."}` là Ollama đã chạy.
4. Mở **cửa sổ Terminal thứ 2**, trong thư mục `mcp-academic`:
   ```bash
   npm run chat -- --config config/host.qwen.json
   ```
   Hỏi thử: `What is the cumulative GPA of student 2201010, and how is it classified?` → đúng: **2.06, Average**.
5. Kiểm tra RAM: `ollama ps` → cột `SIZE` ≈ 3.3 GB, `CONTEXT` = 8192.
6. **Tắt khi xong** (quan trọng với máy yếu): `Ctrl+C` ở cửa sổ `ollama serve` (model tự giải phóng RAM). Chỉ muốn giải phóng RAM: `ollama stop qwen3:4b-instruct`.
7. Hết chỗ ổ cứng: `ollama rm qwen3:4b-instruct`.

**Máy vẫn quá chậm/đơ?** Tắt bớt Chrome/app nặng. Còn chậm → chuyển sang **mục 3B (Gemini)**. Model nhỏ hơn như `qwen3:1.7b` chạy được nhưng gọi tool kém chính xác — chỉ dùng để thử, **không dùng để đo kết quả**.

## 3B. Gemini cloud (key miễn phí)

1. Vào <https://aistudio.google.com/apikey> → đăng nhập Google → **Create API key** → copy key.
2. Trong thư mục `mcp-academic`, tạo file `.env` từ mẫu:
   - macOS: `cp .env.example .env`
   - Windows: `copy .env.example .env`
3. Mở `.env` bằng VS Code, điền key sau dấu `=`:
   ```
   GEMINI_API_KEY=AIza...key-của-bạn...
   ```
4. Kiểm tra: `npm run doctor` → dòng **Gemini ✅**.
5. Chat: `npm run chat` (mặc định dùng `gemini-3.5-flash-lite`, ~1 giây mỗi lần gọi).

**Quy tắc an toàn — bắt buộc:**
- **Không bao giờ** commit/push `.env`, không gửi key qua chat, không để key lộ trong ảnh chụp slide. (`.gitignore` đã chặn `.env`, nhưng đừng đổi tên file.)
- Mỗi người **dùng key của chính mình**.
- Gói miễn phí có **giới hạn số lượt/phút và mỗi ngày**. Chạy benchmark chỉ với model bạn cần: `npm run compare -- --only gemini-3.5-flash-lite` — **đừng** chạy `npm run compare` toàn bộ nhiều lần (nhóm từng làm hết quota ngày của `gemini-3.8-flash`).

## 4. Chạy MCP server của nhóm

| Việc | Lệnh (trong `mcp-academic/`) |
| --- | --- |
| Kiểm tra môi trường | `npm run doctor` |
| Chạy mọi ví dụ SDK (không cần LLM) | `npm run examples` |
| Chat với Gemini | `npm run chat` |
| Chat với Qwen local | `npm run chat -- --config config/host.qwen.json` |
| Một câu hỏi rồi thoát | `npm run chat -- --ask "câu hỏi"` |
| Server qua HTTP (2 terminal) | `npm run academic:http` · `npm run utility:http` rồi `npm run chat -- --config config/host.http.json` |
| Dùng trong VS Code Copilot | xem `docs/vscode-guide.md` |
| So sánh model | `npm run compare -- --only qwen3-4b-instruct` (hoặc `gemini-3.5-flash-lite`) |
| Kiểm tra kiểu code (trước khi tạo PR) | `npm run typecheck` |

Trong chat: `/help`, `/tools`, `/resources`, `/prompts`, `/prompt academic:class_report class_id=IT01`, `/exit`.
Log mọi lượt chat: `outputs/logs/chat-YYYY-MM-DD.jsonl`.

## 5. Lỗi thường gặp

| Lỗi | Cách xử lý |
| --- | --- |
| `node: command not found` / version < 20 | Cài lại Node LTS, mở Terminal mới |
| `npm install` lỗi quyền (Windows) | Mở PowerShell thường (không cần Admin), đúng thư mục `mcp-academic` |
| `GEMINI_API_KEY is missing` | Chưa có `.env` hoặc sai tên biến; file phải nằm trong `mcp-academic/` |
| `429 … exceeded your current quota` | Hết lượt miễn phí: đợi 1 phút (giới hạn/phút) hoặc sang ngày (giới hạn/ngày); dùng Qwen local |
| `Cannot reach http://127.0.0.1:11434` | Chưa chạy `ollama serve` (bước 3A.3) |
| `Model "qwen3:4b-instruct" not found` | Chưa `ollama pull qwen3:4b-instruct` |
| `address already in use 11434` | App Ollama đang chạy nền → Quit app rồi chạy lại lệnh `ollama serve` |
| Qwen trả lời lung tung, không gọi tool | Quên `OLLAMA_CONTEXT_LENGTH=8192`; kiểm tra `ollama ps` cột CONTEXT |
| Máy nóng/treo khi chạy Qwen | `Ctrl+C` tắt `ollama serve`, chuyển sang Gemini |
