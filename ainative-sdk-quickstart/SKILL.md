---
name: ainative-sdk-quickstart
preamble-tier: none
version: 1.0.0
description: Get started with AINative SDKs in under 5 minutes. React, Next.js, Vue, Svelte, Python, and TypeScript. Chat completions, credits, auth middleware. Install and configure any AINative SDK.
allowed-tools: [Bash, Read, Write, Edit]
---

# AINative SDK Quick Start

Get AI chat completions, credits tracking, and auth in your app in under 5 minutes.

## Pick Your SDK

| SDK | Package | Framework |
|-----|---------|-----------|
| TypeScript | `@ainative/sdk` | Node.js / Browser |
| React | `@ainative/react-sdk` | React 18+ |
| Next.js | `@ainative/next-sdk` | Next.js 13+ (App Router) |
| Vue | `@ainative/vue-sdk` | Vue 3 |
| Svelte | `@ainative/svelte-sdk` | Svelte 4/5 |
| Python | `ainative-agent-sdk` | Python 3.9+ |

## React (3 minutes)

```bash
npm install @ainative/react-sdk
```

```tsx
import { AINativeProvider, useChat } from '@ainative/react-sdk';

function App() {
  return (
    <AINativeProvider apiKey="ak_your_key" projectId="your_project_id">
      <Chat />
    </AINativeProvider>
  );
}

function Chat() {
  const { messages, sendMessage, isLoading } = useChat();

  return (
    <div>
      {messages.map(m => <div key={m.id}>{m.role}: {m.content}</div>)}
      <button onClick={() => sendMessage('Hello!')} disabled={isLoading}>
        Send
      </button>
    </div>
  );
}
```

## Next.js (3 minutes)

```bash
npm install @ainative/next-sdk
```

```typescript
// app/api/chat/route.ts
import { createAINativeClient } from '@ainative/next-sdk';

const client = createAINativeClient({ apiKey: process.env.AINATIVE_API_KEY! });

export async function POST(req: Request) {
  const { messages } = await req.json();
  const stream = await client.chat.completions.create({
    model: 'claude-sonnet-4-5-20250514',
    messages,
    stream: true,
  });
  return new Response(stream);
}
```

## Vue 3 (3 minutes)

```bash
npm install @ainative/vue-sdk
```

```vue
<script setup>
import { provideAINative, useChat } from '@ainative/vue-sdk';

provideAINative({ apiKey: 'ak_your_key', projectId: 'your_project_id' });
const { messages, sendMessage, isLoading } = useChat();
</script>

<template>
  <div v-for="m in messages" :key="m.id">{{ m.role }}: {{ m.content }}</div>
  <button @click="sendMessage('Hello!')" :disabled="isLoading">Send</button>
</template>
```

## Python Agent SDK

```bash
pip install ainative-agent-sdk
```

```python
from ainative import AINativeClient

client = AINativeClient(api_key="ak_your_key")
response = client.chat.completions.create(
    model="claude-sonnet-4-5-20250514",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)
```

## Get Your API Key

1. Go to [ainative.studio](https://ainative.studio)
2. Create account (free tier available)
3. Dashboard → API Keys → Create Key
4. Copy `ak_...` key

## Add ZeroDB Memory to Any SDK

```bash
npx zerodb-cli init   # Auto-configures MCP server for your IDE
```

**Docs:** [docs.ainative.studio/docs/sdks/overview](https://docs.ainative.studio/docs/sdks/overview)
