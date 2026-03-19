## Skills
A skill is a folder with a `SKILL.md` file that Codex can load on demand. This repo ships these local skills:

- `browse`: Fast headless browser for QA testing and site dogfooding. File: `./browse/SKILL.md`
- `office-hours`: YC Office Hours — two modes. File: `./office-hours/SKILL.md`
- `plan-ceo-review`: CEO/founder-mode plan review. File: `./plan-ceo-review/SKILL.md`
- `plan-eng-review`: Eng manager-mode plan review. File: `./plan-eng-review/SKILL.md`
- `plan-design-review`: Designer's eye plan review — interactive, like CEO and Eng review. File: `./plan-design-review/SKILL.md`
- `design-consultation`: Design consultation: understands your product, researches the landscape, proposes a complete design system (aesthetic, typography, color, layout, spacing, motion), and generates font+color preview pages. File: `./design-consultation/SKILL.md`
- `design-review`: Designer's eye QA: finds visual inconsistency, spacing issues, hierarchy problems, AI slop patterns, and slow interactions — then fixes them. File: `./design-review/SKILL.md`
- `investigate`: Systematic debugging with root cause investigation. File: `./investigate/SKILL.md`
- `review`: Pre-landing PR review. File: `./review/SKILL.md`
- `qa`: Systematically QA test a web application and fix bugs found. File: `./qa/SKILL.md`
- `qa-only`: Report-only QA testing. File: `./qa-only/SKILL.md`
- `ship`: Ship workflow: detect + merge base branch, run tests, review diff, bump VERSION, update CHANGELOG, commit, push, create PR. File: `./ship/SKILL.md`
- `document-release`: Post-ship documentation update. File: `./document-release/SKILL.md`
- `retro`: Weekly engineering retrospective. File: `./retro/SKILL.md`
- `setup-browser-cookies`: Import cookies from your real browser (Comet, Chrome, Arc, Brave, Edge) into the headless browse session. File: `./setup-browser-cookies/SKILL.md`
- `careful`: Safety guardrails for destructive commands. File: `./careful/SKILL.md`
- `freeze`: Restrict file edits to a specific directory for the session. File: `./freeze/SKILL.md`
- `guard`: Full safety mode: destructive command warnings + directory-scoped edits. File: `./guard/SKILL.md`
- `unfreeze`: Clear the freeze boundary set by /freeze, allowing edits to all directories again. File: `./unfreeze/SKILL.md`
- `gstack-upgrade`: Upgrade gstack to the latest version. File: `./gstack-upgrade/SKILL.md`
- `codex`: OpenAI Codex CLI wrapper — three modes. File: `./codex/SKILL.md`

### How To Use Skills
- Use a skill when the user names it or when the task clearly matches the description above.
- These are Codex skills, not slash commands. Invoke them by name, for example: `use browse`, `run review`, `use plan-eng-review`.
- Open only the relevant `SKILL.md` and any files it explicitly references.
- Prefer project-local installs in `.codex/skills/` when you want the team to share the same skill pack.
- If `browse` is missing or stale, run `./setup` in the installed `gstack-codex` directory to rebuild the binary and refresh symlinks.
