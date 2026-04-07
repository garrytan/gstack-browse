import type { TemplateContext } from './types';

export function generateSlugEval(ctx: TemplateContext): string {
  return `eval "$(${ctx.paths.binDir}/gstack-slug 2>/dev/null)"`;
}

export function generateSlugSetup(ctx: TemplateContext): string {
  return `eval "$(${ctx.paths.binDir}/gstack-slug 2>/dev/null)" && mkdir -p ~/.gstack/projects/$SLUG`;
}

export function generateBaseBranchDetect(_ctx: TemplateContext): string {
  return `## Step 0: Detect platform and base branch

\`\`\`bash
git remote get-url origin 2>/dev/null
\`\`\`

- URL contains "github.com" → **GitHub**
- URL contains "gitlab" → **GitLab**
- Otherwise check CLI availability:
  - \`gh auth status 2>/dev/null\` succeeds → **GitHub** (covers Enterprise)
  - \`glab auth status 2>/dev/null\` succeeds → **GitLab** (covers self-hosted)
  - Neither → **unknown** (use git-native commands only)

Determine which branch this PR/MR targets, or the repo's default branch. Use as "the base branch" in all subsequent steps.

**If GitHub:**
1. \`gh pr view --json baseRefName -q .baseRefName\` — if succeeds, use it
2. \`gh repo view --json defaultBranchRef -q .defaultBranchRef.name\` — if succeeds, use it

**If GitLab:**
1. \`glab mr view -F json 2>/dev/null\` and extract \`target_branch\` — if succeeds, use it
2. \`glab repo view -F json 2>/dev/null\` and extract \`default_branch\` — if succeeds, use it

**Git-native fallback (unknown platform or CLI failure):**
1. \`git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||'\`
2. Fails: \`git rev-parse --verify origin/main 2>/dev/null\` → use \`main\`
3. Fails: \`git rev-parse --verify origin/master 2>/dev/null\` → use \`master\`

If all fail, fall back to \`main\`.

Print the detected base branch name. In every subsequent \`git diff\`, \`git log\`,
\`git fetch\`, \`git merge\`, and PR/MR creation command, substitute the detected
branch name wherever instructions say "the base branch" or \`<default>\`.

---`;
}

export function generateDeployBootstrap(_ctx: TemplateContext): string {
  return `\`\`\`bash
# Check for persisted deploy config in CLAUDE.md
DEPLOY_CONFIG=$(grep -A 20 "## Deploy Configuration" CLAUDE.md 2>/dev/null || echo "NO_CONFIG")
echo "$DEPLOY_CONFIG"

# If config exists, parse it
if [ "$DEPLOY_CONFIG" != "NO_CONFIG" ]; then
  PROD_URL=$(echo "$DEPLOY_CONFIG" | grep -i "production.*url" | head -1 | sed 's/.*: *//')
  PLATFORM=$(echo "$DEPLOY_CONFIG" | grep -i "platform" | head -1 | sed 's/.*: *//')
  echo "PERSISTED_PLATFORM:$PLATFORM"
  echo "PERSISTED_URL:$PROD_URL"
fi

# Auto-detect platform from config files
[ -f fly.toml ] && echo "PLATFORM:fly"
[ -f render.yaml ] && echo "PLATFORM:render"
([ -f vercel.json ] || [ -d .vercel ]) && echo "PLATFORM:vercel"
[ -f netlify.toml ] && echo "PLATFORM:netlify"
[ -f Procfile ] && echo "PLATFORM:heroku"
([ -f railway.json ] || [ -f railway.toml ]) && echo "PLATFORM:railway"

# Detect deploy workflows
for f in $(find .github/workflows -maxdepth 1 \( -name '*.yml' -o -name '*.yaml' \) 2>/dev/null); do
  [ -f "$f" ] && grep -qiE "deploy|release|production|cd" "$f" 2>/dev/null && echo "DEPLOY_WORKFLOW:$f"
  [ -f "$f" ] && grep -qiE "staging" "$f" 2>/dev/null && echo "STAGING_WORKFLOW:$f"
done
\`\`\`

If \`PERSISTED_PLATFORM\` and \`PERSISTED_URL\` found in CLAUDE.md, use them and skip manual detection. If no persisted config, use the auto-detected platform. If nothing detected, ask the user via AskUserQuestion.

To persist deploy settings, suggest the user run \`/setup-deploy\`.`;
}

