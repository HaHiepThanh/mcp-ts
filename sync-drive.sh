#!/usr/bin/env bash
# One-way push of the code from this Mac to Google Drive: MCP-TS-Seminar/code/.
# - Never pushed: node_modules, .env (API keys), .git, source/ (upstream SDK clone).
# - --delete applies ONLY inside code/ — the team's working folders (team/...) are never touched.
# Usage: bash sync-drive.sh            (sync)
#        bash sync-drive.sh --dry-run  (preview changes)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
DRIVE_BASE=$(ls -d "$HOME"/Library/CloudStorage/GoogleDrive-*/"My Drive" 2>/dev/null | head -1)
if [[ -z "$DRIVE_BASE" ]]; then
    echo "Google Drive for Desktop not found under ~/Library/CloudStorage" >&2
    exit 1
fi

DEST="$DRIVE_BASE/MCP-TS-Seminar"
mkdir -p "$DEST/code" "$DEST/team/data" "$DEST/team/slides" "$DEST/team/quiz" "$DEST/team/video"

rsync -a --delete "$@" \
    --exclude 'node_modules/' \
    --include '.env.example' --exclude '.env' --exclude '.env.*' \
    --exclude '.git/' --exclude '.DS_Store' \
    --exclude 'source/' \
    "$ROOT/" "$DEST/code/"

if [[ " $* " == *" --dry-run "* || " $* " == *" -n "* ]]; then
    echo "(dry-run) Nothing written to Drive — drop --dry-run to sync"
else
    echo "Synced → $DEST/code"
fi
