---
name: ainative-mcp-builder
preamble-tier: none
version: 1.0.0
description: Build and publish MCP (Model Context Protocol) servers that expose tools to any AI agent. TypeScript or Python. Follows AINative patterns from zerodb-mcp-server (76+ tools). Covers tool design, testing, npm/PyPI publishing, and ClawHub distribution.
allowed-tools: [Bash, Read, Write, Edit, WebFetch]
---

# MCP Server Builder

Build MCP servers that expose tools to Claude Code, Cursor, ChatGPT, and any MCP-compatible agent.

## Quick Scaffold

### TypeScript

```bash
mkdir my-mcp-server && cd my-mcp-server
npm init -y
npm install @modelcontextprotocol/sdk
```

```typescript
// src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  { name: 'my-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'hello',
    description: 'Say hello',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Name to greet' } },
      required: ['name']
    }
  }]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (name === 'hello') {
    return { content: [{ type: 'text', text: `Hello, ${args.name}!` }] };
  }
  return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Python (FastMCP)

```bash
pip install fastmcp
```

```python
from fastmcp import FastMCP

mcp = FastMCP("my-server")

@mcp.tool()
def hello(name: str) -> str:
    """Say hello to someone"""
    return f"Hello, {name}!"

if __name__ == "__main__":
    mcp.run()
```

## Tool Design Guidelines

1. **One verb per tool** — `create_user` not `manage_users`
2. **Clear descriptions** — agents read these to decide which tool to use
3. **Typed schemas** — use JSON Schema with required fields and descriptions
4. **Meaningful errors** — return `isError: true` with actionable messages
5. **Idempotent where possible** — safe to retry on failure

## Configure in Claude Code

```json
// .claude/mcp.json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": { "API_KEY": "your_key" }
    }
  }
}
```

## Publish to npm

```json
// package.json
{
  "name": "my-mcp-server",
  "bin": { "my-mcp-server": "dist/index.js" },
  "files": ["dist"]
}
```

```bash
npm publish
```

Users install with: `npm install -g my-mcp-server`

## AINative MCP Servers (Reference)

| Server | Tools | Install |
|--------|-------|---------|
| `ainative-zerodb-mcp-server` | 76+ | `npm i -g ainative-zerodb-mcp-server` |
| `ainative-zerodb-memory-mcp` | 6 | `npm i -g ainative-zerodb-memory-mcp` |
| `zerodb-mcp` | 76+ | `pip install zerodb-mcp` |

**Docs:** [docs.ainative.studio/docs/mcp/overview](https://docs.ainative.studio/docs/mcp/overview)
