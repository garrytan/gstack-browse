# Pre-Landing Review Checklist (Universal)

## PASS 1: CRITICAL
If any of these are violated, it is a CRITICAL issue.

### SQL & Data Safety
- No raw SQL literals constructed from variables (SQL injection).
- No unescaped user input passed to database queries.
- Mass assignment must be explicitly permitted/filtered.
- No sensitive data logged in plaintext.

### LLM Output Trust Boundary
- Never parse LLM text output as code/JSON without strict sanitization.
- Always use structured output/tool use when machine parsing is required.
- Provide clear fallbacks for when the LLM hallucinates or returns invalid structures.

### Secrets & Credentials
- No hardcoded API keys, tokens, or passwords in source code.
- Credentials must be loaded from environment variables or secure stores.

## PASS 2: INFORMATIONAL
If any of these are violated, it is an INFORMATIONAL issue.

### Error Handling & Edge Cases
- All external API calls must handle timeouts and network failures.
- Async operations must catch and log unhandled rejections.
- Promises must be awaited or explicitly returned.

### Dead Code & Consistency
- No commented-out blocks of code left behind.
- Remove unused variables and imports.
- Follow the established naming conventions of the surrounding code.

### Security
- No path traversal vulnerabilities when reading/writing files based on user input.
- Cross-Site Scripting (XSS) protections must be active when rendering user input.

## DO NOT flag (Common False Positives)
- Debug logging that does not contain PII or secrets.
- Missing tests (unless the PR explicitly claims to add them).
- Subjective style preferences (e.g., tabs vs spaces) unless violating a linter.
- Known technical debt that is outside the scope of the current diff.
