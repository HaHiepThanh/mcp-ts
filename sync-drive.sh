#!/usr/bin/env bash
# Đẩy code từ máy lên Google Drive (một chiều) vào MCP-TS-Seminar/code/.
# - Không đẩy: node_modules, .env (API key), .git, source/ (bản clone SDK).
# - --delete CHỈ áp dụng trong code/ — các thư mục làm việc của nhóm (data, slides, ...) không bị đụng tới.
# Dùng: bash sync-drive.sh          (chạy thật)
#       bash sync-drive.sh --dry-run (xem trước sẽ đổi gì)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
DRIVE_BASE=$(ls -d "$HOME"/Library/CloudStorage/GoogleDrive-*/"My Drive" 2>/dev/null | head -1)
if [[ -z "$DRIVE_BASE" ]]; then
    echo "Không tìm thấy Google Drive for Desktop trong ~/Library/CloudStorage" >&2
    exit 1
fi

DEST="$DRIVE_BASE/MCP-TS-Seminar"
mkdir -p "$DEST/code" "$DEST/nhom/data" "$DEST/nhom/slides" "$DEST/nhom/trac-nghiem" "$DEST/nhom/video"

rsync -a --delete "$@" \
    --exclude 'node_modules/' \
    --include '.env.example' --exclude '.env' --exclude '.env.*' \
    --exclude '.git/' --exclude '.DS_Store' \
    --exclude 'source/' \
    "$ROOT/" "$DEST/code/"

if [[ " $* " == *" --dry-run "* || " $* " == *" -n "* ]]; then
    echo "(dry-run) Chưa ghi gì vào Drive — bỏ --dry-run để đồng bộ thật"
else
    echo "Đã đồng bộ → $DEST/code"
fi
