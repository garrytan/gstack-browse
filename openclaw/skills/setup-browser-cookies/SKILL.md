---
name: setup-browser-cookies
description: >
  Import cookies into the OpenClaw browser session for testing authenticated pages.
  Supports importing from cookie JSON files or manual login flows. Use before /qa or
  /browse when you need to test pages behind authentication. Use when asked to
  "setup cookies", "import cookies", "setup browser cookies", "login for testing",
  or /setup-browser-cookies. Based on gstack by Garry Tan, adapted for OpenClaw.
---

# Setup Browser Cookies

Import logged-in sessions into the OpenClaw browser for testing authenticated pages.

## How It Works in OpenClaw

OpenClaw's browser tool maintains persistent state (cookies, localStorage) across calls within
a session. There are two approaches to authenticate:

### Option 1: Manual Login Flow (Recommended)

The simplest approach — just log in through the browser:

```
browser(action: "navigate", url: "https://myapp.com/login")
browser(action: "snapshot", refs: "aria")
# Find the email/password fields and submit button from the snapshot
browser(action: "act", kind: "fill", ref: "<email-ref>", text: "user@example.com")
browser(action: "act", kind: "fill", ref: "<password-ref>", text: "password")
browser(action: "act", kind: "click", ref: "<submit-ref>")
browser(action: "snapshot")    # verify login succeeded
```

Cookies persist between browser calls, so subsequent /qa or /browse commands will be
authenticated automatically.

### Option 2: Cookie JSON Import

If the user has exported cookies as a JSON file (e.g., from a browser extension like
"EditThisCookie" or "Cookie-Editor"), you can import them via JavaScript evaluation:

```
browser(action: "navigate", url: "https://myapp.com")
browser(action: "act", kind: "evaluate", fn: "
  const cookies = JSON.parse(await (await fetch('file:///path/to/cookies.json')).text());
  // Or pass cookies inline if small enough
")
```

Alternatively, read the cookie file with the `read` tool, then set cookies via the browser:

```bash
cat /path/to/cookies.json
```

Then for each cookie, use JavaScript to set it:
```
browser(action: "act", kind: "evaluate", fn: "document.cookie = 'name=value; domain=.myapp.com; path=/'")
```

### Option 3: Direct Domain Import

If the user specifies a domain directly (e.g., `/setup-browser-cookies github.com`):

1. Ask the user how they want to authenticate:
   - A) Log in manually through the browser (recommended)
   - B) Provide a cookie JSON file
   - C) Provide individual cookie values

2. Follow the appropriate flow above.

## Verification

After importing cookies, verify the session works:

```
browser(action: "navigate", url: "https://myapp.com/dashboard")
browser(action: "snapshot")
browser(action: "screenshot")
```

Check that the page shows authenticated content (user name, dashboard, etc.) rather than
a login redirect.

## Handling Auth Challenges

- **2FA/OTP required:** Ask the user for the code, then fill it in via the browser tool.
- **CAPTCHA blocks you:** Tell the user: "Please complete the CAPTCHA in the browser, then tell me to continue." (Use `browser(action: "screenshot")` to show them what's on screen.)
- **OAuth redirects:** Follow the redirect chain. If it requires interaction on a third-party site, walk through it with snapshot + click actions.

## Notes

- OpenClaw's browser session persists cookies between calls within the same session
- No macOS Keychain integration (unlike the original gstack) — use manual login or JSON import
- Cookie values are never displayed in reports — use `[REDACTED]` in any output
- After setup, /qa and /browse will automatically use the authenticated session
