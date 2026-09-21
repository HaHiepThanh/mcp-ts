# Dùng 2 MCP server trong VS Code (Copilot Chat)

> Tài liệu nội bộ (tiếng Việt). Khi demo, đặt câu hỏi bằng tiếng Anh.

## Điều kiện (làm 1 lần)

| Cần có | Kiểm tra |
| --- | --- |
| VS Code bản mới (máy nhóm trưởng: 1.137) | *Code → About Visual Studio Code* |
| Đăng nhập **GitHub Copilot** (gói Free cũng được) | Biểu tượng Copilot ở thanh trạng thái không báo lỗi |
| Node.js ≥ 20 | Terminal: `node -v` |
| Đã cài thư viện của project | Terminal trong `mcp-academic/`: `npm install` rồi `npm run check:vscode` → 2 dòng ✔ |

Không cần API key nào: trong VS Code, **Copilot đóng vai LLM**, 2 server của nhóm chỉ cung cấp tool/dữ liệu.

## Các bước

1. **Mở đúng thư mục**: *File → Open Folder…* → chọn **`seminar-emt`** (thư mục chứa `.vscode/mcp.json`). Mở `mcp-academic` cũng được — trong đó có một bản `.vscode/mcp.json` riêng.
2. **Bật server**: `Cmd+Shift+P` → gõ **MCP: List Servers** → chọn `academic` → **Start Server**. Lần đầu VS Code hỏi *"Do you trust this MCP server?"* → **Trust**. Làm tương tự với `utility`.
   - Cách khác: mở file `.vscode/mcp.json`, phía trên mỗi server có dòng chữ nhỏ **Start** — bấm vào.
   - Trạng thái đúng: `Running` · academic **10 tools**, utility **3 tools**.
3. **Mở Chat**: `Ctrl+Cmd+I` (hoặc biểu tượng Copilot) → ô chọn chế độ ở dưới khung chat → chọn **Agent**. (Chế độ *Ask/Edit* không gọi được tool MCP.)
4. **Kiểm tra tool**: bấm biểu tượng **🛠 (Configure Tools)** trong khung chat → thấy nhóm `academic` và `utility` được tick.
5. **Hỏi thử**:
   - `Rank the top 3 students of the Business Administration faculty by GPA.`
   → Copilot đề xuất chạy `rank_students` → bấm **Continue/Allow** → kết quả đúng: **Phạm Thị Lan 4.00 · Trần Thu Linh 3.83 · Đặng Văn Nam 3.56**.
   - `Write a performance report for class IT01 and save it as a file named IT01-vscode.` → Copilot gọi tool của **cả 2 server**; file nằm ở `mcp-academic/outputs/reports/`.
   - `Change the final score of student 2201005 in CS202 for semester 2025-1 to 8.` → VS Code hiện **hộp thoại xác nhận của server** (elicitation) → chọn để xác nhận hoặc từ chối.
6. **Prompt của server**: gõ `/` trong khung chat → chọn **`/academic.class_report`** → điền `class_id` (có gợi ý tự động).
7. **Resource**: *Add Context… (📎)* → **MCP Resources** → chọn `academic://rules/grading` hoặc hồ sơ một sinh viên → hỏi câu liên quan.

## Khi có lỗi

| Hiện tượng | Cách xử lý |
| --- | --- |
| Server không chạy / `Error` | `MCP: List Servers` → server → **Show Output** để xem lỗi; chạy `npm run check:vscode` trong terminal |
| `node: command not found` trong Output | Mở VS Code từ Terminal bằng `code ~/repos/2631/emt/seminar-emt` để VS Code nhận đúng PATH |
| Không thấy tool trong chat | Kiểm tra đang ở chế độ **Agent**; bấm 🛠 và tick nhóm tool |
| Sửa code server xong | `MCP: List Servers` → server → **Restart Server** |
| Muốn dừng | `MCP: List Servers` → server → **Stop Server** |

## Điểm nhấn khi thuyết trình

- File `.vscode/mcp.json` và `config/host.json` (host tự viết) **chỉ khác định dạng cấu hình** — cùng một lệnh khởi động server. *"One MCP server, many hosts — no code change."*
- VS Code dùng giao thức nào là do VS Code chọn; server của nhóm phục vụ được cả bản 2025 lẫn 2026-07-28.
