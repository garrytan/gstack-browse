# gstack development (Cybereum fork)

## Commands

```bash
bun install          # install dependencies
bun test             # run integration tests (browse + snapshot)
bun run dev <cmd>    # run CLI in dev mode, e.g. bun run dev goto https://example.com
bun run build        # compile binary to browse/dist/browse
```

## Project structure

This repo contains the **workflow skills** for building Cybereum. The analytical
skills (schedule-intelligence, decision-ai, risk-engine, etc.) live in the
[cybereum_Projects repo](https://github.com/ProBloCh/cybereum_Projects) under
`.claude/skills/`.

```
gstack/
├── browse/                          # Headless browser CLI (Playwright)
│   ├── src/                         # CLI + server + commands
│   ├── test/                        # Integration tests + fixtures
│   └── dist/                        # Compiled binary
│
│ ── Workflow Skills (dev process, Cybereum-adapted) ──
├── ship/                            # Ship workflow (bun test + build, PR)
├── review/                          # Pre-landing review (calculation integrity, graph consistency)
├── plan-ceo-review/                 # CEO/founder plan review (Cybereum product vision)
├── plan-eng-review/                 # Eng plan review (cross-skill architecture)
├── retro/                           # Retrospective (skill development tracking)
├── qa/                              # QA testing (formula verification, cross-skill consistency)
│
├── setup                            # One-time setup: build binary + symlink skills
├── SKILL.md                         # Browse skill (Claude discovers this)
└── package.json                     # Build scripts for browse
```

## Where things live

| What | Repo | Deploy to |
|------|------|-----------|
| Workflow skills (ship, review, qa, retro, plan reviews) | This repo (cybereum/Team) | `~/.claude/skills/gstack/` |
| Analytical skills (8 Cybereum product skills) | ProBloCh/cybereum_Projects | `cybereum_Projects/.claude/skills/` |
| Browse CLI binary | This repo | `~/.claude/skills/gstack/browse/dist/browse` |

## Deploying to the active skill

The active skill lives at `~/.claude/skills/gstack/`. After making changes:

1. Push your branch
2. Fetch and reset in the skill directory: `cd ~/.claude/skills/gstack && git fetch origin && git reset --hard origin/main`
3. Rebuild: `cd ~/.claude/skills/gstack && bun run build`

Or copy the binary directly: `cp browse/dist/browse ~/.claude/skills/gstack/browse/dist/browse`
