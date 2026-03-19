#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

mkdir -p "$HOME/.claude/skills"
ln -snf "$WORKSPACE_ROOT" "$HOME/.claude/skills/gstack"

if [ -x "$HOME/.claude/skills/gstack/setup" ]; then
  "$HOME/.claude/skills/gstack/setup"
else
  echo "gstack bootstrap skipped: setup script missing or not executable"
fi
