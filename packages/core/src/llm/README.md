# Adapter Inventory

> Anti-hallucination anchor. Check this before adding a new adapter.  
> If the provider you need is here, use or extend the existing adapter.

---

## Capability Matrix

| Adapter | Class | Provider key | ping | chat | chatStream | Streaming protocol |
|---------|-------|-------------|------|------|-----------|-------------------|
| `ollama.adapter.ts` | `OllamaAdapter` | `"ollama"` | ✅ | ✅ | ✅ | XHR + NDJSON |
| `lmstudio.adapter.ts` | `LMStudioAdapter` | `"lmstudio"` | ✅ | ✅ | ✅ | XHR + SSE |
| `openai.adapter.ts` | `OpenAIAdapter` | `"openai"` | ✅ | ✅ | ✅ | XHR + SSE |
| `webhook.adapter.ts` | `WebhookAdapter` | `"webhook"` | ✅ | ✅ | ✅ | XHR + SSE |
| `a2a.adapter.ts` | `A2AAdapter` | `"a2a"` | ✅ | ✅ | ❌ | polling (JSON-RPC 2.0) |
| `lmstudio.adapter.ts` | `LMStudioAdapter` | `"custom"` | ✅ | ✅ | ✅ | same as lmstudio |

Factory: `createAdapter(config: LocalLLMConfig)` in `llm-factory.ts`

---

## Adapter Details

### OllamaAdapter
- **Endpoint:** `/api/chat`
- **Ping:** `/api/tags` — checks if model is in list
- **Streaming:** NDJSON — each line is `{"message":{"content":"<token>"},"done":false}`, final line has `"done":true`
- **No API key required** (local)

### LMStudioAdapter (also used for `"custom"`)
- **Endpoint:** `/v1/chat/completions`
- **Ping:** `/v1/models` — checks if model ID is in list
- **Streaming:** OpenAI-compatible SSE (`data: {...}` lines)
- **Important:** `response_format` is OMITTED in `chatStream()` — structured output + streaming are mutually exclusive

### OpenAIAdapter
- **Endpoint:** `/v1/chat/completions` (default: `https://api.openai.com`)
- **Ping:** `/v1/models`
- **Streaming:** OpenAI SSE — same as LMStudio but `response_format: json_schema` is included in blocking `chat()` only
- **API key required:** `Authorization: Bearer <key>`

### WebhookAdapter
- **Endpoint:** configurable (full URL as `baseUrl`)
- **Streaming:** SSE
- **Flexible:** POST body and response parsing may differ — check the implementation

### A2AAdapter
- **Protocol:** Google Agent-to-Agent JSON-RPC 2.0 (v1.0 + v0.3 backwards compat)
- **Multi-turn:** via `contextId` passed from task response
- **Polling:** `tasks/send` → poll `tasks/get` until terminal state
- **Terminal states:** COMPLETED | FAILED | CANCELED | completed | failed | canceled
- **Response extraction:** DataPart (priority) → TextPart fallback
- **No chatStream** — uses blocking `chat()` path always
- **No system prompt** — remote agent has its own identity

---

## BaseAdapter Interface

```typescript
interface BaseAdapter {
  ping(): Promise<boolean>;
  chat(messages: ChatMessages, signal?: AbortSignal): Promise<string>;
  chatStream?(messages: ChatMessages, onChunk: StreamOnChunk, signal?: AbortSignal): Promise<void>;
}
```

`chatStream` is optional. Adapters that don't support streaming omit it.
`useWireAIThread` checks `streaming && typeof adapter.chatStream === "function"` before using streaming path.

---

## StreamOnChunk Contract

```typescript
type StreamOnChunk = (accumulated: string, isDone: boolean) => void;
```

- `accumulated` = **full string so far** (not just latest delta)
- `isDone = true` = final call, stream complete
- Implemented by `useWireAIThread` — passed into `chatStream()`
