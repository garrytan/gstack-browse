---
description: Onboard an existing project to gstack in one command.
---

# /gstack init

You are the `init` skill for gstack. Your job is to onboard an existing project (Greenfield or Brownfield) by auto-detecting its stack, inspecting build/test/CI configuration to find the correct commands, generating a `.gstack.json` file, and scaffolding a default review checklist if one is missing.

Follow these steps precisely:

1. **Pre-flight Checks**
   - Check if you are currently executing inside a gstack installation directory itself (e.g., if `./setup` and `browse/src/cli.ts` exist relative to the root). If you are, abort and tell the user they cannot run `/gstack init` on gstack itself.
   - Look for an existing `.gstack.json` in the current project root directory. If it exists, use the `AskUserQuestion` tool to ask the user if they want to overwrite it or partially update it. If they decline, abort.

2. **Auto-detect Stack from Project Files**
   - Look at the files in the current root directory (`package.json`, `Gemfile`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `build.gradle`, etc.).
   - Identify the primary language and framework. For monorepos, multiple stacks can match; pick the root or dominant one.

3. **Inspect Actual Commands**
   - Examine the configuration files from the detected stack to determine the correct test and build/eval commands.
   - For Node.js/TypeScript: Check `package.json` for `scripts.test`, `scripts.build`, etc.
   - For Ruby on Rails: Look for `bin/test` or `rspec` in `Gemfile`.
   - For Go: Assume `go test ./...` if `go.mod` is present.
   - For Rust: Assume `cargo test` if `Cargo.toml` is present.
   - For Python: Look at `pyproject.toml` or `tox.ini` for `pytest` or `tox`.
   - **Crucial step**: Search for CI configuration files (e.g., `.github/workflows/*.yml` or `.gitlab-ci.yml`) to see exactly how tests are run in CI. Extract those commands if they are robust, as CI is the ground truth.

4. **Generate `.gstack.json`**
   - Present the detected test and eval commands to the user using the `AskUserQuestion` tool to confirm before writing them.
   - Once confirmed (or adjusted by the user), generate the `.gstack.json` file in the current root directory using the following schema (include `evalCommand` as `null` if none, and an empty array for `evalPatterns` if none):
     ```json
     {
       "testCommand": "<detected or user-supplied command>",
       "evalCommand": "<detected or null>",
       "evalPatterns": [],
       "reviewChecklist": ".claude/skills/review/checklist.md"
     }
     ```

5. **Scaffold Review Checklist if Missing**
   - Check if `.claude/skills/review/checklist.md` exists in the current project.
   - If it does NOT exist, create the directory `.claude/skills/review/` if necessary.
   - Read the universal default checklist from the gstack installation at `.claude/skills/gstack/review/checklists/default.md`. 
   - Write the exact contents of that file to `.claude/skills/review/checklist.md` in the current project.

6. **Summary Output**
   - Output a short, helpful summary of what was detected and created (e.g., ".gstack.json created", "checklist.md scaffolded").
   - Conclude by telling the user: "You are now ready to use gstack! Use `/review` to review your code, and `/ship` to ship it."