export function generateQAMethodology(_ctx: TemplateContext): string {
  return `## Modes

### Diff-aware (automatic when on a feature branch with no URL)

**Primary mode** for feature branch verification. When the user says \`/qa\` without a URL on a feature branch, automatically:

1. **Analyze the branch diff:**
   \`\`\`bash
   git diff main...HEAD --name-only
   git log main..HEAD --oneline
   \`\`\`

2. **Identify affected pages/routes** from changed files:
   - Controller/route files → URL paths served
   - View/template/component files → pages that render them
   - Model/service files → pages using those models
   - CSS/style files → pages including those stylesheets
   - API endpoints → test with \`$B js "await fetch('/api/...')"\`
   - Static pages → navigate directly

   **If no pages/routes identified:** Fall back to Quick mode — homepage, top 5 nav targets, console errors, interactive elements.

3. **Detect the running app:**
   \`\`\`bash
   $B goto http://localhost:3000 2>/dev/null && echo "Found app on :3000" || \
   $B goto http://localhost:4000 2>/dev/null && echo "Found app on :4000" || \
   $B goto http://localhost:8080 2>/dev/null && echo "Found app on :8080"
   \`\`\`
   If no local app, check PR/environment for staging URL. If nothing works, ask the user.

4. **Test each affected page/route:**
   - Navigate, screenshot, check console errors
   - Interactive changes (forms, buttons, flows) → test end-to-end
   - Use \`snapshot -D\` before/after to verify expected effect

5. **Cross-reference commit messages and PR description** — verify intent matches outcome.

6. **Check TODOS.md** for known bugs related to changed files. Note new bugs not in TODOS.md.

7. **Report findings** scoped to branch changes:
   - "Changes tested: N pages/routes affected"
   - Per page: does it work? Screenshot evidence. Regressions?

**If the user provides a URL:** Use as base but still scope testing to changed files.

### Full (default when URL is provided)
Systematic exploration. Visit every reachable page. Document 5-10 well-evidenced issues. Produce health score. Takes 5-15 minutes.

### Quick (\`--quick\`)
30-second smoke test. Visit homepage + top 5 navigation targets. Check: page loads? Console errors? Broken links? Produce health score.

### Regression (\`--regression <baseline>\`)
Run full mode, then load \`baseline.json\` from a previous run. Diff: issues fixed? New issues? Score delta? Append regression section to report.

---

## Workflow

### Phase 1: Initialize

1. Find browse binary (see Setup above)
2. Create output directories
3. Copy report template from \`qa/templates/qa-report-template.md\` to output dir
4. Start timer

### Phase 2: Authenticate (if needed)

**If auth credentials provided:**

\`\`\`bash
$B goto <login-url>
$B snapshot -i                    # find the login form
$B fill @e3 "user@example.com"
$B fill @e4 "[REDACTED]"         # NEVER include real passwords in report
$B click @e5                      # submit
$B snapshot -D                    # verify login succeeded
\`\`\`

**If cookie file provided:**

\`\`\`bash
$B cookie-import cookies.json
$B goto <target-url>
\`\`\`

**If 2FA/OTP required:** Ask the user for the code and wait.

**If CAPTCHA blocks:** Tell the user: "Please complete the CAPTCHA in the browser, then tell me to continue."

### Phase 3: Orient

\`\`\`bash
$B goto <target-url>
$B snapshot -i -a -o "$REPORT_DIR/screenshots/initial.png"
$B links                          # map navigation structure
$B console --errors               # errors on landing?
\`\`\`

**Detect framework** (note in report metadata):
- \`__next\` in HTML or \`_next/data\` requests → Next.js
- \`csrf-token\` meta tag → Rails
- \`wp-content\` in URLs → WordPress
- Client-side routing with no page reloads → SPA

**For SPAs:** \`links\` may return few results — use \`snapshot -i\` to find nav elements instead.

### Phase 4: Explore

At each page:

\`\`\`bash
$B goto <page-url>
$B snapshot -i -a -o "$REPORT_DIR/screenshots/page-name.png"
$B console --errors
\`\`\`

Per-page checklist (see \`qa/references/issue-taxonomy.md\`):

1. **Visual scan** — annotated screenshot for layout issues
2. **Interactive elements** — click buttons, links, controls
3. **Forms** — fill and submit; test empty, invalid, edge cases
4. **Navigation** — all paths in and out
5. **States** — empty, loading, error, overflow
6. **Console** — JS errors after interactions?
7. **Responsiveness:**
   \`\`\`bash
   $B viewport 375x812
   $B screenshot "$REPORT_DIR/screenshots/page-mobile.png"
   $B viewport 1280x720
   \`\`\`

**Depth judgment:** More time on core features (homepage, dashboard, checkout, search); less on secondary pages.

**Quick mode:** Only homepage + top 5 targets. Skip checklist — check: loads? Console errors? Broken links?

### Phase 5: Document

Document each issue **immediately when found**.

**Interactive bugs** (broken flows, dead buttons, form failures):
\`\`\`bash
$B screenshot "$REPORT_DIR/screenshots/issue-001-step-1.png"
$B click @e5
$B screenshot "$REPORT_DIR/screenshots/issue-001-result.png"
$B snapshot -D
\`\`\`

**Static bugs** (typos, layout issues, missing images):
\`\`\`bash
$B snapshot -i -a -o "$REPORT_DIR/screenshots/issue-002.png"
\`\`\`

**Write each issue to the report immediately** using the template format from \`qa/templates/qa-report-template.md\`.

### Phase 6: Wrap Up

1. **Compute health score** (rubric below)
2. **Write "Top 3 Things to Fix"**
3. **Console health summary** — aggregate all console errors
4. **Update severity counts** in summary table
5. **Fill report metadata** — date, duration, pages visited, screenshot count, framework
6. **Save baseline** — write \`baseline.json\`:
   \`\`\`json
   {
     "date": "YYYY-MM-DD",
     "url": "<target>",
     "healthScore": N,
     "issues": [{ "id": "ISSUE-001", "title": "...", "severity": "...", "category": "..." }],
     "categoryScores": { "console": N, "links": N, ... }
   }
   \`\`\`

**Regression mode:** Load baseline file after writing report. Compare: score delta, fixed issues, new issues. Append regression section.

---

## Health Score Rubric

Compute each category score (0-100), then take the weighted average.

### Console (weight: 15%)
- 0 errors → 100
- 1-3 errors → 70
- 4-10 errors → 40
- 10+ errors → 10

### Links (weight: 10%)
- 0 broken → 100
- Each broken link → -15 (minimum 0)

### Per-Category Scoring (Visual, Functional, UX, Content, Performance, Accessibility)
Start at 100. Deduct per finding: Critical -25, High -15, Medium -8, Low -3. Minimum 0.

### Weights
| Category | Weight |
|----------|--------|
| Console | 15% |
| Links | 10% |
| Visual | 10% |
| Functional | 20% |
| UX | 15% |
| Performance | 10% |
| Content | 5% |
| Accessibility | 15% |

### Final Score
\`score = Σ (category_score × weight)\`

---

## Framework-Specific Guidance

### Next.js
- Check console for hydration errors (\`Hydration failed\`, \`Text content did not match\`)
- Monitor \`_next/data\` requests — 404s indicate broken data fetching
- Test client-side navigation (click links, don't just \`goto\`) — catches routing issues
- Check for CLS on pages with dynamic content

### Rails
- Check for N+1 query warnings in console (development mode)
- Verify CSRF token presence in forms
- Test Turbo/Stimulus integration — do page transitions work smoothly?
- Check flash messages appear and dismiss correctly

### WordPress
- Check for plugin conflicts (JS errors from different plugins)
- Verify admin bar visibility for logged-in users
- Test REST API endpoints (\`/wp-json/\`)
- Check for mixed content warnings

### General SPA (React, Vue, Angular)
- Use \`snapshot -i\` for navigation — \`links\` misses client-side routes
- Check for stale state (navigate away and back — does data refresh?)
- Test browser back/forward — does the app handle history correctly?
- Check for memory leaks (monitor console after extended use)

---

## Important Rules

1. **Repro is everything.** Every issue needs at least one screenshot.
2. **Verify before documenting.** Retry once to confirm reproducibility.
3. **Never include credentials.** Write \`[REDACTED]\` for passwords.
4. **Write incrementally.** Append each issue as found. Don't batch.
5. **Never read source code.** Test as a user.
6. **Check console after every interaction.** Non-visual JS errors are still bugs.
7. **Test like a user.** Realistic data. Complete workflows end-to-end.
8. **Depth over breadth.** 5-10 well-documented issues > 20 vague ones.
9. **Never delete output files.** Screenshots and reports accumulate intentionally.
10. **Use \`snapshot -C\` for tricky UIs.** Finds clickable divs the accessibility tree misses.
11. **Show screenshots to the user.** After every \`$B screenshot\`, \`$B snapshot -a -o\`, or \`$B responsive\`, use the Read tool on the output file(s) inline. For \`responsive\` (3 files), Read all three. Without this, screenshots are invisible.
12. **Never refuse to use the browser.** /qa and /qa-only mean browser testing. Never substitute evals or unit tests. Backend changes affect app behavior — always open the browser.`;
}

