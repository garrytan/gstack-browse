#!/usr/bin/env bash
# cavestack error helper (Tier-2 Rust-style pattern).
# Source this file in any cavestack bash script, then call:
#   cavestack_error CS001 "optional context string"
# It prints a formatted error to stderr and exits 1.
#
# Error codes + messages live in lib/error-codes.json.
# Both bash (this file) and TypeScript (lib/error.ts) read that JSON
# so identical errors produce identical output in every language.

_cavestack_error_codes_json() {
  # Resolve lib/error-codes.json relative to this file's location.
  local here
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  printf '%s' "$here/error-codes.json"
}

cavestack_error() {
  local code="$1"
  local context="${2:-}"
  local codes_file
  codes_file="$(_cavestack_error_codes_json)"

  if [ ! -f "$codes_file" ]; then
    printf 'Error[CS900]: internal invariant violated\n' >&2
    printf '   reason: %s missing\n' "$codes_file" >&2
    printf '   fix: reinstall cavestack (./setup)\n' >&2
    printf '   docs: https://cavestack.jerkyjesse.io/docs/errors/CS900\n' >&2
    exit 1
  fi

  local entry
  entry="$(command -v bun >/dev/null 2>&1 && \
    bun -e "const j=require('$codes_file'); const e=j['$code']; if(!e){console.error('UNKNOWN'); process.exit(2);} console.log(JSON.stringify(e));" 2>/dev/null || \
    node -e "const j=require('$codes_file'); const e=j['$code']; if(!e){console.error('UNKNOWN'); process.exit(2);} console.log(JSON.stringify(e));" 2>/dev/null)"

  if [ -z "$entry" ] || [ "$entry" = "UNKNOWN" ]; then
    printf 'Error[%s]: unrecognized error code\n' "$code" >&2
    printf '   fix: check lib/error-codes.json for valid codes\n' >&2
    printf '   docs: https://cavestack.jerkyjesse.io/docs/errors\n' >&2
    exit 1
  fi

  local msg fix docs
  msg="$(printf '%s' "$entry" | bun -e 'console.log(JSON.parse(require("fs").readFileSync(0, "utf8")).message)' 2>/dev/null \
       || printf '%s' "$entry" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0, "utf8")).message)' 2>/dev/null)"
  fix="$(printf '%s' "$entry" | bun -e 'console.log(JSON.parse(require("fs").readFileSync(0, "utf8")).fix)' 2>/dev/null \
       || printf '%s' "$entry" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0, "utf8")).fix)' 2>/dev/null)"
  docs="$(printf '%s' "$entry" | bun -e 'console.log(JSON.parse(require("fs").readFileSync(0, "utf8")).docs)' 2>/dev/null \
        || printf '%s' "$entry" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0, "utf8")).docs)' 2>/dev/null)"

  printf 'Error[%s]: %s\n' "$code" "$msg" >&2
  [ -n "$context" ] && printf '   context: %s\n' "$context" >&2
  printf '   fix: %s\n' "$fix" >&2
  printf '   docs: %s\n' "$docs" >&2
  exit 1
}

cavestack_warn() {
  local code="$1"
  local context="${2:-}"
  local codes_file
  codes_file="$(_cavestack_error_codes_json)"

  [ ! -f "$codes_file" ] && printf 'warn[%s]: %s\n' "$code" "$context" >&2 && return 0

  local entry
  entry="$(bun -e "const j=require('$codes_file'); const e=j['$code']; if(!e){process.exit(2);} console.log(JSON.stringify(e));" 2>/dev/null \
        || node -e "const j=require('$codes_file'); const e=j['$code']; if(!e){process.exit(2);} console.log(JSON.stringify(e));" 2>/dev/null)"

  if [ -z "$entry" ]; then
    printf 'warn[%s]: %s\n' "$code" "$context" >&2
    return 0
  fi

  local msg
  msg="$(printf '%s' "$entry" | bun -e 'console.log(JSON.parse(require("fs").readFileSync(0, "utf8")).message)' 2>/dev/null \
       || printf '%s' "$entry" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0, "utf8")).message)' 2>/dev/null)"
  printf 'warn[%s]: %s%s\n' "$code" "$msg" "${context:+ — $context}" >&2
}
