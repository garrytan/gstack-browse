import type { TemplateContext } from './types';
import { AI_SLOP_BLACKLIST, OPENAI_HARD_REJECTIONS, OPENAI_LITMUS_CHECKS } from './constants';

export function generateDesignReviewLite(ctx: TemplateContext): string {
  const litmusList = OPENAI_LITMUS_CHECKS.map((item, i) => `${i + 1}. ${item}`).join(' ');
  const rejectionList = OPENAI_HARD_REJECTIONS.map((item, i) => `${i + 1}. ${item}`).join(' ');
  // Codex block only for Claude host
  const codexBlock = ctx.host === 'codex' ? '' : `

7. **Codex design voice** (optional, automatic if available):

\`\`\`bash
which codex 2>/dev/null && echo "CODEX_AVAILABLE" || echo "CODEX_NOT_AVAILABLE"
\`\`\`

If available, run a lightweight design check on the diff:

\`\`\`bash
TMPERR_DRL=$(mktemp /tmp/codex-drl-XXXXXXXX)
_REPO_ROOT=$(git rev-parse --show-toplevel) || { echo "ERROR: not in a git repo" >&2; exit 1; }
codex exec "Review the git diff on this branch. Run 7 litmus checks (YES/NO each): ${litmusList} Flag any hard rejections: ${rejectionList} 5 most important design findings only. Reference file:line." -C "$_REPO_ROOT" -s read-only -c 'model_reasoning_effort="high"' --enable web_search_cached 2>"$TMPERR_DRL"
\`\`\`

Use a 5-minute timeout (\`timeout: 300000\`). After completion, read stderr:
\`\`\`bash
cat "$TMPERR_DRL" && rm -f "$TMPERR_DRL"
\`\`\`

**Error handling:** All errors are non-blocking. On auth failure, timeout, or empty response — skip with a brief note and continue.

Present Codex output under a \`CODEX (design):\` header, merged with checklist findings above.`;

  return `## Design Review (conditional, diff-scoped)

Check if diff touches frontend files via \`gstack-diff-scope\`:

\`\`\`bash
source <(${ctx.paths.binDir}/gstack-diff-scope <base> 2>/dev/null)
\`\`\`

**If \`SCOPE_FRONTEND=false\`:** Skip silently.

**If \`SCOPE_FRONTEND=true\`:**

1. **Check for DESIGN.md.** If \`DESIGN.md\` or \`design-system.md\` exists in repo root, read it. Patterns blessed in DESIGN.md are not flagged. If absent, use universal design principles.

2. **Read \`.claude/skills/review/design-checklist.md\`.** If unreadable, skip with: "Design checklist not found — skipping design review."

3. **Read each changed frontend file** (full file, not just diff hunks).

4. **Apply the design checklist** against changed files. Per item:
   - **[HIGH] mechanical CSS fix** (\`outline: none\`, \`!important\`, \`font-size < 16px\`): AUTO-FIX
   - **[HIGH/MEDIUM] design judgment needed**: ASK
   - **[LOW] intent-based detection**: "Possible — verify visually or run /design-review"

5. **Include findings** under a "Design Review" header. Merge with code review findings into Fix-First flow.

6. **Log result** for Review Readiness Dashboard:

\`\`\`bash
${ctx.paths.binDir}/gstack-review-log '{"skill":"design-review-lite","timestamp":"TIMESTAMP","status":"STATUS","findings":N,"auto_fixed":M,"commit":"COMMIT"}'
\`\`\`

Substitute: TIMESTAMP = ISO 8601, STATUS = "clean" or "issues_found", N = total findings, M = auto-fixed, COMMIT = \`git rev-parse --short HEAD\`.${codexBlock}`;
}

