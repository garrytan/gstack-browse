#!/usr/bin/env bash
# Worktree management for parallel Claude Code sessions
#
# Each worktree gets its own isolated copy of the repository with a dedicated
# branch, enabling multiple Claude sessions to work on different tasks without
# file conflicts. A .claude-worktree marker file tracks which branch each
# worktree expects, enabling branch-guard.sh to prevent accidental cross-branch
# commits.
#
# Usage:
#   worktree.sh create <repo> <name> [base-branch]
#   worktree.sh list [repo]
#   worktree.sh remove <repo> <name>
#   worktree.sh clean <repo>
#   worktree.sh path <repo> <name>
#
# Environment:
#   GSTACK_WORKTREE_BASE  Override worktree root (default: ~/.worktrees)

set -eo pipefail

WORKTREE_BASE="${GSTACK_WORKTREE_BASE:-$HOME/.worktrees}"

usage() {
    echo "Usage: worktree.sh <command> [options]"
    echo ""
    echo "Manage isolated git worktrees for parallel Claude Code sessions."
    echo ""
    echo "Commands:"
    echo "  create <repo> <name> [base]   Create new worktree + branch"
    echo "  list [repo]                    List worktrees (or all if no repo)"
    echo "  remove <repo> <name>           Remove worktree and delete branch"
    echo "  clean <repo>                   Remove ALL worktrees for a repo"
    echo "  path <repo> <name>             Print worktree path (for cd/scripts)"
    echo ""
    echo "Examples:"
    echo "  worktree.sh create myapp auth-flow main"
    echo "  worktree.sh list myapp"
    echo "  worktree.sh remove myapp auth-flow"
    echo "  worktree.sh clean myapp"
    echo ""
    echo "Environment:"
    echo "  GSTACK_WORKTREE_BASE   Root directory for worktrees (default: ~/.worktrees)"
}

create_worktree() {
    local repo="$1" name="$2" base="${3:-main}"

    if [[ -z "$repo" || -z "$name" ]]; then
        echo "Error: repo and name are required" >&2
        echo "Usage: worktree.sh create <repo> <name> [base-branch]" >&2
        return 1
    fi

    local branch="feature/$name"
    local worktree_path="$WORKTREE_BASE/$repo/$name"

    if [[ -d "$worktree_path" ]]; then
        echo "Error: Worktree already exists at $worktree_path" >&2
        return 1
    fi

    mkdir -p "$WORKTREE_BASE/$repo"

    echo "Creating worktree: $worktree_path"
    echo "Branch: $branch (from $base)"

    git worktree add -b "$branch" "$worktree_path" "$base"

    # Write .claude-worktree marker for branch-guard.sh enforcement
    cat > "$worktree_path/.claude-worktree" << EOF
{
  "branch": "$branch",
  "worktree_path": "$worktree_path",
  "repo": "$repo",
  "session": "$name",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

    # Add marker to worktree's .gitignore (don't commit it)
    if ! grep -qF '.claude-worktree' "$worktree_path/.gitignore" 2>/dev/null; then
        echo '.claude-worktree' >> "$worktree_path/.gitignore"
    fi

    echo ""
    echo "Worktree created."
    echo ""
    echo "To start working:"
    echo "  cd $worktree_path && claude"
}

list_worktrees() {
    local repo="$1"

    if [[ -n "$repo" ]]; then
        local repo_dir="$WORKTREE_BASE/$repo"
        if [[ ! -d "$repo_dir" ]]; then
            echo "No worktrees for $repo"
            return 0
        fi

        echo "Worktrees for $repo:"
        echo ""

        for wt_dir in "$repo_dir"/*/; do
            [[ -d "$wt_dir" ]] || continue
            local name
            name=$(basename "$wt_dir")
            local branch="(unknown)"
            local created="(unknown)"

            if [[ -f "$wt_dir/.claude-worktree" ]]; then
                if command -v jq &>/dev/null; then
                    branch=$(jq -r '.branch // "(unknown)"' "$wt_dir/.claude-worktree" 2>/dev/null)
                    created=$(jq -r '.created_at // "(unknown)"' "$wt_dir/.claude-worktree" 2>/dev/null)
                else
                    branch=$(grep -o '"branch"[[:space:]]*:[[:space:]]*"[^"]*"' "$wt_dir/.claude-worktree" | head -1 | sed 's/.*"branch"[[:space:]]*:[[:space:]]*"//; s/"//')
                fi
            fi

            printf "  %-20s  %-30s  %s\n" "$name" "$branch" "$created"
        done
    else
        echo "All git worktrees:"
        git worktree list
    fi
}

remove_worktree() {
    local repo="$1" name="$2"

    if [[ -z "$repo" || -z "$name" ]]; then
        echo "Error: repo and name are required" >&2
        echo "Usage: worktree.sh remove <repo> <name>" >&2
        return 1
    fi

    local worktree_path="$WORKTREE_BASE/$repo/$name"
    local branch="feature/$name"

    echo "Removing worktree: $worktree_path"

    git worktree remove "$worktree_path" --force 2>/dev/null || true
    git branch -D "$branch" 2>/dev/null || true
    rm -rf "$worktree_path" 2>/dev/null || true

    echo "Worktree removed: $name"
}

clean_worktrees() {
    local repo="$1"

    if [[ -z "$repo" ]]; then
        echo "Error: repo is required" >&2
        echo "Usage: worktree.sh clean <repo>" >&2
        return 1
    fi

    local repo_dir="$WORKTREE_BASE/$repo"
    if [[ ! -d "$repo_dir" ]]; then
        echo "No worktrees to clean for $repo"
        return 0
    fi

    echo "Removing all worktrees for $repo..."

    for wt_dir in "$repo_dir"/*/; do
        [[ -d "$wt_dir" ]] || continue
        local name
        name=$(basename "$wt_dir")
        remove_worktree "$repo" "$name"
    done

    rmdir "$repo_dir" 2>/dev/null || true
    echo "Clean complete."
}

worktree_path() {
    local repo="$1" name="$2"

    if [[ -z "$repo" || -z "$name" ]]; then
        echo "Error: repo and name are required" >&2
        return 1
    fi

    echo "$WORKTREE_BASE/$repo/$name"
}

# CLI dispatch
case "${1:-}" in
    create)  shift; create_worktree "$@" ;;
    list)    shift; list_worktrees "$@" ;;
    remove)  shift; remove_worktree "$@" ;;
    clean)   shift; clean_worktrees "$@" ;;
    path)    shift; worktree_path "$@" ;;
    -h|--help|help) usage ;;
    *)
        if [[ -n "${1:-}" ]]; then
            echo "Unknown command: $1" >&2
        fi
        usage
        exit 1
        ;;
esac
