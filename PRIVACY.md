# Privacy Policy

**Last updated:** 2026-03-26

gstack is an open-source CLI tool. This policy explains what data gstack collects, why, and how you control it.

## The short version

- **Telemetry is off by default.** Nothing is sent unless you say yes.
- **We never collect your code, file paths, repo names, prompts, or any content you write.**
- **You can change your mind anytime:** `gstack-config set telemetry off`
- **Screenshots you upload are yours.** You can delete them anytime.
- **We don't sell data.** Period.

---

## 1. Telemetry

### What we collect (if you opt in)

gstack has three telemetry tiers. You choose during first run:

| Tier | What's sent | Identifier |
|------|------------|------------|
| **Off** (default) | Nothing | None |
| **Anonymous** | Skill name, duration, success/fail, gstack version, OS | None — no way to connect sessions |
| **Community** | Same as anonymous | Random UUID (`~/.gstack/.install-id`) — connects sessions from one device |

### What we never collect

- Source code or file contents
- File paths or directory structures
- Repository names or branch names
- Git commits, diffs, or history
- Prompts, questions, or conversations
- Usernames, hostnames, or IP addresses (not logged server-side)
- Any content you write or generate

### How it works

1. Events are logged locally to `~/.gstack/analytics/skill-usage.jsonl`
2. A background sync (`gstack-telemetry-sync`) sends unsent events to Supabase
3. Local-only fields (`repo`, `_branch`, `_repo_slug`) are **stripped before sending**
4. Sync is rate-limited to once per 5 minutes, batched (max 100 events)
5. If sync fails, events stay local — nothing is lost or retried aggressively

### Update checks

gstack checks for updates by pinging our server with:
- Your gstack version
- Your OS (darwin/linux)
- A random device UUID

This happens regardless of telemetry tier because it's equivalent to what any package manager (Homebrew, npm) sends. No usage data is included. You can verify this in `bin/gstack-update-check`.

---

## 2. Screenshots (PR Screenshots feature)

When you use the PR Screenshots feature during `/ship`:

### What's stored

- **Screenshot images** (PNGs) uploaded to a private Supabase Storage bucket
- **Metadata:** nanoid, your user ID, slugified repo name, slugified branch name, viewport size, timestamp
- Images are served through a proxy (`gstack.gg/i/{id}`) that adds a watermark — raw images are never publicly accessible

### What's NOT stored

- No source code or file contents
- No git history or commit data
- No prompt or conversation data

### Your control

- You can delete your screenshots anytime (authenticated DELETE to the API)
- Orphan screenshots (no PR number after 24 hours) are automatically cleaned up
- Images are tied to your gstack.gg account — you own them

---

## 3. Authentication

gstack.gg supports two auth methods:

- **GitHub OAuth** — we receive your GitHub username and email. We don't access your repos, code, or any GitHub data beyond basic profile.
- **Email OTP** — we store your email address to send verification codes.

Auth tokens are stored locally at `~/.gstack/auth-token.json` with file permissions `0600` (owner-only read/write). Tokens are standard Supabase JWT tokens and can be revoked by logging out (`gstack-auth logout`).

---

## 4. Data storage and security

All data is stored in [Supabase](https://supabase.com) (open-source Firebase alternative):

- **Row-Level Security (RLS)** on all tables — direct database access is denied even with the publishable API key
- **Edge functions** validate schema, enforce event type allowlists, and limit field lengths
- **The Supabase publishable key in our repo is a public key** (like a Firebase API key) — it cannot bypass RLS
- **Screenshot storage bucket is private** — images are only accessible through the watermark proxy using a service-role key

The full database schema is in [`supabase/migrations/`](supabase/migrations/) — you can verify exactly what's stored.

---

## 5. Data retention

| Data type | Retention |
|-----------|-----------|
| Telemetry events | Indefinite (aggregated, no PII) |
| Update check pings | Indefinite (version + OS only) |
| Device codes (auth) | Deleted 15 minutes after expiry |
| Orphan screenshots | Deleted 24 hours after upload if no PR is created |
| Active screenshots | Retained until you delete them |

---

## 6. Your rights

- **Access:** Run `gstack-analytics` to see all your local telemetry data. The JSONL file at `~/.gstack/analytics/skill-usage.jsonl` is plain text — you can read it directly.
- **Opt out:** `gstack-config set telemetry off` — stops all collection and syncing instantly.
- **Delete local data:** Remove `~/.gstack/analytics/` to clear all local telemetry.
- **Delete screenshots:** Authenticated DELETE request to the upload API, or contact us.
- **Delete account:** Contact us at the email below — we'll remove all data associated with your install fingerprint or user account.

---

## 7. Third parties

- **Supabase** hosts our database and storage (their privacy policy: https://supabase.com/privacy)
- **Vercel** hosts gstack.gg (their privacy policy: https://vercel.com/legal/privacy-policy)
- **GitHub** provides OAuth authentication
- We do not share, sell, or provide your data to any other third party

---

## 8. Changes

We'll update this policy as gstack evolves. Material changes will be noted in the [CHANGELOG](CHANGELOG.md). The "Last updated" date at the top always reflects the current version.

---

## Contact

Questions about privacy? Open an issue at https://github.com/garrytan/gstack/issues or email privacy@gstack.gg.
