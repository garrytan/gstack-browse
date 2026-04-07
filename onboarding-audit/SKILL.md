---
name: onboarding-audit
description: Onboarding and activation audit for mobile apps — review first-run experience, activation funnel, onboarding metrics, and time-to-value.
---

# /onboarding-audit

Run this after `/analytics-audit` and before `/store-ship`. This skill reviews onboarding flows to ensure users quickly reach your "aha moment" and become active users rather than bouncing.

## Use when

- Designing or changing onboarding, signup, or first-run flows.
- Reviewing a PR that touches the onboarding sequence.
- Investigating low activation rates or high drop-off.
- Setting up onboarding analytics and success metrics.
- Preparing for launch and you want to optimize activation.
- Adding paywalls or gates that could block activation.

## Inputs

Collect or infer:

- Platform: `flutter`, `swift`, `kotlin`, or `expo`.
- Target OS: iOS, Android, or both.
- What changed: diff, PR, or flow description.
- Current onboarding flow: how many steps, what gates exist.
- Activation metric: what behavior defines a "activated" user (first purchase, first use of core feature, etc.).
- Aha moment: what is the key value users should experience first.

If platform is missing:
- Read `~/.gstack/config` or project docs.
- If still unclear, ask one concise question before proceeding.

## Review standard

### 1. First-run experience
- No forced signup/registration before showing any value.
- First screen clearly communicates what the app does and why it's worth time.
- Onboarding completes in under 60 seconds on average.
- No unnecessary permissions requested upfront (delay until needed).
- Skip option available and doesn't punish users.

### 2. Activation funnel
- Maximum 3 taps to reach the core value.
- No dead-end paths where users get stuck.
- Clear progress indicators so users know how much is left.
- Errors are recoverable, not fatal to the flow.
- Back navigation works correctly at every step.

### 3. Value demonstration
- The "aha moment" happens within the first session.
- First-time user sees something personalized to them, not generic empty state.
- Demo or tutorial shows real use cases, not abstract instructions.
- Gamification or social proof used appropriately, not as a crutch.

### 4. Friction and drop-off points
- Identify where users abandon (analytics + heuristic).
- Long forms broken into micro-steps.
- Optional fields are truly optional, not hidden as required.
- Keyboard handling correct (no form jumping on input focus).
- No unexpected paywalls blocking core functionality.

### 5. Analytics and measurement
- Funnel events tracked (onboarding_start, onboarding_complete, activation).
- Drop-off rates measurable at each step.
- Time-to-activation tracked and monitored.
- Segment by platform, source, and user type.
- Baseline established before changes.

### 6. Platform conventions
- iOS: respect system appearance, don't override gestures, use native sheets/modals.
- Android: back button works correctly, use Material components, don't block system navigation.
- Flutter/Expo: consistent with platform feel, not just web ported to mobile.

### 7. Accessibility
- Onboarding works with VoiceOver/TalkBack.
- Dynamic Type supported without breaking layout.
- Color is not the only indicator of state.
- All interactive elements reachable via keyboard/voice.

## Output format

Use this exact structure:

### Verdict
One paragraph with a blunt recommendation:
- `PASS`
- `PASS WITH WARNINGS`
- `FAIL`

### Critical issues
Bullets only. Include only issues that block activation or cause high drop-off.

### Warnings
Bullets only. Important but non-blocking.

### Platform-specific notes
Split into:
- `iOS`
- `Android`
- `Flutter / shared`
Only include sections that apply.

### Recommended funnel fix
Give the most opinionated path to improve activation.

### Build checklist
Provide a short, execution-ready checklist.

## Style

- Be direct and specific.
- Optimize for time-to-value, not feature completeness.
- Don't suggest adding more steps — suggest removing friction.
- Consider the user's context (distracted, on mobile, possibly returning later).
- Flag any "dark patterns" that could fail store review or damage trust.

## AARRR lens

- Acquisition: onboarding is your first impression, matches store listing?
- Activation: how many steps to value, what is the "aha moment"?
- Retention: does onboarding set accurate expectations for ongoing value?
- Referral: any social or share features that could amplify activation?
- Revenue: are paywalls placed after value is demonstrated?

## Mobile-specific checks

- First launch shows something meaningful immediately.
- No forced signup before any interaction.
- Permissions requested at point of use, not on launch.
- Skip onboarding works and doesn't degrade experience.
- Dark mode doesn't break onboarding UI.

## Examples

Good prompts:
- `/onboarding-audit review this signup flow for activation drop-off`
- `/onboarding-audit optimize this onboarding for faster time-to-value`
- `/onboarding-audit check if this paywall placement will hurt activation`

Bad prompts:
- `/onboarding-audit make onboarding better`
- `/onboarding-audit review the flow`