// NOTE: design-checklist.md is a subset of this methodology for code-level detection.
// When adding items here, also update review/design-checklist.md, and vice versa.
export function generateDesignMethodology(_ctx: TemplateContext): string {
  return `## Modes

### Full (default)
Review all pages reachable from homepage (5-8 pages). Full checklist, responsive screenshots, interaction flow testing. Produces complete audit report with letter grades.

### Quick (\`--quick\`)
Homepage + 2 key pages. First Impression + Design System Extraction + abbreviated checklist. Fastest path to a design score.

### Deep (\`--deep\`)
10-15 pages, every interaction flow, exhaustive checklist. For pre-launch audits or major redesigns.

### Diff-aware (automatic on feature branch with no URL)
1. Analyze branch diff: \`git diff main...HEAD --name-only\`
2. Map changed files to affected pages/routes
3. Detect running app on common local ports (3000, 4000, 8080)
4. Audit only affected pages, compare design quality before/after

### Regression (\`--regression\` or previous \`design-baseline.json\` found)
Run full audit, load previous \`design-baseline.json\`. Compare per-category grade deltas, new findings, resolved findings. Output regression table in report.

---

## Phase 1: First Impression

Form a gut reaction before analyzing anything.

1. Navigate to the target URL
2. Take a full-page desktop screenshot: \`$B screenshot "$REPORT_DIR/screenshots/first-impression.png"\`
3. Write the **First Impression** using this format:
   - "The site communicates **[what]**."
   - "I notice **[observation]**."
   - "The first 3 things my eye goes to: **[1]**, **[2]**, **[3]**."
   - "If I had to describe this in one word: **[word]**."

Be opinionated. A designer reacts, doesn't hedge.

---

## Phase 2: Design System Extraction

Extract the actual rendered design system (not what DESIGN.md says):

\`\`\`bash
# Fonts in use (capped at 500 elements to avoid timeout)
$B js "JSON.stringify([...new Set([...document.querySelectorAll('*')].slice(0,500).map(e => getComputedStyle(e).fontFamily))])"

# Color palette in use
$B js "JSON.stringify([...new Set([...document.querySelectorAll('*')].slice(0,500).flatMap(e => [getComputedStyle(e).color, getComputedStyle(e).backgroundColor]).filter(c => c !== 'rgba(0, 0, 0, 0)'))])"

# Heading hierarchy
$B js "JSON.stringify([...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => ({tag:h.tagName, text:h.textContent.trim().slice(0,50), size:getComputedStyle(h).fontSize, weight:getComputedStyle(h).fontWeight})))"

# Touch target audit (find undersized interactive elements)
$B js "JSON.stringify([...document.querySelectorAll('a,button,input,[role=button]')].filter(e => {const r=e.getBoundingClientRect(); return r.width>0 && (r.width<44||r.height<44)}).map(e => ({tag:e.tagName, text:(e.textContent||'').trim().slice(0,30), w:Math.round(e.getBoundingClientRect().width), h:Math.round(e.getBoundingClientRect().height)})).slice(0,20))"

# Performance baseline
$B perf
\`\`\`

Structure as **Inferred Design System**:
- **Fonts:** list with usage counts. Flag if >3 distinct families.
- **Colors:** extracted palette. Flag if >12 unique non-gray colors.
- **Heading Scale:** h1-h6 sizes. Flag skipped levels or non-systematic jumps.
- **Spacing Patterns:** sample padding/margin values. Flag non-scale values.

Offer: *"Want me to save this as your DESIGN.md?"*

---

## Phase 3: Page-by-Page Visual Audit

For each page in scope:

\`\`\`bash
$B goto <url>
$B snapshot -i -a -o "$REPORT_DIR/screenshots/{page}-annotated.png"
$B responsive "$REPORT_DIR/screenshots/{page}"
$B console --errors
$B perf
\`\`\`

### Auth Detection

After first navigation:
\`\`\`bash
$B url
\`\`\`
If URL contains \`/login\`, \`/signin\`, \`/auth\`, or \`/sso\`: AskUserQuestion: "Site requires auth. Run \`/setup-browser-cookies\` first if needed."

### Design Audit Checklist (10 categories, ~80 items)

Apply at each page. Each finding gets impact (high/medium/polish) and category.

**1. Visual Hierarchy & Composition** (8 items)
- Clear focal point? One primary CTA per view?
- Eye flows naturally top-left to bottom-right?
- Visual noise — competing elements?
- Information density appropriate?
- Z-index clarity — nothing unexpectedly overlapping?
- Above-fold content communicates purpose in 3 seconds?
- Squint test: hierarchy visible when blurred?
- White space intentional, not leftover?

**2. Typography** (15 items)
- Font count <=3
- Scale follows ratio (1.25 major third or 1.333 perfect fourth)
- Line-height: 1.5x body, 1.15-1.25x headings
- Measure: 45-75 chars per line (66 ideal)
- Heading hierarchy: no skipped levels
- Weight contrast: >=2 weights for hierarchy
- No blacklisted fonts (Papyrus, Comic Sans, Lobster, Impact, Jokerman)
- Inter/Roboto/Open Sans/Poppins → flag as potentially generic
- \`text-wrap: balance\` or \`text-pretty\` on headings
- Curly quotes, not straight quotes
- Ellipsis (\`…\`), not three dots (\`...\`)
- \`font-variant-numeric: tabular-nums\` on number columns
- Body text >= 16px
- Caption/label >= 12px
- No letterspacing on lowercase text

**3. Color & Contrast** (10 items)
- Palette coherent (<=12 unique non-gray colors)
- WCAG AA: body 4.5:1, large text 3:1, UI components 3:1
- Semantic colors consistent (success=green, error=red, warning=amber)
- No color-only encoding
- Dark mode: elevation surfaces, not lightness inversion
- Dark mode: text off-white (~#E0E0E0), not pure white
- Primary accent desaturated 10-20% in dark mode
- \`color-scheme: dark\` on html element
- No red/green-only combinations
- Neutral palette warm or cool consistently

**4. Spacing & Layout** (12 items)
- Grid consistent at all breakpoints
- Spacing uses a scale (4px or 8px base)
- Alignment consistent — nothing floats outside grid
- Rhythm: related items closer, distinct sections further
- Border-radius hierarchy (not uniform bubbly radius)
- Inner radius = outer radius - gap
- No horizontal scroll on mobile
- Max content width set
- \`env(safe-area-inset-*)\` for notch devices
- URL reflects state (filters, tabs, pagination in query params)
- Flex/grid for layout (not JS measurement)
- Breakpoints: mobile (375), tablet (768), desktop (1024), wide (1440)

**5. Interaction States** (10 items)
- Hover state on all interactive elements
- \`focus-visible\` ring present (never \`outline: none\` without replacement)
- Active/pressed state with depth or color shift
- Disabled: reduced opacity + \`cursor: not-allowed\`
- Loading: skeleton shapes match real content layout
- Empty states: warm message + primary action + visual
- Error messages: specific + include fix/next step
- Success: confirmation animation or color, auto-dismiss
- Touch targets >= 44px
- \`cursor: pointer\` on all clickable elements

**6. Responsive Design** (8 items)
- Mobile layout makes design sense (not just stacked desktop columns)
- Touch targets >= 44px on mobile
- No horizontal scroll on any viewport
- Images responsive (srcset, sizes, or CSS containment)
- Body text >= 16px on mobile
- Navigation collapses appropriately
- Forms usable on mobile (correct input types, no autoFocus on mobile)
- No \`user-scalable=no\` or \`maximum-scale=1\` in viewport meta

**7. Motion & Animation** (6 items)
- Easing: ease-out entering, ease-in exiting, ease-in-out moving
- Duration: 50-700ms (nothing slower unless page transition)
- Every animation communicates something
- \`prefers-reduced-motion\` respected
- No \`transition: all\`
- Only \`transform\` and \`opacity\` animated

**8. Content & Microcopy** (8 items)
- Empty states: warmth + action + illustration/icon
- Error messages: what happened + why + what to do
- Button labels specific ("Save API Key" not "Submit")
- No placeholder/lorem ipsum visible
- Truncation handled (\`text-overflow\`, \`line-clamp\`, or \`break-words\`)
- Active voice
- Loading states end with \`…\`
- Destructive actions have confirmation or undo

**9. AI Slop Detection** (10 anti-patterns — the blacklist)

Would a human designer at a respected studio ever ship this?

${AI_SLOP_BLACKLIST.map(item => `- ${item}`).join('\n')}

**10. Performance as Design** (6 items)
- LCP < 2.0s (web apps), < 1.5s (informational sites)
- CLS < 0.1
- Skeleton shapes match real content, shimmer animation
- Images: \`loading="lazy"\`, width/height set, WebP/AVIF
- Fonts: \`font-display: swap\`, preconnect to CDN origins
- No visible FOUT — critical fonts preloaded

---

## Phase 4: Interaction Flow Review

Walk 2-3 key user flows, evaluate feel not just function:

\`\`\`bash
$B snapshot -i
$B click @e3           # perform action
$B snapshot -D          # diff to see what changed
\`\`\`

Evaluate:
- **Response feel:** Responsive clicks? Missing loading states?
- **Transition quality:** Intentional or generic/absent?
- **Feedback clarity:** Action clearly succeeded or failed? Immediate?
- **Form polish:** Focus states visible? Validation timing correct? Errors near source?

---

## Phase 5: Cross-Page Consistency

Compare screenshots across pages:
- Navigation bar consistent?
- Footer consistent?
- Component reuse vs one-off designs?
- Tone consistent across pages?
- Spacing rhythm carries across pages?

---

## Phase 6: Compile Report

### Output Locations

**Local:** \`.gstack/design-reports/design-audit-{domain}-{YYYY-MM-DD}.md\`

**Project-scoped:**
\`\`\`bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)" && mkdir -p ~/.gstack/projects/$SLUG
\`\`\`
Write to: \`~/.gstack/projects/{slug}/{user}-{branch}-design-audit-{datetime}.md\`

**Baseline:** Write \`design-baseline.json\` for regression mode:
\`\`\`json
{
  "date": "YYYY-MM-DD",
  "url": "<target>",
  "designScore": "B",
  "aiSlopScore": "C",
  "categoryGrades": { "hierarchy": "A", "typography": "B", ... },
  "findings": [{ "id": "FINDING-001", "title": "...", "impact": "high", "category": "typography" }]
}
\`\`\`

### Scoring System

**Dual headline scores:**
- **Design Score: {A-F}** — weighted average of all 10 categories
- **AI Slop Score: {A-F}** — standalone grade with pithy verdict

**Per-category grades:**
- **A:** Intentional, polished, delightful.
- **B:** Solid fundamentals, minor inconsistencies.
- **C:** Functional but generic. No design point of view.
- **D:** Noticeable problems. Feels unfinished.
- **F:** Actively hurting UX. Needs significant rework.

**Grade computation:** Each category starts at A. High-impact finding = -1 letter grade. Medium-impact = -0.5. Polish findings noted but don't affect grade. Minimum F.

**Category weights:**
| Category | Weight |
|----------|--------|
| Visual Hierarchy | 15% |
| Typography | 15% |
| Spacing & Layout | 15% |
| Color & Contrast | 10% |
| Interaction States | 10% |
| Responsive | 10% |
| Content Quality | 10% |
| AI Slop | 5% |
| Motion | 5% |
| Performance Feel | 5% |

AI Slop is 5% of Design Score but also graded independently as a headline metric.

### Regression Output

When previous \`design-baseline.json\` exists or \`--regression\` used:
- Load baseline grades
- Compare per-category deltas, new findings, resolved findings
- Append regression table to report

---

## Design Critique Format

Structured feedback, not opinions:
- "I notice..." — observation
- "I wonder..." — question
- "What if..." — suggestion
- "I think... because..." — reasoned opinion

Tie everything to user goals. Always suggest specific improvements alongside problems.

---

## Important Rules

1. **Think like a designer, not QA.** Care whether things feel right and look intentional.
2. **Screenshots are evidence.** Every finding needs at least one screenshot.
3. **Be specific and actionable.** "Change X to Y because Z" — not "the spacing feels off."
4. **Never read source code.** Evaluate the rendered site. (Exception: offer to write DESIGN.md from extracted observations.)
5. **AI Slop detection is your superpower.** Be direct about AI-generated patterns.
6. **Quick wins matter.** Always include 3-5 highest-impact fixes that take <30 minutes each.
7. **Use \`snapshot -C\` for tricky UIs.** Finds clickable divs the accessibility tree misses.
8. **Responsive is design, not just "not broken."** Evaluate whether mobile layout makes design sense.
9. **Document incrementally.** Write each finding to the report as you find it.
10. **Depth over breadth.** 5-10 well-documented findings > 20 vague observations.
11. **Show screenshots to the user.** After every \`$B screenshot\`, \`$B snapshot -a -o\`, or \`$B responsive\`, Read the output file(s) inline. For \`responsive\` (3 files), Read all three.`;
}

