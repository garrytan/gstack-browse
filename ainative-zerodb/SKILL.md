---
name: ainative-zerodb
preamble-tier: none
version: 1.0.0
description: ZeroDB — persistent knowledge layer for AI agents. Vectors, memory, files, tables, events, and free embeddings in one API. 76+ MCP tools. Instant database provisioning with npx zerodb-cli init.
allowed-tools: [Bash, Read, Write, Edit, WebFetch]
---

# ZeroDB — Persistent Knowledge Layer for AI Agents

Vectors, memory, files, tables, events, and free embeddings in one API. Get a database in 30 seconds.

## Quick Start

```bash
npx zerodb-cli init
```

This auto-detects your IDE (Claude Code, Cursor, VS Code, Windsurf) and configures the MCP server.

## What's Included

| Feature | Description |
|---------|-------------|
| **Vectors** | Store and search embeddings with cosine similarity |
| **Memory** | ZeroMemory cognitive memory (working/episodic/semantic) |
| **Files** | S3-compatible object storage |
| **Tables** | NoSQL document tables with JSON queries |
| **Events** | Event streams for agent workflows |
| **PostgreSQL** | Dedicated managed PostgreSQL instance |
| **Free Embeddings** | Built-in embedding generation (no OpenAI key needed) |

## MCP Server (76+ Tools)

```bash
# Full server
npm install -g ainative-zerodb-mcp-server

# Memory-only (lightweight, 6 tools)
npm install -g ainative-zerodb-memory-mcp
```

```json
{
  "mcpServers": {
    "zerodb": {
      "command": "ainative-zerodb-mcp-server",
      "env": { "ZERODB_API_KEY": "ak_your_key" }
    }
  }
}
```

## Vector Operations

```python
import requests

API_KEY = "ak_your_key"
BASE = "https://api.ainative.studio/api/v1"

# Store a vector (auto-embeds text)
requests.post(f"{BASE}/vectors/upsert",
    headers={"X-API-Key": API_KEY},
    json={"id": "doc-1", "content": "FastAPI is a modern Python web framework",
          "metadata": {"source": "docs", "topic": "python"}})

# Semantic search
results = requests.post(f"{BASE}/vectors/search",
    headers={"X-API-Key": API_KEY},
    json={"query": "Python web frameworks", "limit": 5}).json()
```

## File Storage (S3-Compatible)

```python
# Upload
requests.post(f"{BASE}/files/upload",
    headers={"X-API-Key": API_KEY},
    files={"file": open("report.pdf", "rb")})

# Get presigned URL
url = requests.get(f"{BASE}/files/url/report.pdf",
    headers={"X-API-Key": API_KEY}).json()["url"]
```

## NoSQL Tables

```python
# Create table
requests.post(f"{BASE}/tables/users/insert",
    headers={"X-API-Key": API_KEY},
    json={"rows": [{"name": "Alice", "role": "engineer", "active": True}]})

# Query
results = requests.post(f"{BASE}/tables/users/query",
    headers={"X-API-Key": API_KEY},
    json={"filter": {"role": "engineer"}, "limit": 10}).json()
```

## Framework Integrations

```bash
pip install langchain-zerodb          # LangChain vector store
pip install llama-index-vector-stores-zerodb  # LlamaIndex
pip install zerodb-local              # Local-first (SQLite + FAISS)
```

## Packages

| Package | Registry | Install |
|---------|----------|---------|
| `zerodb-mcp` | PyPI | `pip install zerodb-mcp` |
| `zerodb-cli` | npm | `npx zerodb-cli init` |
| `langchain-zerodb` | PyPI | `pip install langchain-zerodb` |
| `llama-index-vector-stores-zerodb` | PyPI | `pip install llama-index-vector-stores-zerodb` |
| `zerodb-local` | PyPI | `pip install zerodb-local` |
| `ainative-zerodb-memory-mcp` | npm | MCP server (6 tools) |
| `ainative-zerodb-mcp-server` | npm | MCP server (76+ tools) |

**Docs:** [docs.ainative.studio/docs/zerodb/overview](https://docs.ainative.studio/docs/zerodb/overview)
