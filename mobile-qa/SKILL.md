---
name: mobile-qa
description: Mobile QA testing — simulator testing, accessibility validation, device coverage strategy, and pre-submission checklist for App Store and Play.
---

# /mobile-qa

Run this after `/mobile-security` and before `/analytics-audit`. This skill guides actual testing on simulators, emulators, or physical devices and ensures the app meets store submission requirements.

## Use when

- Writing or reviewing mobile tests.
- Preparing for App Store / Play submission.
- Running an accessibility audit.
- Debugging device-specific issues.
- Creating a device coverage strategy.
- Reviewing a PR for test gaps.

## Inputs

Collect or infer:

- Platform: `flutter`, `swift`, `kotlin`, or `expo`.
- Target OS: iOS, Android, or both.
- What changed: diff, PR, or feature description.
- Test stack: what frameworks are used (XCTest, Espresso, Flutter test, etc.).
- Device target: which form factors matter (phone, tablet, foldable).
- Whether the change touches accessibility, gestures, or device-specific features.

If platform is missing:
- Read `~/.gstack/config` or project docs.
- If still unclear, ask one concise question before proceeding.

## Review standard

### 1. Test coverage
- Unit tests cover business logic, not UI.
- Integration tests cover critical flows (auth, checkout, onboarding).
- Widget/component tests cover edge cases and error states.
- No tests that only assert "works on my machine."

### 2. Device and OS coverage
- Test on at least one iOS version below the minimum supported.
- Test on at least one Android API level below the minimum supported.
- Cover both light and dark mode.
- Cover both portrait and landscape if applicable.
- Account for notch/home indicator areas on newer devices.

### 3. Accessibility testing
- VoiceOver/TalkBack navigation works through new flows.
- Dynamic Type scales UI without breaking layouts.
- Minimum tap target size (44x44pt iOS, 48dp Android).
- Color contrast meets WCAG AA (4.5:1 for normal text).
- No information conveyed by color alone.
- Reduced motion setting respected.

### 4. Store submission checks
- All required metadata populated (descriptions, screenshots, keywords).
- Privacy nutrition labels accurate (iOS).
- Data use disclosure complete (Android).
- Build version and build number monotonically increasing.
- No debug code or verbose logging in release builds.
- Crash reporting integrated and tested.

### 5. Performance at scale
- Launch time under 2 seconds on target devices.
- Scrolling smooth (60fps) with realistic data volumes.
- No memory leaks from navigation or async operations.
- Offline scenarios tested (no crashes, graceful degradation).

### 6. Edge cases
- Network timeout and offline mode.
- Low storage warning.
- Background/foreground transitions.
- Notification permission denied.
- Location permission denied.
- Biometric unavailable or failed.

## Output format

Use this exact structure:

### Verdict
One paragraph with a blunt recommendation:
- `PASS`
- `PASS WITH WARNINGS`
- `FAIL`

### Critical issues
Bullets only. Include only issues that should block submission.

### Warnings
Bullets only. Important but non-blocking.

### Platform-specific notes
Split into:
- `iOS`
- `Android`
- `Flutter / shared`
Only include sections that apply.

### Recommended test plan
Give the most opinionated test approach for the change.

### Build checklist
Provide a short, execution-ready checklist for QA.

## Style

- Be direct and specific.
- Prioritize real device testing over emulator where possible.
- Flag device-specific issues that simulators miss.
- Don't suggest testing everything — focus on risk areas.
- Recommend specific tools (like Fastlane for iOS, Firebase Test Lab for Android).

## Mobile-specific checks

Always check for:

- Safe area handling on notched devices.
- Keyboard avoidance on forms.
- Gesture conflict with system gestures.
- Dark mode rendering issues.
- Dynamic Type overflow.
- Simulator vs device behavior gaps.

## Examples

Good prompts:
- `/mobile-qa create a test plan for this checkout flow change`
- `/mobile-qa audit this onboarding flow for accessibility issues`
- `/mobile-qa review the PR for missing test coverage`

Bad prompts:
- `/mobile-qa test the app`
- `/mobile-qa check for bugs`