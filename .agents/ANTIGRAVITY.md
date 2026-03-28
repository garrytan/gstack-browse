# Antigravity Context for gstack-fork

This repository is a fork of [garrytan/gstack](https://github.com/garrytan/gstack) built with compatibility for **Antigravity** workflows in mind. 
It preserves all core gstack paradigms while exposing `gstack` functionalities seamlessly to the Antigravity agent context.

## Core Directives for Agents

1. **Isolation of Modifications**: 
   - Antigravity should avoid directly modifying core `gstack` infrastructure files (such as `package.json`, `.github/workflows/`, and `scripts/`) to maintain an easy upgrade path. 
   - Any agentic modifications for Antigravity compatibility belong strictly within the `.agents/` directory.
   
2. **Workflows**: 
   - All automations to synchronize the local fork with upstream reside in `.agents/workflows/`. Use the `// turbo-all` annotations when running workflows defined in this repo so they seamlessly rebase code securely.
   - For execution, prioritize running bash commands over generic JS logic when scripting setup/deploy. 

3. **Rebase Protocol**:
   - The primary strategy for syncing `upstream/main` is **rebase atop**. Never create merge commits unless resolving a deep conflict manually prompts it. The `sync-upstream.md` workflow outlines this process.
