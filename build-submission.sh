#!/usr/bin/env bash
# Assembles what to hand in to the teacher, following phase1/requirement.md and phase2/requirement.md:
#   phase1/submission/  + phase1/submission.zip
#   phase2/submission/  + phase2/submission.zip
# Team files on Google Drive (team/slides/*.pptx, team/quiz/questions*.txt, team/data/*.csv) are picked up
# automatically when they exist; otherwise the drafts in phase1/ and phase2/ are used and flagged.
# Run from anywhere: bash build-submission.sh
# Phase 1 is FROZEN: its code, docs and data come from git tag `phase1-freeze` and its example outputs from
# phase1/frozen/, so phase-2 work never changes the phase-1 package. Only team files (slides, quiz) are refreshed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
APP="$ROOT/mcp-academic"
TEAM=$(ls -d "$HOME"/Library/CloudStorage/GoogleDrive-*/"My Drive"/MCP-TS-Seminar/team 2>/dev/null | head -1 || true)
note() { echo "$1" >> "$2/STATUS.txt"; }

copy_code() { # $1 = destination
    mkdir -p "$1"
    rsync -a --exclude 'node_modules/' --exclude 'outputs/' --include '.env.example' --exclude '.env' --exclude '.env.*' --exclude '.DS_Store' "$APP/" "$1/mcp-academic/"
}

pick_team_file() { # $1 = glob inside team/, $2 = destination dir, $3 = fallback file, $4 = status file dir, $5 = label
    local found=""
    if [[ -n "$TEAM" ]]; then found=$(ls -t $TEAM/$1 2>/dev/null | head -1 || true); fi
    mkdir -p "$2"
    if [[ -n "$found" ]]; then
        cp "$found" "$2/"
        note "✅ $5: $(basename "$found") (from Drive team/)" "$4"
    elif [[ -n "$3" ]]; then
        cp "$3" "$2/"
        note "⚠️  $5: DRAFT $(basename "$3") — team version not on Drive yet" "$4"
    else
        note "❌ $5: missing — expected on Drive team/$1" "$4"
    fi
}

# ── Phase 1 (frozen) ─────────────────────────────────────────────────
P1="$ROOT/phase1/submission"
rm -rf "$P1" "$ROOT/phase1/submission.zip"
mkdir -p "$P1"
: > "$P1/STATUS.txt"
FROZEN=$(mktemp -d)
git -C "$ROOT" archive phase1-freeze mcp-academic | tar -x -C "$FROZEN"
note "🧊 Code, docs and data from git tag phase1-freeze ($(git -C "$ROOT" rev-list -n1 --abbrev-commit phase1-freeze))" "$P1"

