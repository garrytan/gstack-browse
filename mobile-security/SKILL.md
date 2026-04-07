---
name: mobile-security
description: Security audit for mobile apps — review code, config, and architecture for secrets, data handling, certificate pinning, secure storage, and app-store compliance.
---

# /mobile-security

Run this after `/hig-review` and before `/mobile-qa` for any mobile change that touches authentication, payments, data storage, or network calls. This skill audits the implementation for security gaps and flags issues that could fail App Store / Play review or expose user data.

## Use when

- Adding or changing authentication (OAuth, biometric, passcode, session handling).
- Implementing payment processing or storing payment tokens.
- Storing sensitive data locally (credentials, tokens, PII, health data).
- Making network calls that handle user data.
- Adding third-party SDKs with native code.
- Building encryption, keychain, or secure-storage features.
- Preparing for App Store / Play submission and you want a pre-flight security check.

## Inputs

Collect or infer:

- Platform: `flutter`, `swift`, `kotlin`, or `expo`.
- Target OS: iOS, Android, or both.
- What changed: diff, PR, or list of modified files.
- Auth flow: how users authenticate (social, email, biometric, none).
- Storage: what data is persisted and where (Keychain, UserDefaults, SharedPreferences, files, SQLite).
- Network: API endpoints, whether TLS pinning is used.
- Third-party SDKs: any new native libraries or Flutter packages.

If platform is missing:
- Read `~/.gstack/config` or project docs.
- If still unclear, ask one concise question before proceeding.

## Review standard

Audit across these dimensions:

### 1. Secrets and credentials
- No hardcoded API keys, secrets, or tokens in source code.
- No credentials in logs, crash reports, or analytics.
- Service account keys (Play, Firebase) stored outside repo, loaded at runtime.
- `.env` files or local configs with secrets are gitignored.
- Private keys for ASC signing stored in secure keychain, not repo.

### 2. Secure storage
- iOS: Keychain with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` or equivalent.
- Android: EncryptedSharedPreferences or Keystore-backed encryption.
- Flutter: flutter_secure_storage or platform-native plugins, not plain SharedPreferences.
- Tokens, refresh tokens, and session IDs in secure storage, not UserDefaults/SharedPreferences.
- Encryption keys derived properly (PBKDF2, not simple PBKDF).

### 3. Network security
- TLS 1.2+ required, TLS 1.3 preferred.
- Certificate pinning for sensitive endpoints (auth, payments, user data).
- No cleartext HTTP in production (ATS on iOS, network_security_config on Android).
- WebViews properly configured (no JavaScript interface exposure unless needed).
- No sensitive data in URL query parameters (use POST body or headers).

### 4. Authentication and sessions
- OAuth 2.0 with secure flow (PKCE for mobile).
- Access tokens short-lived, refresh tokens stored securely.
- Biometric auth requires fallback for device incompatibility.
- Session invalidation on logout is complete (local + remote).
- No "remember me" on shared devices without re-auth.

### 5. Data handling
- PII, health data, or financial data encrypted at rest.
- No sensitive data in clipboard without user action.
- Analytics event names and properties don't leak PII.
- Logs stripped of credentials, tokens, and PII in release builds.
- Crash reporting uses non-identifiable identifiers.

### 6. Binary and runtime
- No debugging flags left in release builds.
- ProGuard/R8 stripping on Android, Symbolication handled.
- No verbose error messages exposed to users.
- Third-party SDKs come from trusted sources, audited for suspicious permissions.
- Code signing configured properly for distribution.

### 7. App store compliance
- No hidden file types or functionality.
- No private APIs called.
- No uninstalled code paths that bypass review.
- Remote code loading disabled unless explicitly approved.
- Privacy manifest present (iOS), permissions declared (Android).

## Output format

Use this exact structure:

### Verdict
One paragraph with a blunt recommendation:
- `PASS`
- `PASS WITH WARNINGS`
- `FAIL`

### Critical issues
Bullets only. Include only issues that should block merge or ship.

### Warnings
Bullets only. Important but non-blocking.

### Platform-specific notes
Split into:
- `iOS`
- `Android`
- `Flutter / shared`
Only include sections that apply.

### Recommended fix
Give the most opinionated fix path, not a menu of equal options.

### Build checklist
Provide a short, execution-ready checklist.

## Style

- Be direct and specific.
- Prefer "do this" over "consider this."
- Flag actual vulnerabilities, not theoretical concerns.
- Do not default to "use a library" without specifying which and why.
- Do not recommend over-engineering (e.g., full app attestation for a simple app).

## Mobile-specific checks

Always check for:

- Keychain/Keystore usage for tokens.
- Encrypted storage, not plain UserDefaults/SharedPreferences.
- Certificate pinning on auth/payment endpoints.
- ATS / network_security_config enabled.
- No secrets in source or logs.
- Proper logout (local + remote token revocation).
- Privacy manifest and permission declarations.

## Examples

Good prompts:
- `/mobile-security audit this OAuth flow implementation for Flutter`
- `/mobile-security check whether this payment SDK integration is storing tokens securely`
- `/mobile-security review these Android network calls for certificate pinning gaps`

Bad prompts:
- `/mobile-security make it secure`
- `/mobile-security check the app`