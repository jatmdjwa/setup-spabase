#!/usr/bin/env bash
# claude.ai 用 register-insight スキル ZIP を生成
# 使い方: bash scripts/build-skill-zip.sh
# 出力先: dist/register-insight-claude-ai.zip
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILL_PARENT="$REPO_ROOT/.claude/skills"
SKILL_NAME="register-insight"
OUT="$REPO_ROOT/dist/register-insight-claude-ai.zip"

mkdir -p "$REPO_ROOT/dist"
rm -f "$OUT"

# claude.ai expects the skill folder as ZIP root: register-insight/SKILL.md
# (NOT bare SKILL.md at root)
cd "$SKILL_PARENT"
zip -r "$OUT" "$SKILL_NAME" -x "*.pyc" "**/__pycache__/*" "$SKILL_NAME/.*"

echo "Built: $OUT"
unzip -l "$OUT"
