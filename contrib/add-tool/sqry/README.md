# sqry Integration for gstack

[sqry](https://github.com/verivus-oss/sqry) provides AST-based semantic code
search via 34 MCP tools. This integration adds structural code analysis to
gstack skills — callers/callees tracing, cycle detection, complexity metrics,
structural call-path tracing, and more.

## Install

    bash contrib/add-tool/sqry/install.sh [claude|codex|gemini|all]

## What it does

When sqry is installed and configured as an MCP server, gstack skills gain a
"Structural Code Analysis" section with contextual tool recommendations:

- `/investigate` gets caller/callee tracing, cycle detection, blast radius analysis
- `/cso` gets structural call-path tracing from input handlers to sinks, dead code detection
- `/review` gets complexity regression checks, cycle detection, semantic diff
- `/retro` gets structural trend analysis and codebase health metrics
- `/plan-eng-review` gets dependency visualization and architecture boundary validation
- `/ship` gets pre-ship structural verification (cycles, dead code, complexity)

See `tools.json` for the complete routing table.

## Architecture: WHEN vs HOW

This integration follows sqry v8's **resource delegation** model:

- **gstack owns WHEN** — `tools.json` defines which sqry tools to use at which
  skill phase (e.g., `trace_path` during `/cso` security analysis). This is
  gstack's value-add: contextual routing that sqry doesn't know about.
- **sqry owns HOW** — parameter limits, cost tiering, scoping strategies, and
  output size guidance are served live by the sqry MCP server as resources
  (`sqry://docs/capability-map`, `sqry://docs/tool-guide`). These always match
  the user's installed sqry version and update automatically.

This split prevents drift: when sqry adds tools, changes limits, or updates
tiering, gstack agents pick it up automatically without a gstack release.

## Relationship to existing sqry skills

The `sqry-claude`, `sqry-codex`, and `sqry-gemini` skills (shipped with sqry)
teach agents how to *set up and use* sqry. This gstack integration is different —
it wires sqry tools into gstack's *existing workflow skills* so they're used
automatically at the right moment during debugging, review, security audits, etc.

| sqry skills (setup) | gstack add-in (workflow) |
|---------------------|------------------------|
| Teach tool usage | Wire tools into skill phases |
| Manual invocation | Automatic contextual use |
| Generic patterns | Skill-phase routing |
| No index management | Auto-rebuild when stale |
| Parameter guidance inline | Delegates to MCP resources |

## Uninstall

    bash contrib/add-tool/sqry/uninstall.sh

This removes the gstack integration. sqry itself remains installed.
