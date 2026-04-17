#!/usr/bin/env bash
# CaveStack one-liner installer
#
#   curl -fsSL https://cavestack.jerkyjesse.com/install | sh
#
# What it does:
#   1. Checks prerequisites (git required; bun auto-installs if missing)
#   2. Clones cavestack to ~/.claude/skills/cavestack
#   3. Runs ./setup (which builds browse, symlinks skills, installs hooks)
#   4. Runs cavestack-upgrade/migrations/v1.0.0.0.sh (records DX metric + cs-* aliases)
#   5. Prints post-install message
#
# Privacy:
#   - No remote telemetry
#   - No analytics
#   - No signup
#   - All state stays local (~/.cavestack/, ~/.claude/skills/cavestack/)

set -euo pipefail

# ─── Terminal colors (disabled if not TTY) ──────────────────────
if [ -t 1 ]; then
  AMBER="\033[38;5;214m"
  DIM="\033[38;5;244m"
  BOLD="\033[1m"
  GREEN="\033[38;5;76m"
  RED="\033[38;5;196m"
  RESET="\033[0m"
else
  AMBER=""; DIM=""; BOLD=""; GREEN=""; RED=""; RESET=""
fi

CAVESTACK_REPO="${CAVESTACK_REPO:-https://github.com/JerkyJesse/cavestack.git}"
CAVESTACK_DIR="${CAVESTACK_DIR:-$HOME/.claude/skills/cavestack}"
BUN_VERSION="1.3.10"

printf "${BOLD}${AMBER}CaveStack one-line installer${RESET}\n"
printf "${DIM}Install location: $CAVESTACK_DIR${RESET}\n"
echo ""

# ─── Prereq 1: git ──────────────────────────────────────────────
if ! command -v git >/dev/null 2>&1; then
  printf "${RED}Error[CS002]: git not found${RESET}\n" >&2
  echo "   fix: install git — https://git-scm.com/downloads" >&2
  echo "   docs: https://cavestack.jerkyjesse.com/docs/errors/CS002" >&2
  exit 1
fi

# ─── Prereq 2: bun (auto-install if missing) ────────────────────
if ! command -v bun >/dev/null 2>&1; then
  printf "${DIM}bun not found. CaveStack needs bun $BUN_VERSION+ to build.${RESET}\n"
  printf "Install bun automatically? [Y/n] "
  read -r REPLY </dev/tty || REPLY="y"
  case "$REPLY" in
    n|N|no|NO)
      printf "${RED}Aborting.${RESET} Install bun manually, then re-run:\n" >&2
      echo "   curl -fsSL https://bun.sh/install | bash" >&2
      exit 1
      ;;
  esac

  echo ""
  printf "${DIM}Installing bun...${RESET}\n"
  # Download bun installer, show checksum for verification
  TMPFILE="$(mktemp)"
  curl -fsSL "https://bun.sh/install" -o "$TMPFILE"
  # SHA256 of bun install script published by Oven at the time of CaveStack v1.0.0.0
  # If bun updates their installer, checksum here may drift — user can override by
  # setting CAVESTACK_SKIP_BUN_CHECKSUM=1 (not recommended).
  EXPECTED_SHA="${CAVESTACK_BUN_INSTALL_SHA:-bab8acfb046aac8c72407bdcce903957665d655d7acaa3e11c7c4616beae68dd}"
  ACTUAL_SHA="$(shasum -a 256 "$TMPFILE" 2>/dev/null | awk '{print $1}' || sha256sum "$TMPFILE" 2>/dev/null | awk '{print $1}')"
  if [ -z "$ACTUAL_SHA" ]; then
    printf "${RED}warn: cannot verify bun installer checksum (no shasum/sha256sum)${RESET}\n" >&2
    printf "Proceed anyway? [y/N] "
    read -r ANSWER </dev/tty || ANSWER="n"
    case "$ANSWER" in y|Y) ;; *) rm "$TMPFILE"; exit 1 ;; esac
  elif [ "${CAVESTACK_SKIP_BUN_CHECKSUM:-0}" != "1" ] && [ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]; then
    printf "${RED}Error[CS102]: bun installer checksum mismatch${RESET}\n" >&2
    echo "   expected: $EXPECTED_SHA" >&2
    echo "   actual:   $ACTUAL_SHA" >&2
    echo "   fix: set CAVESTACK_BUN_INSTALL_SHA to new value if trusted, or abort" >&2
    echo "   docs: https://cavestack.jerkyjesse.com/docs/errors/CS102" >&2
    rm "$TMPFILE"
    exit 1
  fi

  BUN_VERSION="$BUN_VERSION" bash "$TMPFILE"
  rm "$TMPFILE"

  # Add bun to PATH for this script's remaining steps
  export PATH="$HOME/.bun/bin:$PATH"

  if ! command -v bun >/dev/null 2>&1; then
    printf "${RED}bun installed but not in PATH. Close + reopen your terminal and re-run installer.${RESET}\n" >&2
    exit 1
  fi
  printf "${GREEN}✓ bun $(bun --version) installed${RESET}\n"
  echo ""
fi

# ─── Clone or update cavestack ──────────────────────────────────
if [ -d "$CAVESTACK_DIR" ]; then
  if [ -d "$CAVESTACK_DIR/.git" ]; then
    printf "${DIM}Existing install detected. Updating...${RESET}\n"
    cd "$CAVESTACK_DIR"
    git fetch origin --quiet
    git reset --hard origin/main --quiet
  else
    printf "${RED}Error[CS100]: $CAVESTACK_DIR exists but is not a git repo${RESET}\n" >&2
    echo "   fix: back up with 'mv $CAVESTACK_DIR ${CAVESTACK_DIR}.bak' and re-run installer" >&2
    echo "   docs: https://cavestack.jerkyjesse.com/docs/errors/CS100" >&2
    exit 1
  fi
else
  printf "${DIM}Cloning cavestack...${RESET}\n"
  mkdir -p "$(dirname "$CAVESTACK_DIR")"
  git clone --quiet "$CAVESTACK_REPO" "$CAVESTACK_DIR"
fi

# ─── Run setup ──────────────────────────────────────────────────
cd "$CAVESTACK_DIR"
printf "${DIM}Building + installing...${RESET}\n"
./setup -q

# ─── Run v1.0.0.0 migration (creates cs-* aliases, records install DX event) ───
if [ -x "$CAVESTACK_DIR/cavestack-upgrade/migrations/v1.0.0.0.sh" ]; then
  bash "$CAVESTACK_DIR/cavestack-upgrade/migrations/v1.0.0.0.sh" 2>/dev/null || true
fi

# ─── Post-install message ────────────────────────────────────────
printf "\n${GREEN}${BOLD}✓ CaveStack installed at $CAVESTACK_DIR${RESET}\n\n"

printf "${BOLD}Try these next:${RESET}\n"
printf "  ${AMBER}cavestack-skills list${RESET}        see all 40 skills\n"
printf "  ${AMBER}cavestack-dx show${RESET}            your DX metrics (local-only)\n"
echo ""
printf "${BOLD}Open a new Claude Code session${RESET} (caveman hooks activate on SessionStart)\n"
printf "  then try: ${AMBER}/office-hours${RESET} or ${AMBER}/investigate${RESET} or ${AMBER}/help${RESET}\n"
echo ""
printf "${DIM}Add ${CAVESTACK_DIR}/bin to PATH for 'cs-*' short aliases.${RESET}\n"
printf "${DIM}Docs: https://cavestack.jerkyjesse.com${RESET}\n"
printf "${DIM}Issues: https://github.com/JerkyJesse/cavestack/issues${RESET}\n"