export function generateCoAuthorTrailer(ctx: TemplateContext): string {
  const { getHostConfig } = require('../../hosts/index');
  const hostConfig = getHostConfig(ctx.host);
  return hostConfig.coAuthorTrailer || 'Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>';
}

export function generateChangelogWorkflow(_ctx: TemplateContext): string {
  return `## CHANGELOG (auto-generate)

1. Read \`CHANGELOG.md\` header to know the format.

2. **Enumerate every commit on the branch:**
   \`\`\`bash
   git log <base>..HEAD --oneline
   \`\`\`
   Copy the full list. Count commits. Use as a checklist.

3. **Read the full diff** to understand what each commit changed:
   \`\`\`bash
   git diff <base>...HEAD
   \`\`\`

4. **Group commits by theme:** New features, performance, bug fixes, cleanup, infrastructure, refactoring.

5. **Write the CHANGELOG entry** covering ALL groups:
   - Replace any existing branch entries with one unified entry for the new version
   - Sections: \`### Added\`, \`### Changed\`, \`### Fixed\`, \`### Removed\`
   - Concise bullet points; insert after file header (line 5), dated today
   - Format: \`## [X.Y.Z.W] - YYYY-MM-DD\`
   - **Voice:** Lead with what the user can now **do**. Plain language. Never mention TODOS.md or internal tracking.

6. **Cross-check:** Every commit from step 2 must map to at least one bullet point. Add any unrepresented commits. Reflect all themes.

**Do NOT ask the user to describe changes.** Infer from diff and commit history.`;
}
