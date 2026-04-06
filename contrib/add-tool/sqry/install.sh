#!/usr/bin/env bash
# Install sqry as a gstack structural code analysis add-in.
# Idempotent — safe to run multiple times.
set -e

AGENT="${1:-claude}"
MIN_VERSION="7.0.0"

echo "=== sqry integration for gstack ==="
echo ""

# 1. Check for sqry CLI
if ! command -v sqry >/dev/null 2>&1; then
  echo "sqry not found on PATH."
  echo ""
  echo "Install via cargo (recommended — builds from source):"
  echo "  cargo install sqry-cli sqry-mcp"
  echo ""
  echo "Or download a release binary from:"
  echo "  https://github.com/verivus-oss/sqry/releases"
  echo ""
  echo "Then re-run this script."
  exit 1
fi

# 2. Check version (normalize: "sqry 7.1.4" -> "7.1.4")
SQRY_VERSION=$(sqry --version 2>/dev/null | awk '{print $2}' || echo "0.0.0")
echo "Found sqry $SQRY_VERSION"

# Portable semver comparator (no sort -V, works on macOS)
version_lt() {
  local IFS=.
  local i a=($1) b=($2)
  for ((i=0; i<${#b[@]}; i++)); do
    [ -z "${a[i]}" ] && a[i]=0
    if ((10#${a[i]} < 10#${b[i]})); then return 0; fi
    if ((10#${a[i]} > 10#${b[i]})); then return 1; fi
  done
  return 1
}

if version_lt "$SQRY_VERSION" "$MIN_VERSION"; then
  echo "sqry $MIN_VERSION+ required. Please upgrade:"
  echo "  cargo install sqry-cli sqry-mcp"
  exit 1
fi

# 3. Check for sqry-mcp
if ! command -v sqry-mcp >/dev/null 2>&1; then
  echo "sqry-mcp not found on PATH."
  echo ""
  echo "Install the MCP server:"
  echo "  cargo install sqry-mcp"
  echo ""
  echo "Then re-run this script."
  exit 1
fi

echo "Found sqry-mcp at $(command -v sqry-mcp)"

# 4. Configure MCP for the target agent
# Delegate to sqry's own setup command — it knows each host's config format.
echo ""
echo "Configuring MCP server for $AGENT..."

case "$AGENT" in
  claude) sqry mcp setup --tool claude ;;
  codex)  sqry mcp setup --tool codex ;;
  gemini) sqry mcp setup --tool gemini ;;
  all)    sqry mcp setup ;;
  *)      echo "Warning: Auto-configuration not supported for $AGENT. Run 'sqry mcp setup' manually." ;;
esac

# 5. Verify MCP configuration
echo ""
echo "MCP status:"
sqry mcp status 2>/dev/null || echo "  (could not verify — run 'sqry mcp status' manually)"

# 6. Build initial index if not present
if ! sqry index --status --json . 2>/dev/null | grep -q '"exists": true'; then
  echo ""
  echo "Building initial sqry index..."
  sqry index .
  echo "Index built."
else
  echo ""
  echo "sqry index already exists."
  if sqry index --status --json . 2>/dev/null | grep -q '"stale": true'; then
    echo "Index is stale — rebuilding..."
    sqry index .
    echo "Index rebuilt."
  fi
fi

# 7. Regenerate gstack skills (picks up {{SQRY_CONTEXT}} resolver)
GSTACK_DIR="${GSTACK_ROOT:-$HOME/.claude/skills/gstack}"
if [ -f "$GSTACK_DIR/package.json" ]; then
  echo ""
  echo "Regenerating gstack skill docs..."
  (cd "$GSTACK_DIR" && bun run gen:skill-docs --host all 2>/dev/null) || {
    echo "Warning: Could not regenerate skill docs. Run manually:"
    echo "  cd $GSTACK_DIR && bun run gen:skill-docs --host all"
  }
fi

echo ""
echo "Done. sqry structural code analysis is now available in gstack skills."
echo ""
echo "IMPORTANT: Restart your AI agent session for the MCP tools to appear."
