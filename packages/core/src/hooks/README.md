# Hook Inventory

> Anti-hallucination anchor. Check this before creating a new hook.

---

## Hook Table

| Hook | File | Returns | Use when |
|------|------|---------|----------|
| `useWireAIThread` | `useWireAIThread.ts` | messages, isLoading, error, errorKind, sendMessage, retry, reset, abort | Main chat thread — most apps only need this one |
| `useWireAIInput` | `useWireAIInput.ts` | value, onChangeText, onSubmit, clear | Controlled text input that feeds into sendMessage |
| `useWireAIAction` | `useWireAIAction.ts` | sendAction(msgId, name, args) | Fire a component callback back into the thread as user input |
| `useWireAIStream` | `useWireAIStream.ts` | streamContent: string | Subscribe to real-time streaming tokens for a specific messageId |
| `useLLMConfigStorage` | `useLLMConfigStorage.ts` | config, setConfig, clearConfig, isLoading | Persist and restore LLM provider config from device storage |

---

## useWireAIThread

The primary hook. Must be used inside `WireAIProvider`.

```typescript
const {
  messages,      // Message[] — full conversation history
  isLoading,     // boolean — true while waiting for LLM response
  error,         // string | null — last error message
  errorKind,     // "interrupted" | "failed" | null — why the last turn ended unanswered
  sendMessage,   // (text: string, options?: SendMessageOptions) => void
  retry,         // () => void — re-runs the last user message, no second copy
  reset,         // () => void — clears conversation
  abort,         // () => void — cancels in-flight request
} = useWireAIThread();
```

`SendMessageOptions`:
- `interruptLoading?: boolean` — if `true`, aborts any current in-flight request before sending

`errorKind` says why the last turn ended without an answer, and is `null` when the
thread is healthy. `"failed"` means the request errored and `error` carries the
message. `"interrupted"` means the app went to background mid-turn, so the request
was aborted: nothing failed, `error` stays `null`, and the user's message is sitting
there unanswered. Show an affordance and call `retry()`. The SDK never resends by
itself. `retry()` is a no-op while a send is in flight, and a no-op unless the newest
message is an unanswered user message, so calling it twice cannot double-send.

---

## useWireAIInput

Companion to `useWireAIThread`. Manages input state.

```typescript
const {
  value,          // string — current input text
  onChangeText,   // (text: string) => void — TextInput prop
  onSubmit,       // () => void — call on send button press
  clear,          // () => void — manually clear input
} = useWireAIInput({ sendMessage });
```

---

## useWireAIAction

Used by components to send their result back as a user message.

```typescript
const { sendAction } = useWireAIAction();
// Inside a component's submit handler:
sendAction(messageId, "ChipSelectCard.submit", { selected: ["Work", "Health"] });
```

This serializes the action into a user message string and calls `sendMessage`.

---

## useWireAIStream

Subscribes to the streaming store for a specific message.
Used by `ComponentRenderer` to get partial content during streaming.

```typescript
const streamContent = useWireAIStream(messageId);
// streamContent: string — accumulated tokens so far (empty if not streaming)
```

Uses rAF-coalesced re-renders (batches updates to ~60fps).

---

## useLLMConfigStorage

Persists LLM config across app sessions using a storage backend.

```typescript
const {
  config,      // LocalLLMConfig | null — currently stored config
  setConfig,   // (config: LocalLLMConfig) => Promise<void>
  clearConfig, // () => Promise<void>
  isLoading,   // boolean — true while reading from storage on mount
} = useLLMConfigStorage({ storageBackend });
```

`storageBackend: StorageBackend` — implement `getItem`, `setItem`, `removeItem`.
