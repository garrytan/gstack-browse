---
name: ainative-zeromemory
preamble-tier: none
version: 1.0.0
description: Add persistent cognitive memory to AI agents with ZeroMemory — store, recall, forget, reflect, relate, graph. Multi-tier memory (working/episodic/semantic) with decay scoring, semantic search, and GraphRAG hybrid retrieval. Get a free API key at ainative.studio.
allowed-tools: [Bash, Read, Write, Edit, WebFetch]
---

# ZeroMemory — Cognitive Memory for AI Agents

ZeroMemory is a cognitive memory layer for AI agents — store facts, conversations, and events; recall them semantically; build profiles and knowledge graphs.

**Get started:** `npx zerodb-cli init` or get an API key at [ainative.studio](https://ainative.studio)

## Base URL

```
https://api.ainative.studio/api/v1/public/memory/v2/
```

**Auth:** `X-API-Key: ak_...` or `Authorization: Bearer <jwt>`

## Memory Types

| Type | Lifetime | Use Case |
|------|----------|----------|
| `working` | Hours | Short-term task context (current session) |
| `episodic` | Days–Weeks | Events and experiences over time |
| `semantic` | Permanent | Facts, knowledge, general truths |

Memories automatically consolidate: working → episodic → semantic based on access frequency and importance.

## Decay Scoring

```
final_score = (similarity × 0.5) + (importance × 0.3) + (recency × 0.2)
```

## Quick Start

### Store a Memory

```python
import requests

API_KEY = "ak_your_key"
BASE = "https://api.ainative.studio/api/v1/public/memory/v2"

resp = requests.post(f"{BASE}/remember",
    headers={"X-API-Key": API_KEY},
    json={
        "content": "User prefers Python over JavaScript for backend work",
        "entity_id": "user-456",
        "memory_type": "semantic",
        "importance": 0.8,
        "tags": ["preferences", "programming"]
    }
)
memory_id = resp.json()["memory_id"]
```

### Recall by Meaning

```python
results = requests.post(f"{BASE}/recall",
    headers={"X-API-Key": API_KEY},
    json={
        "query": "What does the user like to program in?",
        "entity_id": "user-456",
        "limit": 5
    }
).json()

for memory in results["memories"]:
    print(f"[{memory['score']:.2f}] {memory['content']}")
```

### Forget, Reflect, Profile, Relate, Graph

```python
# Forget
requests.delete(f"{BASE}/forget/{memory_id}", headers={"X-API-Key": API_KEY})

# Reflect — distill insights
insights = requests.post(f"{BASE}/reflect/user-456", headers={"X-API-Key": API_KEY}).json()

# Profile — build user model
profile = requests.get(f"{BASE}/profile", headers={"X-API-Key": API_KEY},
    params={"entity_id": "user-456"}).json()

# Relate — knowledge graph edge
requests.post(f"{BASE}/relate", headers={"X-API-Key": API_KEY},
    json={"subject": "user-456", "predicate": "works_at", "object": "Acme Corp"})

# Graph — explore knowledge graph
graph = requests.get(f"{BASE}/graph", headers={"X-API-Key": API_KEY},
    params={"entity_id": "user-456", "depth": 2}).json()
```

## MCP Server (6 Tools)

```bash
npm install -g ainative-zerodb-memory-mcp
```

```json
{
  "mcpServers": {
    "memory": {
      "command": "ainative-zerodb-memory-mcp",
      "env": { "ZERODB_API_KEY": "ak_your_key" }
    }
  }
}
```

Tools: `zerodb_store_memory`, `zerodb_search_memory`, `zerodb_get_context`, `zerodb_semantic_search`, `zerodb_embed_text`, `zerodb_clear_session`

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/remember` | POST | Store a memory |
| `/recall` | POST | Semantic search |
| `/forget/{id}` | DELETE | Remove memory |
| `/reflect/{entity_id}` | POST | Generate insights |
| `/profile` | GET | Build entity profile |
| `/relate` | POST | Add graph relationship |
| `/graph` | GET | Query knowledge graph |
| `/process` | POST | Batch process memories |

## Performance

- 100% Recall@1 on LongMemEval benchmark
- 94% QA accuracy
- Free embeddings included (no OpenAI key needed)

**Docs:** [docs.ainative.studio/docs/zeromemory/overview](https://docs.ainative.studio/docs/zeromemory/overview)
