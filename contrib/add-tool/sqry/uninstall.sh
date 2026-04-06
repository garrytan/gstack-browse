#!/usr/bin/env bash
# Remove sqry integration from gstack.
# Does NOT uninstall sqry itself — only removes the gstack integration.
set -e

echo "=== Removing sqry integration from gstack ==="

# Helper: remove a key from a JSON file using node (portable)
remove_json_key() {
  local file="$1" key_path="$2"
  [ -f "$file" ] && command -v node >/dev/null 2>&1 || return 0
  node -e "
    const fs = require('fs');
    try {
      const s = JSON.parse(fs.readFileSync('$file', 'utf-8'));
      const parts = '$key_path'.split('.');
      let obj = s;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]]) return;
        obj = obj[parts[i]];
      }
      const last = parts[parts.length - 1];
      if (obj[last] !== undefined) {
        delete obj[last];
        fs.writeFileSync('$file', JSON.stringify(s, null, 2));
        console.log('Removed ' + '$key_path' + ' from $file');
      }
    } catch(e) {}
  " 2>/dev/null || true
}

# 1. Claude: global mcpServers.sqry + per-project mcpServers.sqry
for settings in "$HOME/.claude.json" "$HOME/.claude/settings.json"; do
  remove_json_key "$settings" "mcpServers.sqry"
  # Also clean per-project entries
  if [ -f "$settings" ] && command -v node >/dev/null 2>&1; then
    node -e "
      const fs = require('fs');
      try {
        const s = JSON.parse(fs.readFileSync('$settings', 'utf-8'));
        if (s.projects) {
          let changed = false;
          for (const [k, v] of Object.entries(s.projects)) {
            if (v && v.mcpServers && v.mcpServers.sqry) {
              delete v.mcpServers.sqry;
              changed = true;
            }
          }
          if (changed) {
            fs.writeFileSync('$settings', JSON.stringify(s, null, 2));
            console.log('Removed per-project sqry MCP entries from $settings');
          }
        }
      } catch(e) {}
    " 2>/dev/null || true
  fi
done

# 2. Codex: [mcp_servers.sqry] section in TOML (portable, no sed -i)
CODEX_CONFIG="$HOME/.codex/config.toml"
if [ -f "$CODEX_CONFIG" ] && grep -q '\[mcp_servers\.sqry\]' "$CODEX_CONFIG" 2>/dev/null; then
  node -e "
    const fs = require('fs');
    const lines = fs.readFileSync('$CODEX_CONFIG', 'utf-8').split('\n');
    const out = [];
    let skip = false;
    for (const line of lines) {
      if (/^\[mcp_servers\.sqry[\].]/.test(line.trim())) { skip = true; continue; }
      if (skip && line.startsWith('[') && !/^\[mcp_servers\.sqry[\].]/.test(line.trim())) { skip = false; }
      if (!skip) out.push(line);
    }
    fs.writeFileSync('$CODEX_CONFIG', out.join('\n'));
    console.log('Removed [mcp_servers.sqry] from Codex config');
  " 2>/dev/null || true
fi

# 3. Gemini: mcpServers.sqry in JSON
GEMINI_CONFIG="$HOME/.gemini/settings.json"
remove_json_key "$GEMINI_CONFIG" "mcpServers.sqry"

# 4. Regenerate gstack skills ({{SQRY_CONTEXT}} emits nothing without sqry)
GSTACK_DIR="${GSTACK_ROOT:-$HOME/.claude/skills/gstack}"
if [ -f "$GSTACK_DIR/package.json" ]; then
  echo "Regenerating gstack skill docs..."
  (cd "$GSTACK_DIR" && bun run gen:skill-docs --host all 2>/dev/null) || true
fi

echo "Done. sqry integration removed. sqry itself is still installed."
echo "To fully uninstall sqry: see https://github.com/verivus-oss/sqry#uninstall"
