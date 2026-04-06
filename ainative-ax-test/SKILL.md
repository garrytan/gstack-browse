---
name: ainative-ax-test
preamble-tier: none
version: 1.0.0
description: Run an Agentic Experience (AX) test on any website — measures how well a site supports AI agents operating autonomously. Discovers APIs, tests auth flows, evaluates docs, scores across 10 dimensions. Free, no signup required.
allowed-tools: [Bash, Read, Write, Edit, WebFetch, Agent]
---

# AX Test — Agentic Experience Audit

Test how well any website supports AI agents operating autonomously — discovering services, creating accounts, provisioning resources, using APIs, and consuming documentation.

Unlike a UX audit (human experience), an AX test evaluates from the perspective of a software agent with no browser, no GUI, and no human in the loop.

## Usage

```
/ainative-ax-test https://example.com              # Quick mode (~60s)
/ainative-ax-test https://example.com --full        # Full mode (~3-5min)
/ainative-ax-test https://example.com --compare https://competitor.com
```

## 7-Phase Test Protocol

### Phase 1: Discovery (all modes)
- Check robots.txt, llms.txt, .well-known/ai-plugin.json
- Look for MCP server declarations, OpenAPI/Swagger specs
- Check for structured data (JSON-LD, Schema.org)
- Evaluate sitemap.xml for API documentation links

### Phase 2: Authentication (all modes)
- Find signup/registration endpoints
- Test API key provisioning flow
- Check OAuth2 flows
- Measure time-to-first-API-call

### Phase 3: API Exploration (--full only)
- Parse OpenAPI specs
- Test each documented endpoint
- Check error response quality
- Evaluate rate limit communication

### Phase 4: Resource Provisioning (--full only)
- Create a project/database/resource
- Measure provisioning latency
- Check if zero-human flow is possible

### Phase 5: Data Operations (--full only)
- CRUD operations on provisioned resources
- Test batch operations
- Evaluate SDK availability

### Phase 6: Documentation Quality (--full only)
- Code examples present and runnable?
- Error codes documented?
- Authentication documented with examples?
- Quick-start guide exists?

### Phase 7: Cleanup (--full only)
- Delete created resources
- Verify cleanup completeness

## 10-Dimension Scoring

| Dimension | Weight | What It Measures |
|-----------|--------|-----------------|
| Discovery | 10% | Can an agent find the API? |
| Auth | 15% | Can an agent authenticate programmatically? |
| API Quality | 15% | REST conventions, error handling, pagination |
| Docs | 10% | Code examples, error docs, quick-start |
| Provisioning | 15% | Zero-human resource creation |
| SDK/Tools | 10% | Client libraries, MCP servers, CLI tools |
| Reliability | 10% | Uptime, consistent responses |
| Speed | 5% | API response latency |
| Standards | 5% | OpenAPI, JSON:API, MCP compliance |
| Agent Support | 5% | llms.txt, AI plugin manifest, structured data |

## Output Format

```
AX SCORE: 8.5/10

Discovery:     9/10  — OpenAPI spec found, MCP server declared
Auth:          7/10  — API key works but OAuth flow needs manual step
API Quality:   9/10  — RESTful, good errors, pagination
Docs:          8/10  — Quick-start exists, some endpoints undocumented
Provisioning: 10/10  — Zero-human database creation in <5s
SDK/Tools:     9/10  — Python, JS, CLI, MCP server available
Reliability:   8/10  — 99.9% uptime, occasional 502s
Speed:         9/10  — P95 < 200ms
Standards:     8/10  — OpenAPI 3.0, no llms.txt
Agent Support: 7/10  — No AI plugin manifest

RECOMMENDATIONS:
1. Add llms.txt to root domain
2. Add ai-plugin.json for ChatGPT/MCP discovery
3. Document the OAuth redirect flow for agents
```

## Comparison Mode

```
/ainative-ax-test https://ainative.studio --compare https://competitor.com
```

Produces a side-by-side table across all 10 dimensions.

**Created by AINative Studio** — [ainative.studio/ax-audit](https://ainative.studio/ax-audit)
