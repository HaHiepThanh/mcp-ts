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

pick_team_file 'slides/*phase2*.pptx' "$P2/01-slides" "" "$P2" "Slides (pptx, 20+ slides)"
copy_code "$P2/02-code"
note "✅ Code: 02-code/mcp-academic" "$P2"
mkdir -p "$P2/03-configurations"
cp "$APP"/config/*.json "$P2/03-configurations/"
cp "$ROOT/.vscode/mcp.json" "$P2/03-configurations/vscode-mcp.json"
note "✅ Configurations: $(ls "$P2/03-configurations" | wc -l | tr -d ' ') files (LLM, servers, transport, grading, cache)" "$P2"
mkdir -p "$P2/04-scenarios"
cp "$APP/demo/benchmark.ts" "$APP/demo/questions.txt" "$P2/04-scenarios/"
note "✅ Test scenarios: benchmark.ts (11 cases), demo questions" "$P2"
mkdir -p "$P2/05-results"
for f in model-comparison model-observations results; do cp "$APP/docs/$f.md" "$P2/05-results/"; done
cp "$APP"/outputs/examples/{s8-transports,c1-client-connect,c2-request-options-errors,c4-caching}.json "$P2/05-results/" 2>/dev/null || true
note "✅ Results and comparisons: model-comparison.md, results.md, transport/connect/cache measurements" "$P2"
mkdir -p "$P2/06-logs"
cp "$APP"/outputs/logs/chat-*.jsonl "$P2/06-logs/" 2>/dev/null || true
cp "$APP"/outputs/benchmarks/*.json "$P2/06-logs/" 2>/dev/null || true
rsync -a --exclude 'README.md' "$ROOT/phase2/runs/" "$P2/06-logs/team-runs/" 2>/dev/null || true
note "✅ Logs: $(ls "$P2/06-logs" | wc -l | tr -d ' ') files (chat turns + benchmark runs)" "$P2"
mkdir -p "$P2/07-observations-improvements"
cp "$ROOT/phase2/improvements.md" "$APP/docs/model-observations.md" "$P2/07-observations-improvements/"
note "✅ Observations + improvements" "$P2"
pick_team_file 'quiz/questions*phase2*.txt' "$P2/08-quiz" "$ROOT/phase2/quiz-draft.txt" "$P2" "Multiple-choice quiz (10–20 questions)"
cp "$ROOT/phase2/README.md" "$P2/README.md"
(cd "$ROOT/phase2" && zip -qr submission.zip submission)

echo "== phase1/submission ($(du -sh "$ROOT/phase1/submission.zip" | cut -f1) zipped)"; cat "$P1/STATUS.txt"
echo "== phase2/submission ($(du -sh "$ROOT/phase2/submission.zip" | cut -f1) zipped)"; cat "$P2/STATUS.txt"
