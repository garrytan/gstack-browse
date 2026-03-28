---
description: Connects gstack to the Antigravity agent environment locally.
---

# Bootstrap AG Setup

This configures any one-time local environment needs for running the modified gstack fork safely using the Agent workflows.

// turbo-all
1. Run the safe init utility.
```bash
bash .agents/scripts/ag-setup.sh
```
2. Install npm dependencies.
```bash
bun install
```
3. Ensure the project builds successfully.
```bash
bun run build
```
