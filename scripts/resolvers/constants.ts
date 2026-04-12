// ─── Shared Design Constants ────────────────────────────────

/** gstack's 10 AI slop anti-patterns — shared between DESIGN_METHODOLOGY and DESIGN_HARD_RULES */
export const AI_SLOP_BLACKLIST = [
  'Purple/violet/indigo gradient backgrounds or blue-to-purple color schemes',
  '**The 3-column feature grid:** icon-in-colored-circle + bold title + 2-line description, repeated 3x symmetrically. THE most recognizable AI layout.',
  'Icons in colored circles as section decoration (SaaS starter template look)',
  'Centered everything (`text-align: center` on all headings, descriptions, cards)',
  'Uniform bubbly border-radius on every element (same large radius on everything)',
  'Decorative blobs, floating circles, wavy SVG dividers (if a section feels empty, it needs better content, not decoration)',
  'Emoji as design elements (rockets in headings, emoji as bullet points)',
  'Colored left-border on cards (`border-left: 3px solid <accent>`)',
  'Generic hero copy ("Welcome to [X]", "Unlock the power of...", "Your all-in-one solution for...")',
  'Cookie-cutter section rhythm (hero → 3 features → testimonials → pricing → CTA, every section same height)',
];

/** OpenAI hard rejection criteria (from "Designing Delightful Frontends with GPT-5.4", Mar 2026) */
export const OPENAI_HARD_REJECTIONS = [
  'Generic SaaS card grid as first impression',
  'Beautiful image with weak brand',
  'Strong headline with no clear action',
  'Busy imagery behind text',
  'Sections repeating same mood statement',
  'Carousel with no narrative purpose',
  'App UI made of stacked cards instead of layout',
];

/** OpenAI litmus checks — 7 yes/no tests for cross-model consensus scoring */
export const OPENAI_LITMUS_CHECKS = [
  'Brand/product unmistakable in first screen?',
  'One strong visual anchor present?',
  'Page understandable by scanning headlines only?',
  'Each section has one job?',
  'Are cards actually necessary?',
  'Does motion improve hierarchy or atmosphere?',
  'Would design feel premium with all decorative shadows removed?',
];

/**
 * Shared Codex error handling block for resolver output.
 * Used by ADVERSARIAL_STEP, CODEX_PLAN_REVIEW, CODEX_SECOND_OPINION,
 * DESIGN_OUTSIDE_VOICES, DESIGN_REVIEW_LITE, DESIGN_SKETCH.
 */
export function codexErrorHandling(feature: string): string {
  return `**Error handling:** All errors are non-blocking — the ${feature} is informational.
- Auth failure (stderr contains "auth", "login", "unauthorized"): note and skip
- Timeout: note timeout duration and skip
- Empty response: note and skip
On any error: continue — ${feature} is informational, not a gate.`;
}

/**
 * Generate a second-opinion CLI invocation block.
 * Used by hosts that have a secondOpinionCLI configured (e.g., Windsurf → Gemini).
 * Falls back to inline review if the CLI is not installed.
 */
export interface SecondOpinionCLIConfig {
  binary: string;
  displayName: string;
  execTemplate: string;
  boundaryInstruction?: string;
}

export function secondOpinionBlock(
  cli: SecondOpinionCLIConfig,
  prompt: string,
  feature: string,
  headerLabel: string,
): string {
  const boundary = cli.boundaryInstruction || '';
  return `**Check ${cli.displayName} CLI availability:**

\`\`\`bash
which ${cli.binary} 2>/dev/null && echo "${cli.binary.toUpperCase()}_AVAILABLE" || echo "${cli.binary.toUpperCase()}_NOT_AVAILABLE"
\`\`\`

**If ${cli.displayName} is available**, run the ${feature}:

\`\`\`bash
TMPERR_SO=$(mktemp /tmp/gstack-so-XXXXXXXX)
_REPO_ROOT=$(git rev-parse --show-toplevel) || { echo "ERROR: not in a git repo" >&2; exit 1; }
${cli.execTemplate.replace('${PROMPT}', `${boundary}${prompt}`).replace('${REPO_ROOT}', '$_REPO_ROOT')} 2>"$TMPERR_SO"
\`\`\`

Set the Bash tool's \`timeout\` parameter to \`300000\` (5 minutes). After the command completes, read stderr:
\`\`\`bash
cat "$TMPERR_SO"
rm -f "$TMPERR_SO"
\`\`\`

Present the full output verbatim under a \`${headerLabel} (${cli.displayName}):\` header.

**Error handling:** All errors are non-blocking — the ${feature} is informational.
- **CLI not found:** "${cli.displayName} CLI not installed — performing inline review instead."
- **Auth failure:** If stderr contains "auth", "login", "unauthorized": "${cli.displayName} authentication failed." Fall back to inline review.
- **Timeout:** "${cli.displayName} timed out after 5 minutes." Fall back to inline review.
- **Empty response:** "${cli.displayName} returned no response." Fall back to inline review.

**If ${cli.binary.toUpperCase()}_NOT_AVAILABLE (or ${cli.displayName} errored):**

`;
}