export function generateDesignSketch(_ctx: TemplateContext): string {
  return `## Visual Sketch (UI ideas only)

If the chosen approach involves user-facing UI, generate a rough wireframe. Skip silently for backend-only or infrastructure work.

**Step 1: Gather design context**

1. Check if \`DESIGN.md\` exists in repo root. If so, read it for design constraints. Apply:
   - **Information hierarchy** — what does the user see first, second, third?
   - **Interaction states** — loading, empty, error, success, partial
   - **Edge case paranoia** — 47-char names? Zero results? Network fails?
   - **Subtraction default** — every element earns its pixels.
   - **Design for trust** — every element builds or erodes user trust.

**Step 2: Generate wireframe HTML**

Single-page HTML with these constraints:
- **Rough aesthetic** — system fonts, thin gray borders, no color. This is a sketch.
- Self-contained — no external dependencies, inline CSS only
- Show core interaction flow (1-3 screens/states max)
- Realistic placeholder content (not Lorem ipsum)
- HTML comments explaining design decisions

Write to a temp file:
\`\`\`bash
SKETCH_FILE="/tmp/gstack-sketch-$(date +%s).html"
\`\`\`

**Step 3: Render and capture**

\`\`\`bash
$B goto "file://$SKETCH_FILE"
$B screenshot /tmp/gstack-sketch.png
\`\`\`

If \`$B\` is unavailable, skip render and tell user: "Visual sketch requires the browse binary. Run the setup script to enable it."

**Step 4: Present and iterate**

Show screenshot. Ask: "Does this feel right? Want to iterate on the layout?"

Regenerate with feedback if requested. Proceed when approved.

**Step 5: Include in design doc**

Reference wireframe screenshot in the "Recommended Approach" section. The file at \`/tmp/gstack-sketch.png\` is available to downstream skills (\`/plan-design-review\`, \`/design-review\`).

**Step 6: Outside design voices** (optional)

\`\`\`bash
which codex 2>/dev/null && echo "CODEX_AVAILABLE" || echo "CODEX_NOT_AVAILABLE"
\`\`\`

If Codex is available, use AskUserQuestion:
> "Want outside design perspectives? Codex proposes a visual thesis and interaction ideas. A Claude subagent proposes an alternative aesthetic direction."
>
> A) Yes — get outside design voices
> B) No — proceed without

If user chooses A, launch both simultaneously:

1. **Codex** (via Bash, \`model_reasoning_effort="medium"\`):
\`\`\`bash
TMPERR_SKETCH=$(mktemp /tmp/codex-sketch-XXXXXXXX)
_REPO_ROOT=$(git rev-parse --show-toplevel) || { echo "ERROR: not in a git repo" >&2; exit 1; }
codex exec "For this product approach, provide: a visual thesis (one sentence — mood, material, energy), a content plan (hero → support → detail → CTA), and 2 interaction ideas that change page feel. Apply beautiful defaults: composition-first, brand-first, cardless, poster not document. Be opinionated." -C "$_REPO_ROOT" -s read-only -c 'model_reasoning_effort="medium"' --enable web_search_cached 2>"$TMPERR_SKETCH"
\`\`\`
5-minute timeout (\`timeout: 300000\`). After completion: \`cat "$TMPERR_SKETCH" && rm -f "$TMPERR_SKETCH"\`

2. **Claude subagent** (via Agent tool):
"For this product approach, what design direction would you recommend? What aesthetic, typography, and interaction patterns fit? What would make this feel inevitable? Specific — font names, hex colors, spacing values."

Present Codex output under \`CODEX SAYS (design sketch):\` and subagent output under \`CLAUDE SUBAGENT (design direction):\`.
Error handling: all non-blocking. On failure, skip and continue.`;
}

