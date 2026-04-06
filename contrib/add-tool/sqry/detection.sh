# Semantic code search (sqry) — lightweight detection only
# Reference fragment — inlined by preamble.ts resolver
# Only command -v (~1ms) and directory check. No subprocess calls.
# Index staleness is checked at query time by the agent, not here.
_SQRY="unavailable"
_SQRY_INDEXED="unknown"
if command -v sqry-mcp >/dev/null 2>&1; then
  _SQRY="available"
  [ -d ".sqry" ] && _SQRY_INDEXED="yes" || _SQRY_INDEXED="no"
fi
echo "SQRY: $_SQRY"
[ "$_SQRY" = "available" ] && echo "SQRY_INDEXED: $_SQRY_INDEXED"