pick_team_file 'slides/*phase1*.pptx' "$P1/01-slides" "" "$P1" "Slides (pptx, 30+ slides)"
cp "$ROOT/phase1/slides-content.md" "$P1/01-slides/"
mkdir -p "$P1/02-code"
rsync -a --exclude 'node_modules/' --exclude 'outputs/' "$FROZEN/mcp-academic/" "$P1/02-code/mcp-academic/"
note "✅ Code: 02-code/mcp-academic (TypeScript project, see its README)" "$P1"
mkdir -p "$P1/03-data"
rsync -a "$FROZEN/mcp-academic/data/" "$P1/03-data/"
note "✅ Data: sample dataset (40 students, 10 courses, 7 injected invalid rows)" "$P1"
mkdir -p "$P1/04-examples-per-method"
cp "$ROOT"/phase1/frozen/examples-output/* "$P1/04-examples-per-method/"
note "✅ Examples per method and parameter set: $(ls "$P1/04-examples-per-method" | grep -c '\.json$') JSON + logs (snapshot at freeze)" "$P1"
mkdir -p "$P1/05-docs"
for f in architecture method-reference results demo-script vscode-guide; do cp "$FROZEN/mcp-academic/docs/$f.md" "$P1/05-docs/"; done
note "✅ Docs: problem, algorithm, flowcharts (architecture.md), library + input/output (method-reference.md)" "$P1"
rm -rf "$FROZEN"
pick_team_file 'quiz/questions*phase1*.txt' "$P1/06-quiz" "$ROOT/phase1/quiz-draft.txt" "$P1" "Multiple-choice quiz (10–20 questions)"
cp "$ROOT/phase1/README.md" "$P1/README.md"
(cd "$ROOT/phase1" && zip -qr submission.zip submission)

# ── Phase 2 ──────────────────────────────────────────────────────────
P2="$ROOT/phase2/submission"
rm -rf "$P2" "$ROOT/phase2/submission.zip"
mkdir -p "$P2"
: > "$P2/STATUS.txt"

if [[ -f "$ROOT/phase2/MCP-TS-SDK-phase2.pptx" ]]; then
    mkdir -p "$P2/01-slides"; cp "$ROOT/phase2/MCP-TS-SDK-phase2.pptx" "$P2/01-slides/"
    note "✅ Slides (pptx, 20+ slides): MCP-TS-SDK-phase2.pptx" "$P2"
else
    pick_team_file 'slides/*phase2*.pptx' "$P2/01-slides" "" "$P2" "Slides (pptx, 20+ slides)"
fi
copy_code "$P2/02-code"
note "✅ Code + data: 02-code/mcp-academic (3 MCP servers, 22 tools; data in data/sample)" "$P2"
mkdir -p "$P2/03-configurations/experiments"
cp "$APP"/config/*.json "$P2/03-configurations/"
cp "$APP"/config/experiments/*.json "$P2/03-configurations/experiments/"
cp "$ROOT/.vscode/mcp.json" "$P2/03-configurations/vscode-mcp.json"
note "✅ Parameter sets: 8 experiment files (27 configurations) + $(ls "$P2/03-configurations" | grep -c json) host/server configs" "$P2"
mkdir -p "$P2/04-scenarios"
cp "$APP/demo/scenarios.ts" "$APP/docs/scenarios.md" "$ROOT/phase2/manual-check.md" "$ROOT/phase2/manual_check.py" "$P2/04-scenarios/"
note "✅ Test scenarios: 24 scenarios in 8 groups + independent cross-check of the ground truth" "$P2"
mkdir -p "$P2/05-results"
cp "$APP/docs/experiments.md" "$P2/05-results/"
for e in "$ROOT"/phase2/runs/E*/; do cp "$e/summary.json" "$P2/05-results/$(basename "$e")-summary.json" 2>/dev/null || true; done
note "✅ Results and comparisons: experiments.md + one summary.json per experiment" "$P2"
mkdir -p "$P2/06-logs"
rsync -a --exclude 'README.md' "$ROOT/phase2/runs/" "$P2/06-logs/"
note "✅ Logs: $(cat "$ROOT"/phase2/runs/E*/*.jsonl 2>/dev/null | wc -l | tr -d ' ') logged runs in 06-logs/E*/ (JSONL)" "$P2"
mkdir -p "$P2/07-observations-improvements"
cp "$ROOT/phase2/improvements.md" "$P2/07-observations-improvements/"
note "✅ Observations (in experiments.md) + improvements.md" "$P2"
if [[ -f "$ROOT/phase2/quiz-phase2.txt" ]]; then
    mkdir -p "$P2/08-quiz"; cp "$ROOT/phase2/quiz-phase2.txt" "$P2/08-quiz/"
    note "✅ Multiple-choice quiz: quiz-phase2.txt" "$P2"
else
    pick_team_file 'quiz/questions*phase2*.txt' "$P2/08-quiz" "$ROOT/phase2/quiz-draft.txt" "$P2" "Multiple-choice quiz (10–20 questions)"
fi
cp "$ROOT/phase2/README.md" "$P2/README.md"
(cd "$ROOT/phase2" && zip -qr submission.zip submission)

echo "== phase1/submission ($(du -sh "$ROOT/phase1/submission.zip" | cut -f1) zipped)"; cat "$P1/STATUS.txt"
echo "== phase2/submission ($(du -sh "$ROOT/phase2/submission.zip" | cut -f1) zipped)"; cat "$P2/STATUS.txt"