export function generateDesignOutsideVoices(ctx: TemplateContext): string {
  // Codex host: strip entirely — Codex should never invoke itself
  if (ctx.host === 'codex') return '';

  const rejectionList = OPENAI_HARD_REJECTIONS.map((item, i) => `${i + 1}. ${item}`).join('\n');
  const litmusList = OPENAI_LITMUS_CHECKS.map((item, i) => `${i + 1}. ${item}`).join('\n');

  // Skill-specific configuration
  const isPlanDesignReview = ctx.skillName === 'plan-design-review';
  const isDesignReview = ctx.skillName === 'design-review';
  const isDesignConsultation = ctx.skillName === 'design-consultation';

  // Determine opt-in behavior and reasoning effort
  const isAutomatic = isDesignReview; // design-review runs automatically
  const reasoningEffort = isDesignConsultation ? 'medium' : 'high'; // creative vs analytical

  // Build skill-specific Codex prompt
  let codexPrompt: string;
  let subagentPrompt: string;

  if (isPlanDesignReview) {
    codexPrompt = `Read the plan file at [plan-file-path]. Evaluate this plan's UI/UX design against these criteria.

HARD REJECTION — flag if ANY apply:
${rejectionList}

LITMUS CHECKS — answer YES or NO for each:
${litmusList}

HARD RULES — classify as MARKETING/LANDING PAGE vs APP UI vs HYBRID, then flag violations:
- MARKETING: First viewport as one composition, brand-first hierarchy, full-bleed hero, 2-3 intentional motions, composition-first layout
- APP UI: Calm surface hierarchy, dense but readable, utility language, minimal chrome
- UNIVERSAL: CSS variables for colors, no default font stacks, one job per section, cards earn existence

Per finding: what's wrong, what ships unresolved, specific fix. Be opinionated. No hedging.`;

    subagentPrompt = `Read the plan file at [plan-file-path]. Independent senior product designer review. You have NOT seen any prior review. Evaluate:

1. Information hierarchy: what does the user see first, second, third? Is it right?
2. Missing states: loading, empty, error, success, partial — which are unspecified?
3. User journey: emotional arc? Where does it break?
4. Specificity: SPECIFIC UI ("48px Söhne Bold, #1a1a1a") or generic patterns ("clean card layout")?
5. What design decisions will haunt the implementer if left ambiguous?

Per finding: what's wrong, severity (critical/high/medium), fix.`;
  } else if (isDesignReview) {
    codexPrompt = `Review the frontend source code in this repo. Evaluate against design hard rules:
- Spacing: systematic tokens or magic numbers?
- Typography: expressive purposeful fonts or default stacks?
- Color: CSS variables or hardcoded hex scattered?
- Responsive: breakpoints defined? calc(100svh - header)? Mobile tested?
- A11y: ARIA landmarks, alt text, contrast, 44px touch targets?
- Motion: 2-3 intentional animations, or zero/ornamental?
- Cards: only when card IS the interaction?

Classify as MARKETING/LANDING PAGE vs APP UI vs HYBRID, then apply matching rules.

LITMUS CHECKS — answer YES/NO:
${litmusList}

HARD REJECTION — flag if ANY apply:
${rejectionList}

Be specific. Reference file:line for every finding.`;

    subagentPrompt = `Review the frontend source code. Independent senior product designer, source-code design audit. Focus on CONSISTENCY PATTERNS across files:
- Spacing values systematic across codebase?
- ONE color system or scattered approaches?
- Consistent responsive breakpoint set?
- Accessibility approach consistent or spotty?

Per finding: what's wrong, severity (critical/high/medium), file:line.`;
  } else if (isDesignConsultation) {
    codexPrompt = `Given this product context, propose a complete design direction:
- Visual thesis: one sentence — mood, material, energy
- Typography: specific font names (not Inter/Roboto/Arial/system) + hex colors
- Color system: CSS variables for background, surface, primary text, muted text, accent
- Layout: composition-first, not component-first. First viewport as poster, not document
- Differentiation: 2 deliberate departures from category norms
- Anti-slop: no purple gradients, no 3-column icon grids, no centered everything, no decorative blobs

Be opinionated. Be specific. Own it.`;

    subagentPrompt = `Given this product context, propose a design direction that would SURPRISE. What would the cool indie studio do?
- Aesthetic direction, typography stack (specific font names), color palette (hex values)
- 2 deliberate departures from category norms
- Emotional reaction in the first 3 seconds?

Bold. Specific. No hedging.`;
  } else {
    // Unknown skill — return empty
    return '';
  }

  // Build the opt-in section
  const optInSection = isAutomatic ? `
**Automatic:** Outside voices run automatically when Codex is available.` : `
Use AskUserQuestion:
> "Want outside design voices${isPlanDesignReview ? ' before the detailed review' : ''}? Codex evaluates against OpenAI's design hard rules + litmus checks; Claude subagent does an independent ${isDesignConsultation ? 'design direction proposal' : 'completeness review'}."
>
> A) Yes — run outside design voices
> B) No — proceed without

If user chooses B, skip and continue.`;

  // Build the synthesis section
  const synthesisSection = isPlanDesignReview ? `
**Synthesis — Litmus scorecard:**

\`\`\`
DESIGN OUTSIDE VOICES — LITMUS SCORECARD:
═══════════════════════════════════════════════════════════════
  Check                                    Claude  Codex  Consensus
  ─────────────────────────────────────── ─────── ─────── ─────────
  1. Brand unmistakable in first screen?   —       —      —
  2. One strong visual anchor?             —       —      —
  3. Scannable by headlines only?          —       —      —
  4. Each section has one job?             —       —      —
  5. Cards actually necessary?             —       —      —
  6. Motion improves hierarchy?            —       —      —
  7. Premium without decorative shadows?   —       —      —
  ─────────────────────────────────────── ─────── ─────── ─────────
  Hard rejections triggered:               —       —      —
═══════════════════════════════════════════════════════════════
\`\`\`

Fill each cell from Codex and subagent outputs. CONFIRMED = both agree. DISAGREE = models differ. NOT SPEC'D = insufficient info.

**Pass integration (respects existing 7-pass contract):**
- Hard rejections → first items in Pass 1, tagged \`[HARD REJECTION]\`
- Litmus DISAGREE → raised in relevant pass with both perspectives
- Litmus CONFIRMED failures → pre-loaded as known issues in relevant pass
- Passes can skip discovery and go straight to fixing for pre-identified issues` :
    isDesignConsultation ? `
**Synthesis:** Claude main references both Codex and subagent proposals in Phase 3. Present:
- Agreement between all three voices
- Genuine divergences as creative alternatives
- "Codex and I agree on X. Codex suggested Y where I'm proposing Z — here's why..."` : `
**Synthesis — Litmus scorecard:**

Use the same scorecard format as /plan-design-review. Fill in from both outputs.
Merge findings into triage with \`[codex]\` / \`[subagent]\` / \`[cross-model]\` tags.`;

  const escapedCodexPrompt = codexPrompt.replace(/`/g, '\\`').replace(/\$/g, '\\$');

  return `## Design Outside Voices (parallel)
${optInSection}

**Check Codex availability:**
\`\`\`bash
which codex 2>/dev/null && echo "CODEX_AVAILABLE" || echo "CODEX_NOT_AVAILABLE"
\`\`\`

**If Codex is available**, launch both voices simultaneously:

1. **Codex design voice** (via Bash):
\`\`\`bash
TMPERR_DESIGN=$(mktemp /tmp/codex-design-XXXXXXXX)
_REPO_ROOT=$(git rev-parse --show-toplevel) || { echo "ERROR: not in a git repo" >&2; exit 1; }
codex exec "${escapedCodexPrompt}" -C "$_REPO_ROOT" -s read-only -c 'model_reasoning_effort="${reasoningEffort}"' --enable web_search_cached 2>"$TMPERR_DESIGN"
\`\`\`
5-minute timeout (\`timeout: 300000\`). After completion:
\`\`\`bash
cat "$TMPERR_DESIGN" && rm -f "$TMPERR_DESIGN"
\`\`\`

2. **Claude design subagent** (via Agent tool):
"${subagentPrompt}"

**Error handling (all non-blocking):**
- **Auth failure** (stderr contains "auth", "login", "unauthorized", "API key"): "Codex auth failed. Run \`codex login\`."
- **Timeout:** "Codex timed out after 5 minutes."
- **Empty response:** "Codex returned no response."
- On any Codex error: proceed with subagent only, tagged \`[single-model]\`.
- If subagent also fails: "Outside voices unavailable — continuing with primary review."

Present Codex output under \`CODEX SAYS (design ${isPlanDesignReview ? 'critique' : isDesignReview ? 'source audit' : 'direction'}):\`.
Present subagent output under \`CLAUDE SUBAGENT (design ${isPlanDesignReview ? 'completeness' : isDesignReview ? 'consistency' : 'direction'}):\`.
${synthesisSection}

**Log the result:**
\`\`\`bash
${ctx.paths.binDir}/gstack-review-log '{"skill":"design-outside-voices","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","status":"STATUS","source":"SOURCE","commit":"'"$(git rev-parse --short HEAD)"'"}'
\`\`\`
Replace STATUS with "clean" or "issues_found", SOURCE with "codex+subagent", "codex-only", "subagent-only", or "unavailable".`;
}

// ─── Design Hard Rules (OpenAI framework + gstack slop blacklist) ───
export function generateDesignHardRules(_ctx: TemplateContext): string {
  const slopItems = AI_SLOP_BLACKLIST.map((item, i) => `${i + 1}. ${item}`).join('\n');
  const rejectionItems = OPENAI_HARD_REJECTIONS.map((item, i) => `${i + 1}. ${item}`).join('\n');
  const litmusItems = OPENAI_LITMUS_CHECKS.map((item, i) => `${i + 1}. ${item}`).join('\n');

  return `### Design Hard Rules

**Classifier — determine rule set before evaluating:**
- **MARKETING/LANDING PAGE** (hero-driven, brand-forward, conversion-focused) → Landing Page Rules
- **APP UI** (workspace-driven, data-dense, task-focused) → App UI Rules
- **HYBRID** → Landing Page Rules to hero/marketing sections, App UI Rules to functional sections

**Hard rejection criteria** (instant-fail — flag if ANY apply):
${rejectionItems}

**Litmus checks** (YES/NO each — used for cross-model consensus scoring):
${litmusItems}

**Landing page rules** (classifier = MARKETING/LANDING):
- First viewport as one composition, not a dashboard
- Brand-first hierarchy: brand > headline > body > CTA
- Typography: expressive, purposeful — no default stacks (Inter, Roboto, Arial, system)
- No flat single-color backgrounds
- Hero: full-bleed, edge-to-edge, no inset/tiled/rounded variants
- Hero budget: brand, one headline, one supporting sentence, one CTA group, one image
- No cards in hero. Cards only when card IS the interaction
- One job per section
- Motion: 2-3 intentional motions minimum
- Color: CSS variables, avoid purple-on-white defaults, one accent default
- Copy: product language. "If deleting 30% improves it, keep deleting"
- Beautiful defaults: composition-first, brand as loudest text, two typefaces max, cardless, first viewport as poster

**App UI rules** (classifier = APP UI):
- Calm surface hierarchy, strong typography, few colors
- Dense but readable, minimal chrome
- Organize: primary workspace, navigation, secondary context, one accent
- Avoid: dashboard-card mosaics, thick borders, decorative gradients, ornamental icons
- Copy: utility language — orientation, status, action
- Cards only when card IS the interaction
- Section headings state what area is or what user can do

**Universal rules** (ALL types):
- CSS variables for color system
- No default font stacks
- One job per section
- "If deleting 30% of copy improves it, keep deleting"
- Cards earn their existence

**AI Slop blacklist** (10 patterns that scream "AI-generated"):
${slopItems}

Source: [OpenAI "Designing Delightful Frontends with GPT-5.4"](https://developers.openai.com/blog/designing-delightful-frontends-with-gpt-5-4) (Mar 2026) + gstack design methodology.`;
}

export function generateDesignSetup(ctx: TemplateContext): string {
  return `## DESIGN SETUP (run BEFORE any design mockup command)

\`\`\`bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
D=""
[ -n "$_ROOT" ] && [ -x "$_ROOT/${ctx.paths.localSkillRoot}/design/dist/design" ] && D="$_ROOT/${ctx.paths.localSkillRoot}/design/dist/design"
[ -z "$D" ] && D=${ctx.paths.designDir}/design
if [ -x "$D" ]; then
  echo "DESIGN_READY: $D"
else
  echo "DESIGN_NOT_AVAILABLE"
fi
B=""
[ -n "$_ROOT" ] && [ -x "$_ROOT/${ctx.paths.localSkillRoot}/browse/dist/browse" ] && B="$_ROOT/${ctx.paths.localSkillRoot}/browse/dist/browse"
[ -z "$B" ] && B=${ctx.paths.browseDir}/browse
if [ -x "$B" ]; then
  echo "BROWSE_READY: $B"
else
  echo "BROWSE_NOT_AVAILABLE (will use 'open' to view comparison boards)"
fi
\`\`\`

**If \`DESIGN_NOT_AVAILABLE\`:** Fall back to HTML wireframe approach (\`DESIGN_SKETCH\`). Visual mockups are progressive enhancement, not required.

**If \`BROWSE_NOT_AVAILABLE\`:** Use \`open file://...\` instead of \`$B goto\` to open comparison boards.

**If \`DESIGN_READY\`:** Design binary available. Commands:
- \`$D generate --brief "..." --output /path.png\` — generate single mockup
- \`$D variants --brief "..." --count 3 --output-dir /path/\` — generate N style variants
- \`$D compare --images "a.png,b.png,c.png" --output /path/board.html --serve\` — comparison board + HTTP server
- \`$D serve --html /path/board.html\` — serve comparison board, collect feedback via HTTP
- \`$D check --image /path.png --brief "..."\` — vision quality gate
- \`$D iterate --session /path/session.json --feedback "..." --output /path.png\` — iterate

**CRITICAL PATH RULE:** All design artifacts MUST be saved to \`~/.gstack/projects/$SLUG/designs/\`. NEVER to \`.context/\`, \`docs/designs/\`, \`/tmp/\`, or project-local directories. Design artifacts are USER data — they persist across branches, conversations, and workspaces.`;
}

export function generateDesignMockup(ctx: TemplateContext): string {
  return `## Visual Design Exploration

\`\`\`bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
D=""
[ -n "$_ROOT" ] && [ -x "$_ROOT/${ctx.paths.localSkillRoot}/design/dist/design" ] && D="$_ROOT/${ctx.paths.localSkillRoot}/design/dist/design"
[ -z "$D" ] && D=${ctx.paths.designDir}/design
[ -x "$D" ] && echo "DESIGN_READY" || echo "DESIGN_NOT_AVAILABLE"
\`\`\`

**If \`DESIGN_NOT_AVAILABLE\`:** Fall back to HTML wireframe approach (DESIGN_SKETCH section).

**If \`DESIGN_READY\`:** Generate visual mockup explorations. (Say "skip" if you don't need visuals.)

**Step 1: Set up design directory**

\`\`\`bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)"
_DESIGN_DIR=~/.gstack/projects/$SLUG/designs/mockup-$(date +%Y%m%d)
mkdir -p "$_DESIGN_DIR"
echo "DESIGN_DIR: $_DESIGN_DIR"
\`\`\`

**Step 2: Construct design brief**

Read DESIGN.md if it exists — use it to constrain visual style. If absent, explore wide.

**Step 3: Generate 3 variants**

\`\`\`bash
$D variants --brief "<assembled brief>" --count 3 --output-dir "$_DESIGN_DIR/"
\`\`\`

Generates 3 style variations (~40 seconds total).

**Step 4: Show variants inline, then open comparison board**

Read the PNGs with Read tool first, then create and serve the comparison board:

\`\`\`bash
$D compare --images "$_DESIGN_DIR/variant-A.png,$_DESIGN_DIR/variant-B.png,$_DESIGN_DIR/variant-C.png" --output "$_DESIGN_DIR/design-board.html" --serve
\`\`\`

Opens in user's default browser and blocks until feedback received. Read stdout for structured JSON. No polling needed.

If \`$D serve\` fails, fall back to AskUserQuestion: "I've opened the design board. Which variant do you prefer?"

**Step 5: Handle feedback**

If JSON contains \`"regenerated": true\`:
1. Read \`regenerateAction\` (or \`remixSpec\` for remix requests)
2. Generate new variants with \`$D iterate\` or \`$D variants\`
3. Create new board with \`$D compare\`
4. POST to running server: \`curl -X POST http://localhost:PORT/api/reload -H 'Content-Type: application/json' -d '{"html":"$_DESIGN_DIR/design-board.html"}'\`
   (parse port from stderr: \`SERVE_STARTED: port=XXXXX\`)
5. Board auto-refreshes in same tab

If \`"regenerated": false\`: proceed with approved variant.

**Step 6: Save approved choice**

\`\`\`bash
echo '{"approved_variant":"<VARIANT>","feedback":"<FEEDBACK>","date":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","screen":"mockup","branch":"'$(git branch --show-current 2>/dev/null)'"}' > "$_DESIGN_DIR/approved.json"
\`\`\`

Reference saved mockup in design doc or plan.`;
}

export function generateDesignShotgunLoop(_ctx: TemplateContext): string {
  return `### Comparison Board + Feedback Loop

Create the comparison board and serve over HTTP:

\`\`\`bash
$D compare --images "$_DESIGN_DIR/variant-A.png,$_DESIGN_DIR/variant-B.png,$_DESIGN_DIR/variant-C.png" --output "$_DESIGN_DIR/design-board.html" --serve
\`\`\`

Generates board HTML, starts HTTP server on random port, opens in user's browser. **Run in background** with \`&\` — server must stay running during user interaction.

Parse port from stderr: \`SERVE_STARTED: port=XXXXX\`. Needed for board URL and reload during regeneration.

**PRIMARY WAIT: AskUserQuestion with board URL**

After board is serving, use AskUserQuestion:

"I've opened a comparison board:
http://127.0.0.1:<PORT>/ — Rate variants, leave comments, remix elements, click Submit when done. Let me know when submitted (or paste preferences here). If you clicked Regenerate or Remix, tell me."

**Do NOT use AskUserQuestion to ask which variant the user prefers.** The comparison board IS the chooser.

**After user responds:**

Check for feedback files:
- \`$_DESIGN_DIR/feedback.json\` — written on Submit (final choice)
- \`$_DESIGN_DIR/feedback-pending.json\` — written on Regenerate/Remix/More Like This

\`\`\`bash
if [ -f "$_DESIGN_DIR/feedback.json" ]; then
  echo "SUBMIT_RECEIVED"
  cat "$_DESIGN_DIR/feedback.json"
elif [ -f "$_DESIGN_DIR/feedback-pending.json" ]; then
  echo "REGENERATE_RECEIVED"
  cat "$_DESIGN_DIR/feedback-pending.json"
  rm "$_DESIGN_DIR/feedback-pending.json"
else
  echo "NO_FEEDBACK_FILE"
fi
\`\`\`

Feedback JSON shape:
\`\`\`json
{
  "preferred": "A",
  "ratings": { "A": 4, "B": 3, "C": 2 },
  "comments": { "A": "Love the spacing" },
  "overall": "Go with A, bigger CTA",
  "regenerated": false
}
\`\`\`

**If \`feedback.json\`:** User clicked Submit. Read \`preferred\`, \`ratings\`, \`comments\`, \`overall\`. Proceed with approved variant.

**If \`feedback-pending.json\`:** User clicked Regenerate/Remix.
1. Read \`regenerateAction\` (\`"different"\`, \`"match"\`, \`"more_like_B"\`, \`"remix"\`, or custom text)
2. If \`"remix"\`, read \`remixSpec\` (e.g. \`{"layout":"A","colors":"B"}\`)
3. Generate new variants with \`$D iterate\` or \`$D variants\`
4. Create new board: \`$D compare --images "..." --output "$_DESIGN_DIR/design-board.html"\`
5. Reload in browser: \`curl -s -X POST http://127.0.0.1:PORT/api/reload -H 'Content-Type: application/json' -d '{"html":"$_DESIGN_DIR/design-board.html"}'\`
6. Board auto-refreshes. **AskUserQuestion again** to wait for next round. Repeat until \`feedback.json\`.

**If \`NO_FEEDBACK_FILE\`:** User typed preferences directly. Use their text as feedback.

**POLLING FALLBACK:** Only if \`$D serve\` fails. Show variants inline with Read tool, then AskUserQuestion:
"Comparison board server failed. Variants shown above. Which do you prefer?"

**After receiving feedback:** Confirm understanding:

"Here's what I understood:
PREFERRED: Variant [X]
RATINGS: [list]
YOUR NOTES: [comments]
DIRECTION: [overall]

Is this right?"

AskUserQuestion to verify before proceeding.

**Save approved choice:**
\`\`\`bash
echo '{"approved_variant":"<V>","feedback":"<FB>","date":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","screen":"<SCREEN>","branch":"'$(git branch --show-current 2>/dev/null)'"}' > "$_DESIGN_DIR/approved.json"
\`\`\``;
}
