---
name: browse
description: >
  Browser automation for QA testing and site dogfooding using OpenClaw's built-in browser
  tool. Navigate any URL, interact with elements, verify page state, take screenshots,
  check responsive layouts, test forms, and assert element states. Use when asked to
  "browse a site", "check this URL", "test this page", "take a screenshot", "dogfood",
  "verify deployment", or /browse. Based on gstack by Garry Tan, adapted for OpenClaw.
---

# Browse: QA Testing & Dogfooding with OpenClaw Browser

OpenClaw has a built-in browser tool. No binary compilation needed — use the `browser` tool
directly for all web automation.

## Core QA Patterns

### 1. Navigate to a page and verify it loads

```
browser(action: "navigate", url: "https://yourapp.com")
browser(action: "snapshot")           # get page structure
browser(action: "screenshot")         # visual capture
browser(action: "console")            # check for JS errors
```

### 2. Test a user flow (e.g., login)

```
browser(action: "navigate", url: "https://app.com/login")
browser(action: "snapshot", refs: "aria")    # see all interactive elements with refs
browser(action: "act", kind: "fill", ref: "e3", text: "user@test.com")
browser(action: "act", kind: "fill", ref: "e4", text: "password")
browser(action: "act", kind: "click", ref: "e5")    # submit
browser(action: "snapshot")                           # verify login succeeded
```

### 3. Take screenshots for bug reports

```
browser(action: "screenshot", fullPage: true)         # full page capture
browser(action: "snapshot", refs: "aria")              # labeled element tree
```

### 4. Test responsive layouts

```
browser(action: "act", kind: "resize", width: 375, height: 812)   # mobile
browser(action: "screenshot")
browser(action: "act", kind: "resize", width: 768, height: 1024)  # tablet
browser(action: "screenshot")
browser(action: "act", kind: "resize", width: 1280, height: 720)  # desktop
browser(action: "screenshot")
```

### 5. Fill and submit forms

```
browser(action: "snapshot", refs: "aria")
browser(action: "act", kind: "fill", ref: "<input-ref>", text: "value")
browser(action: "act", kind: "click", ref: "<submit-ref>")
browser(action: "snapshot")    # verify result
```

### 6. Check console for errors

```
browser(action: "console")     # see all console messages
```

### 7. Execute JavaScript on the page

```
browser(action: "act", kind: "evaluate", fn: "document.title")
browser(action: "act", kind: "evaluate", fn: "document.querySelectorAll('a').length")
```

### 8. Handle dialogs

```
browser(action: "dialog", accept: true)     # auto-accept alerts
browser(action: "dialog", accept: false)    # dismiss
```

### 9. Compare pages across environments

Navigate to staging, take a snapshot. Navigate to production, take a snapshot. Compare the
two snapshots for differences.

### 10. Test file uploads

```
browser(action: "upload", ref: "<file-input-ref>", paths: ["/path/to/file.pdf"])
```

## Workflow for QA Testing

1. **Navigate** to the target URL
2. **Snapshot** to understand the page structure and get element refs
3. **Interact** — click buttons, fill forms, navigate links using refs from snapshot
4. **Screenshot** to capture visual evidence
5. **Console** to check for JS errors after each interaction
6. **Repeat** for each page/flow being tested

## Tips

- Always run `snapshot` after navigation to get fresh element refs
- Use `refs: "aria"` for stable, self-resolving refs across calls
- After any action that changes the page, take a new snapshot before interacting again
- Check console after every significant interaction — JS errors that don't surface visually are still bugs
- For SPAs, use click actions on nav elements instead of direct URL navigation to catch routing issues
- When testing authenticated pages, perform the login flow first — cookies persist between browser calls

## Framework-Specific Guidance

### Next.js
- Check console for hydration errors
- Test client-side navigation (click links, don't just navigate)
- Check for layout shifts on pages with dynamic content

### Rails
- Verify CSRF token presence in forms
- Test Turbo/Stimulus integration
- Check for flash messages

### General SPA (React, Vue, Angular)
- Use snapshot for navigation — direct URL navigation may miss client-side routes
- Check for stale state (navigate away and back)
- Test browser back/forward handling
