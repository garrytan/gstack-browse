# Semantic code search (sqry)
# Reference fragment — inlined by preamble.ts resolver
_SQRY="unavailable"
_SQRY_INDEXED="no"
_SQRY_STALE="no"
if command -v sqry >/dev/null 2>&1; then
  _SQRY="available"
  _SQRY_VERSION=$(sqry --version 2>/dev/null | head -1 || echo "unknown")
  _SQRY_STATUS=$(sqry index --status --json . 2>/dev/null || echo '{}')
  if echo "$_SQRY_STATUS" | grep -q '"exists": true' 2>/dev/null; then
    _SQRY_INDEXED="yes"
  fi
  if echo "$_SQRY_STATUS" | grep -q '"stale": true' 2>/dev/null; then
    _SQRY_STALE="yes"
  fi
fi
echo "SQRY: $_SQRY"
[ "$_SQRY" = "available" ] && echo "SQRY_VERSION: $_SQRY_VERSION"
[ "$_SQRY" = "available" ] && echo "SQRY_INDEXED: $_SQRY_INDEXED"
[ "$_SQRY" = "available" ] && echo "SQRY_STALE: $_SQRY_STALE"
