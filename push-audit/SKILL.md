---
name: push-audit
description: Push notification audit for mobile apps — review notification implementation, permissions, payloads, delivery, and opt-out handling for iOS and Android.
---

# /push-audit

Run this when implementing or changing push notifications. This skill reviews notification implementation to ensure messages are timely, relevant, and comply with platform guidelines and user expectations.

## Use when

- Adding push notifications for the first time.
- Changing notification content, triggers, or frequency.
- Investigating low delivery rates or high opt-out rates.
- Implementing notification categories or actions.
- Setting up rich notifications (images, actions, breakpoints).
- Reviewing a PR for notification implementation quality.
- Preparing for store submission with notification features.

## Inputs

Collect or infer:

- Platform: `flutter`, `swift`, `kotlin`, or `expo`.
- Target OS: iOS, Android, or both.
- What changed: diff, PR, or feature description.
- Push provider: Firebase Cloud Messaging, APNs directly, or a third-party service.
- Notification types: transactional, promotional, breaking news, etc.
- Current opt-out rate: if known.

If platform is missing:
- Read `~/.gstack/config` or project docs.
- If still unclear, ask one concise question before proceeding.

## Review standard

### 1. Permission handling
- Request permission at point of user action, not on first launch.
- Provide clear explanation of why notifications are useful before asking.
- Handle permission denied gracefully (no degraded experience).
- Re-request permission after significant value is demonstrated (if allowed).
- No repetitive permission requests that annoy users.

### 2. Notification content
- Title is concise and meaningful (50 characters max).
- Body provides useful information, not just "tap to open."
- No sensitive data in notification content (PII, credentials).
- Notification doesn't reveal private info on the lock screen.
- Images and media are appropriate and don't bloat payload.
- Rich notifications have fallbacks for devices that don't support them.

### 3. Timing and frequency
- No notifications during quiet hours (unless critical).
- Batch notifications when possible to avoid spam.
- Respect system notification limits (Android, iOS both have limits).
- Time zone aware for global apps.
- No notifications that fire repeatedly in a loop.

### 4. Delivery and reliability
- Use FCM/APNs correctly (proper token handling, refresh on re-install).
- Handle token migration between app versions.
- Implement fallback for when push fails (in-app notifications).
- Test on real devices, not just emulators.
- Verify delivery in production (don't assume sent = delivered).

### 5. Interaction and actions
- Deep links from notification to relevant content.
- Notification actions are useful and don't require extra steps.
- Swipe actions work correctly.
- Unread count/badge updates are consistent.
- Opening notification clears the notification (or doesn't if desired).

### 6. Opt-out and unsubscribe
- Unsubscribe link or setting is easy to find.
- Unsubscribing works immediately, not after a delay.
- One-click unsubscribe in email (if email is also used).
- No deceptive unsubscribe patterns (hidden buttons, extra steps).
- Opt-out is respected immediately across all channels.

### 7. Privacy and data
- No sensitive data in notification payload.
- Notification data doesn't get logged in analytics unless needed.
- Device tokens stored securely, not in plain text or logs.
- No use of notification for tracking without consent.

### 8. Platform specifics
- iOS: critical alerts configured for actual emergencies only, notification categories for customization.
- Android: notification channels configured (Oreo+), importance levels correct, badging handled.
- Both: test on both platforms, behavior differs.

## Output format

Use this exact structure:

### Verdict
One paragraph with a blunt recommendation:
- `PASS`
- `PASS WITH WARNINGS`
- `FAIL`

### Critical issues
Bullets only. Include only issues that will cause rejections or user trust issues.

### Warnings
Bullets only. Important but non-blocking.

### Platform-specific notes
Split into:
- `iOS`
- `Android`
- `Flutter / shared`
Only include sections that apply.

### Recommended fix
Give the most opinionated path to improve the implementation.

### Build checklist
Provide a short, execution-ready checklist.

## Style

- Be direct and specific.
- Focus on permission timing, content quality, and opt-out experience.
- Flag anything that could feel spammy or deceptive.
- Don't suggest anything that violates platform guidelines.
- Consider the user's perspective — would they feel good about this notification?

## Mobile-specific checks

- Request permission at the right time (after value, not at launch).
- Notification center doesn't fill with junk.
- Lock screen doesn't reveal sensitive info.
- Tapping notification goes to the right place.
- Unsubscribing is trivial.

## Examples

Good prompts:
- `/push-audit review this push notification implementation for permission handling`
- `/push-audit check if this notification content is appropriate for lock screen`
- `/push-audit audit the notification frequency to prevent opt-outs`

Bad prompts:
- `/push-audit add push notifications`
- `/push-audit improve notifications`