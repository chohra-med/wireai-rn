# WireAI SDK — Developer Documentation

> **Version**: 0.1.2 · **License**: MIT · **Website**: [getwireai.com](https://getwireai.com)

Wire your AI agent to native mobile UI. Open-source React Native SDK for generative UI — render interactive native components from LLM responses.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Installation](#2-installation)
3. [Quick Start (3 minutes)](#3-quick-start)
4. [LLM Provider Setup](#4-llm-provider-setup)
5. [Writing Custom Components](#5-writing-custom-components)
6. [Built-in Components Reference](#6-built-in-components-reference)
7. [Hooks Reference](#7-hooks-reference)
8. [Context Budget & Trimming](#8-context-budget--trimming)
9. [Persistence](#9-persistence)
10. [Security](#10-security)
11. [Design System](#11-design-system)
12. [Error Handling](#12-error-handling)
13. [Testing](#13-testing)
14. [Performance Best Practices](#14-performance-best-practices)
15. [Production Deployment Checklist](#15-production-deployment-checklist)

---

## 1. Architecture Overview

```
User Input
    │
    ▼
useWireAIThread()
    │  - Appends user message to history
    │  - Trims history to context budget
    │  - Prepends system prompt (built from registry)
    ▼
LLM Adapter (Ollama / LMStudio / OpenAI / Webhook)
    │  - Sends messages array
    │  - Returns raw JSON string
    ▼
validateLLMResponse()
    │  - Extracts JSON (strips markdown fences, prose)
    │  - Parses { action, component, props, message }
    │  - Rescues "spilled props" (Gemini pattern)
    │  - Validates component exists in registry
    ▼
ComponentRenderer
    │  - Looks up component in registry
    │  - Validates props with Zod schema
    │  - Merges defaultProps → validated props → callbackOverrides → injected
    │  - Renders inside ComponentErrorBoundary
    ▼
Native UI (React Native component)
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Flat turn model (one component per LLM response) | Simpler prompt, more predictable LLM output, easier validation |
| Zod schemas for props | Runtime validation + auto-generated system prompt (no separate schema maintenance) |
| Registry pattern (Map<name, def>) | O(1) lookup, composable, user-controlled component set |
| Adapter pattern for LLMs | Swap provider without touching app code |
| `adapterRef` + `systemPromptRef` | Prevents rebuilding adapter/prompt on every message send |
| `StorageBackend` interface (not a concrete library) | SDK has zero Expo/AsyncStorage dependencies |

---

## 2. Installation

```bash
npm install wireai-rn zod
# or
yarn add wireai-rn zod
```

**Peer dependencies** (you likely already have these):
```json
{
  "react": ">=18.0.0",
  "react-native": ">=0.73.0",
  "zod": ">=3.22.0"
}
```

> **Note:** Zod v3 only. Zod v4 has breaking API changes and is not compatible.

---

## 3. Quick Start

### Step 1 — Wrap your app

```tsx
import { WireAIProvider } from "wireai-rn";
import { defaultComponents } from "wireai-rn/components"; // 11 built-ins

<WireAIProvider
  llm={{ provider: "ollama", baseUrl: "http://localhost:11434", model: "llama3" }}
  components={defaultComponents}
>
  <YourChatScreen />
</WireAIProvider>
```

### Step 2 — Build a chat screen

```tsx
import {
  useWireAIThread,
  useWireAIInput,
  useWireAIAction,
  ComponentRenderer,
  LoadingState,
} from "wireai-rn";
import type { Message } from "wireai-rn";

function ChatScreen() {
  const { messages, isLoading, error, sendMessage, abort } = useWireAIThread();
  const { inputText, setInputText, handleSubmit } = useWireAIInput(sendMessage);
  const createCallbacks = useWireAIAction(sendMessage);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length]);

  const renderItem = ({ item }: { item: Message }) => {
    if (item.role === "user") {
      return <UserBubble text={item.content} />;
    }
    if (item.role === "assistant" && item.response) {
      return (
        <ComponentRenderer
          messageId={item.id}
          response={item.response}
          callbackOverrides={createCallbacks(item.id)}
        />
      );
    }
    return null;
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <FlatList ref={listRef} data={messages} keyExtractor={(m) => m.id} renderItem={renderItem} />
      {isLoading && <LoadingState />}
      {error && <Text style={{ color: "red" }}>{error}</Text>}
      <TextInput value={inputText} onChangeText={setInputText} onSubmitEditing={handleSubmit} />
      <Button title={isLoading ? "Stop" : "Send"} onPress={isLoading ? abort : handleSubmit} />
    </KeyboardAvoidingView>
  );
}
```

### Step 3 — Register a custom component

```tsx
import { z } from "zod";
import type { WireAIComponent } from "wireai-rn";

const schema = z.object({
  question: z.string().describe("Question to display to the user"),
  options: z.array(z.string()).describe("4-6 mood labels"),
});

type Props = z.infer<typeof schema> & { onSelect?: (value: string) => void };

const MoodSelectorView: React.FC<Props> = React.memo(({ question, options, onSelect }) => {
  // ... your component implementation
});

export const MoodSelector: WireAIComponent<typeof schema> = {
  name: "MoodSelector",
  description:
    "Use when checking the user's current mood or emotional state at the start of a session. " +
    "Provide 4-6 warm, non-clinical mood labels as options.",
  component: MoodSelectorView,
  propsSchema: schema,
};
```

Then pass to the provider:

```tsx
<WireAIProvider components={[MoodSelector, ...defaultComponents]}>
```

---

## 4. LLM Provider Setup

Whichever provider you pick, the SDK has no offline or cold-start lane: if it is unreachable the turn rejects and surfaces as `error` on `useWireAIThread`, on the first turn as much as any later one, with no cached first question and no automatic retry. Read `errorKind` and offer `retry()` so the user can re-run the turn.

### 4.1 Ollama (Local)

```ts
const config: LocalLLMConfig = {
  provider: "ollama",
  baseUrl: "http://localhost:11434",
  model: "llama3",
};
```

**Physical device?** Use your machine's local network IP:
```ts
baseUrl: "http://192.168.1.42:11434"
```

**Best models for generative UI:**
- `llama3` — good balance of quality + speed
- `mistral` — fast, strong JSON adherence  
- `phi4` — small, great for < 10 components

**Connectivity check:** WireAI pings `GET /api/tags` in `__DEV__` on mount.

### 4.2 LM Studio (Local)

```ts
const config: LocalLLMConfig = {
  provider: "lmstudio",
  baseUrl: "http://localhost:1234",
  model: "llama-3-8b-instruct",
};
```

Start the server in LM Studio via the ▶ button before running your app. LM Studio uses structured output (`json_schema` format) for more reliable JSON.

### 4.3 OpenAI (Cloud)

```ts
const config: LocalLLMConfig = {
  provider: "openai",
  baseUrl: "https://api.openai.com", // or omit — this is the default
  model: "gpt-4o-mini",
  apiKey: process.env.OPENAI_API_KEY, // ⚠️ ONLY in development!
};
```

> ⚠️ **Never ship `apiKey` in a production mobile build.** See [Security](#10-security).

**Supported models:** `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo-1106+`

**Azure OpenAI / OpenRouter:** Override `baseUrl`:
```ts
baseUrl: "https://myazure.openai.azure.com",
```

### 4.4 Webhook / Custom Backend (Production)

```ts
const config: LocalLLMConfig = {
  provider: "webhook",
  baseUrl: "https://api.yourapp.com/ai/chat",
  model: "gpt-4o", // passed to your backend
  apiKey: "your-internal-token", // optional — becomes Bearer token
};
```

WireAI sends `POST /ai/chat` with body:
```json
{
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "Hello" }
  ],
  "model": "gpt-4o"
}
```

Your backend can return any of:
```json
{ "content": "..." }
{ "response": "..." }
{ "output": "..." }
{ "message": "..." }
```

**Headers sent:** `Content-Type: application/json`, `Authorization: Bearer <apiKey>` (if set)

### 4.5 Custom Provider

```ts
import { createAdapter } from "wireai-rn";

const config: LocalLLMConfig = {
  provider: "custom",
  baseUrl: "...",
  model: "...",
};

// Or implement BaseAdapter directly:
import type { BaseAdapter } from "wireai-rn";

class MyAdapter implements BaseAdapter {
  async ping(): Promise<boolean> { return true; }
  async chat(messages, signal?): Promise<string> { /* your implementation */ }
}
```

---

## 5. Writing Custom Components

### 5.1 Full Pattern

```tsx
import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { colors, radii, spacing, textStyles, Btn } from "wireai-rn";
import type { InjectedProps } from "wireai-rn";
import type { WireAIComponent } from "wireai-rn";

// Step 1: Zod schema (all fields JSON-serializable, all fields described)
const schema = z.object({
  title: z.string().describe("Card heading, 5-10 words"),
  options: z.array(z.string()).describe("2-5 selectable options"),
  multiSelect: z.boolean().optional().describe("Allow multiple selections, default: false"),
});

// Step 2: Props type = schema inference + InjectedProps + callback props
type Props = z.infer<typeof schema> &
  InjectedProps & {
    onSelect?: (values: string | string[]) => void;
  };

// Step 3: Component implementation
const _MySelectCard: React.FC<Props> = ({ title, options, multiSelect = false, onSelect }) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const handlePress = useCallback(
    (option: string) => {
      if (submitted) return; // one-shot pattern
      let next: string[];
      if (multiSelect) {
        next = selected.includes(option) ? selected.filter((s) => s !== option) : [...selected, option];
        setSelected(next);
      } else {
        setSubmitted(true);
        onSelect?.(option);
      }
    },
    [submitted, selected, multiSelect, onSelect]
  );

  const handleSubmitMulti = useCallback(() => {
    if (submitted || selected.length === 0) return;
    setSubmitted(true);
    onSelect?.(selected);
  }, [submitted, selected, onSelect]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {options.map((opt) => (
        <Pressable
          key={opt}
          style={[styles.option, selected.includes(opt) && styles.optionActive]}
          onPress={() => handlePress(opt)}
          disabled={submitted}
        >
          <Text style={[styles.optionText, selected.includes(opt) && styles.optionTextActive]}>
            {opt}
          </Text>
        </Pressable>
      ))}
      {multiSelect && selected.length > 0 && !submitted && (
        <Btn title="Confirm" onPress={handleSubmitMulti} variant="primary" />
      )}
    </View>
  );
};

// Step 4: Export the component definition
export const MySelectCard: WireAIComponent<typeof schema> = {
  name: "MySelectCard",
  description:
    "Use when offering 2-5 selectable choices from a defined list. " +
    "Use ChipSelectCard instead for compact tags (moods, activities, seasons). " +
    "Use SelectionCard instead when labels are longer than 3 words.",
  component: React.memo(_MySelectCard),
  propsSchema: schema,
  defaultProps: { multiSelect: false },
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  title: { ...textStyles.h4, color: colors.text },
  option: {
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primaryBackground },
  optionText: { ...textStyles.body, color: colors.text },
  optionTextActive: { color: colors.primary, fontWeight: "600" },
});
```

### 5.2 Component Rules

| Rule | Reason |
|------|--------|
| `React.memo` on every component | Prevents re-render when registry re-renders |
| `useCallback` on all handlers | Stable reference, prevents child re-renders |
| Submitted-state pattern | One-shot UX — never allow double-submit |
| `StyleSheet.create` only | No inline style objects in render |
| No functions in Zod schema | Functions can't be serialized to JSON |
| `.describe()` on every Zod field | Used to auto-generate LLM system prompt |
| Description = routing instruction | Written for the LLM, not for humans |
| Respect `disabled` prop from `submitted` | Visually prevents interaction after completion |

### 5.3 Description Writing Guide

The `description` field is read by the LLM to decide which component to use. Write it as a routing rule:

```ts
// ✅ GOOD: tells LLM when, how, and when NOT to use it
description:
  "Use when the user needs to select a single destination from 3-6 options with a title and description. " +
  "Use SelectionCard instead when options are single words or short phrases. " +
  "Use ChipSelectCard instead when options are tags without descriptions.",

// ❌ BAD: describes the UI, not the routing
description: "A card with a list of items that have title and description",
```

### 5.4 Callback Prop Naming

WireAI injects callbacks via `callbackOverrides`. Your component receives them as regular props. Use these standard names to get automatic callback injection from `useWireAIAction`:

| Prop name | `useWireAIAction` produces | Message sent |
|-----------|---------------------------|--------------|
| `onSubmit(value)` | yes | `My answer is: <JSON(value)>` |
| `onSelect(value)` | yes | `I selected: <JSON(value)>` |
| `onConfirm(payload?)` | yes | `I selected: <JSON(payload)>` or `Yes, confirmed.` |
| `onDeny()` | yes | `No, cancel that.` |
| `onPress(label)` | yes | `I tapped: <label>` |
| `onContinue()` | via custom | `Continue.` |
| `onCancel()` | via custom | `No, cancel.` |

---

## 6. Built-in Components Reference

All imported from `wireai-rn/components` (or `wireai-rn` for individual access).

### ActionCard

**When:** After InfoList, StepList, StatusCard to offer next-step choices. Required when the user says "Continue." Never use StatusCard as an acknowledgment.

```json
{
  "action": "render",
  "component": "ActionCard",
  "props": {
    "title": "What's next?",
    "body": "Here are some things I can help with:",
    "primaryLabel": "Get a recipe for Hummus",
    "primaryAction": "recipe_hummus",
    "secondaryLabel": "Explore Mediterranean cuisine",
    "secondaryAction": "cuisine_med",
    "tertiaryLabel": "Start a new search",
    "tertiaryAction": "new_search"
  }
}
```

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | string | ✅ | Card heading |
| `body` | string | | Supporting description |
| `primaryLabel` | string | ✅ | Primary button label |
| `primaryAction` | string | ✅ | Action key emitted on primary press |
| `secondaryLabel` | string | | Optional second button |
| `secondaryAction` | string | | Action key for second button |
| `tertiaryLabel` | string | | Optional third button |
| `tertiaryAction` | string | | Action key for third button |

### ChipSelectCard

**When:** Pick one or many from compact labels (moods, activities, tags, seasons). Use when labels are 1-3 words.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `label` | string | ✅ | Question or prompt |
| `chips` | string[] | ✅ | Array of compact labels |
| `multiSelect` | boolean | | Allow multiple, default: false |
| `maxSelections` | number | | Cap on multi-select |

### ConfirmPrompt

**When:** Binary yes/no decision before a consequential action.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `message` | string | ✅ | Confirmation question |
| `confirmLabel` | string | | Confirm button text, default: "Yes" |
| `denyLabel` | string | | Deny button text, default: "No" |

### ContentSelectCard

**When:** Select from items where each has a title AND description (dishes, recipes, destinations, topics). Use InfoList instead for read-only display without selection.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `label` | string | ✅ | Card heading |
| `items` | `{title, description}[]` | ✅ | Selectable items with description |

### InfoList

**When:** Read-only key/value summary (trip summary, booking confirmation, user profile). Never use if the user might want to select an item — use ContentSelectCard instead.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `label` | string | ✅ | List heading |
| `items` | `{key, value}[]` | ✅ | Key-value pairs to display |
| `ctaLabel` | string | | Required! CTA button text |
| `ctaAction` | string | | Action key for CTA |

> **Always provide `ctaLabel`** — InfoList has no buttons of its own. Without a CTA, the conversation is dead.

### MessageBubble

**When:** A plain text response. Use as a transition, not as a final response. Prefer using the optional `"message"` field on render responses instead.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `message` | string | ✅ | Message text |
| `type` | `"text"\|"emphasis"\|"success"\|"error"` | | Visual variant |

### NumberStepperCard

**When:** Pick a number with known bounds (days, people, rating 1-10, budget).

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `label` | string | ✅ | Prompt (e.g. "How many days?") |
| `min` | number | ✅ | Minimum value |
| `max` | number | ✅ | Maximum value |
| `unit` | string | | Unit label (e.g. "days", "people") |
| `initialValue` | number | | Starting value, default: min |

### SelectionCard

**When:** Pick one from a list with longer labels (travel styles, dietary needs, relationship types). Use ChipSelectCard for compact single-word tags.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `label` | string | ✅ | Question or prompt |
| `options` | string[] | ✅ | List of options |
| `initialValue` | string | | Pre-selected value |

### StatusCard

**When:** Show a real outcome — confirmed booking, saved data, completed action, error. **Never** use as "you just viewed something" acknowledgment.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `status` | `"success"\|"error"\|"info"` | ✅ | Visual state |
| `title` | string | ✅ | Status heading |
| `message` | string | | Supporting text |
| `ctaLabel` | string | | CTA button text |
| `ctaAction` | string | | Action key for CTA |

### StepList

**When:** Show ordered steps, an itinerary, or a process. Always include `ctaLabel`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `label` | string | ✅ | List heading |
| `steps` | `{title, description?}[]` | ✅ | Ordered steps |
| `ctaLabel` | string | | CTA button text (required for non-dead-end) |
| `ctaAction` | string | | Action key for CTA |

### TextInputCard

**When:** Collect free-text (name, destination, open-ended answer). Use NumberStepperCard for numeric answers with known bounds.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `label` | string | ✅ | Input field label |
| `placeholder` | string | | Placeholder hint text |
| `submitLabel` | string | | Submit button text, default: "Submit" |

---

## 7. Hooks Reference

### `useWireAIThread()`

Core conversation management hook. Must be called inside `<WireAIProvider>`.

```ts
const {
  messages,     // Message[] — full conversation history
  isLoading,    // boolean — LLM request in flight
  error,        // string | null — last error message
  errorKind,    // "interrupted" | "failed" | null — why the last turn ended unanswered
  sendMessage,  // (text: string, options?: SendMessageOptions) => void
  retry,        // () => void — re-run the last user message
  abort,        // () => void — cancel in-flight request
  reset,        // () => void — clear history, return to initial state
} = useWireAIThread();
```

**`errorKind` and `retry`:** `errorKind` is `null` while the thread is healthy.
`"failed"` means the request errored and `error` carries the message.
`"interrupted"` means the app went to background mid-turn and the request was
aborted: nothing failed, `error` stays `null`, and the user's message sits in
the thread unanswered. Show a retry affordance and call `retry()`. The SDK never
resends by itself. `retry()` re-runs the last user message without appending a
second copy of it, and is a no-op while a send is in flight or when the newest
message is not an unanswered user message.

**`sendMessage` options:**
```ts
sendMessage("text", {
  interruptLoading: true, // abort current request and send this one immediately
});
```

### `useWireAIInput(sendMessage)`

Manages text input state for a chat input field.

```ts
const {
  inputText,     // string — current input value
  setInputText,  // (text: string) => void
  handleSubmit,  // () => void — trims, sends, clears input
} = useWireAIInput(sendMessage);
```

### `useWireAIAction(sendMessage)`

Returns a factory that creates callback objects for `ComponentRenderer.callbackOverrides`.

```ts
const createCallbacks = useWireAIAction(sendMessage);

// In renderItem:
<ComponentRenderer
  messageId={item.id}
  response={item.response}
  callbackOverrides={createCallbacks(item.id)}
/>
```

**Callbacks produced per messageId:**

```ts
{
  onConfirm: (payload?: unknown) => void,  // sends "Yes, confirmed." or "I selected: ..."
  onDeny: () => void,                       // sends "No, cancel that."
  onSubmit: (value: unknown) => void,       // sends "My answer is: ..."
  onSelect: (value: unknown) => void,       // sends "I selected: ..."
  onPress: (label: string) => void,         // sends "I tapped: ..."
}
```

### `useLLMConfigStorage(storage, defaultConfig)`

Persistent LLM config storage with any backend (SecureStore, MMKV, AsyncStorage).

```ts
const { config, isLoaded, saveConfig, clearConfig } = useLLMConfigStorage(
  secureStorageBackend, // StorageBackend: { getItem, setItem, deleteItem }
  defaultConfig,        // LocalLLMConfig — used when no stored config exists
);

// Wait for load before rendering:
if (!isLoaded) return <SplashScreen />;
```

**SecureStore backend (Expo):**

```ts
import * as SecureStore from "expo-secure-store";
import type { StorageBackend } from "wireai-rn";

export const secureStorageBackend: StorageBackend = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  deleteItem: (key) => SecureStore.deleteItemAsync(key),
};
```

**MMKV backend (for message history):**

```ts
import { MMKV } from "react-native-mmkv";

const storage = new MMKV({ id: "wireai-messages" });

export const mmkvBackend: StorageBackend = {
  getItem: async (key) => storage.getString(key) ?? null,
  setItem: async (key, value) => storage.set(key, value),
  deleteItem: async (key) => storage.delete(key),
};
```

---

## 8. Context Budget & Trimming

WireAI limits how many messages are sent to the LLM to avoid hitting token limits.

### Configuration

```tsx
<WireAIProvider
  maxContextMessages={20}   // Max messages in history (default: 20)
  maxContextChars={12000}   // Max total chars (~3k tokens) (default: 12000)
>
```

### How trimming works

1. Take the last `maxContextMessages` messages (most recent first)
2. Walk backwards accumulating char count
3. Stop when `maxChars` exceeded (but always keep at least 1 message)
4. System prompt is prepended at the call site — never stored in state

### Dev warnings

```
[WireAI] context trimmed { kept: 15, total: 45 }
[WireAI] context budget at 80%+ { ratio: "0.85" }
```

### Tuning guide

| Use case | maxContextMessages | maxContextChars |
|----------|--------------------|-----------------|
| Local small model (Llama 3 8B) | 10 | 6000 |
| Local medium model (Mistral 7B) | 15 | 8000 |
| Cloud model (GPT-4o-mini) | 25 | 15000 |
| Long coaching sessions | 30 | 20000 |

---

## 9. Persistence

### 9.1 API Key Persistence (SecureStore)

```tsx
// In your root navigator
const { config, isLoaded, saveConfig } = useLLMConfigStorage(
  secureStorageBackend,
  { provider: "openai", baseUrl: "https://api.openai.com", model: "gpt-4o-mini" }
);

if (!isLoaded) return null; // prevent flash of wrong config

// In ConfigPanel:
<ConfigPanel onSave={saveConfig} initialConfig={config} />
```

Keys are stored in iOS Keychain / Android Keystore via `expo-secure-store`. They survive app restarts and are excluded from device backups by default.

### 9.2 Message History Persistence (MMKV)

```tsx
import { useState, useEffect } from "react";
import type { Message } from "wireai-rn";

const HISTORY_KEY = "wireai-thread-v1";

export const AppNavigator = () => {
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    mmkvBackend.getItem(HISTORY_KEY).then((raw) => {
      if (raw) {
        try { setInitialMessages(JSON.parse(raw) as Message[]); } catch {}
      }
      setHistoryLoaded(true);
    });
  }, []);

  if (!historyLoaded) return null;

  return (
    <WireAIProvider
      llm={config}
      components={defaultComponents}
      initialMessages={initialMessages}
      onThreadUpdate={(messages) => {
        mmkvBackend.setItem(HISTORY_KEY, JSON.stringify(messages));
      }}
    >
      <ChatScreen />
    </WireAIProvider>
  );
};
```

### 9.3 Clearing History

```tsx
// Add a "Clear conversation" button that calls:
const handleClear = async () => {
  await mmkvBackend.deleteItem(HISTORY_KEY);
  reset(); // from useWireAIThread()
};
```

---

## 10. Security

### 10.1 The Problem

React Native JavaScript bundles are plain text. Anyone can extract an `.apk` or `.ipa` and read the bundle with:

```bash
# iOS
unzip YourApp.ipa
strings Payload/YourApp.app/*.js | grep "sk-"

# Android
apktool d app-release.apk
grep -r "sk-" ./smali
```

A hardcoded `sk-...` key **will be stolen** within hours of an app store release.

### 10.2 The Solution: WebhookAdapter

For production, route all LLM requests through your backend:

```
Your App → POST /ai/chat → Your Backend → OpenAI / Anthropic
```

```tsx
// App config (no API key)
const config: LocalLLMConfig = {
  provider: "webhook",
  baseUrl: "https://api.yourapp.com/ai/chat",
  model: "gpt-4o",
};
```

```ts
// Your backend (Node.js / Python / Go — your key stays here)
app.post("/ai/chat", authenticate, async (req, res) => {
  const { messages, model } = req.body;
  const response = await openai.chat.completions.create({ model, messages });
  res.json({ content: response.choices[0].message.content });
});
```

### 10.3 Built-in Warnings

WireAI automatically warns you:

| Location | Warning | Trigger |
|----------|---------|---------|
| `WireAIProvider` (`__DEV__`) | Security: API keys found in LLM config | `apiKey` present in dev |
| `OpenAIAdapter` (`__DEV__`) | No apiKey provided | `apiKey` missing in dev |
| `OpenAIAdapter` (production) | apiKey in production build | `apiKey` present in release |

---

## 11. Design System

WireAI ships a cohesive design token set based on the Violet + Ink palette:

```ts
import { colors, spacing, radii, textStyles, iconSizes, widths } from "wireai-rn";
```

### Colors

```ts
colors.primary          // #7C3AED — violet-600
colors.primaryBackground // #EDE9FE — violet-100 (light tint)
colors.background       // #FFFFFF (light) / #09090B (dark)
colors.backgroundSecondary // #F4F4F5 / #18181B
colors.text             // #09090B / #FAFAFA
colors.textSecondary    // #71717A
colors.textInverse      // #FFFFFF
colors.border           // #E4E4E7
colors.error            // #EF4444
colors.disabled         // #D4D4D8

// Access dark mode tokens directly:
import { darkColors } from "wireai-rn";
```

### Spacing

```ts
spacing.xs   // 4
spacing.sm   // 8
spacing.md   // 16
spacing.lg   // 24
spacing.xl   // 32
spacing["2xl"] // 48
spacing["3xl"] // 64
```

### Border Radius

```ts
radii.xs  // 4
radii.sm  // 8
radii.md  // 12
radii.lg  // 16
radii.xl  // 24
radii.full // 9999
```

### Typography

```ts
textStyles.h1    // fontSize: 32, fontWeight: 700
textStyles.h2    // fontSize: 28, fontWeight: 700
textStyles.h3    // fontSize: 24, fontWeight: 600
textStyles.h4    // fontSize: 20, fontWeight: 600
textStyles.h5    // fontSize: 17, fontWeight: 600
textStyles.body  // fontSize: 15, fontWeight: 400
textStyles.caption // fontSize: 13, fontWeight: 400
```

### UI Primitives

```ts
import { Btn, InputField } from "wireai-rn";

// Btn props
<Btn
  title="Submit"
  onPress={handleSubmit}
  variant="primary" // "primary" | "outline" | "ghost"
  disabled={false}
/>

// InputField props
<InputField
  value={value}
  onChangeText={setValue}
  placeholder="Type here..."
  multiline={false}
  editable={true}
  secureTextEntry={false}
  returnKeyType="send"
  onSubmitEditing={handleSubmit}
/>
```

---

## 12. Error Handling

### 12.1 Component Error Boundary

Every component is automatically wrapped in `ComponentErrorBoundary`. If a component throws during render, the error is caught, logged in `__DEV__`, and replaced with `FallbackMessage`.

```tsx
// FallbackMessage shown on component crash:
<View style={{ padding: 16, backgroundColor: '#FEF2F2', borderRadius: 12 }}>
  <Text style={{ color: '#EF4444' }}>
    [ComponentName] failed to render. See console for details.
  </Text>
</View>
```

### 12.2 LLM Error Handling

```tsx
const { error } = useWireAIThread();

// error is null when no error, string message otherwise
{error && (
  <View style={styles.errorBar}>
    <Text style={styles.errorText}>{error}</Text>
  </View>
)}
```

Common errors:
- `OpenAI error 401: ...` — Invalid API key
- `OpenAI error 404: ...` — Wrong URL (check baseUrl, no double /v1)
- `OpenAI request timed out` — Increase `timeoutMs` in config
- `LLM response could not be parsed` — Model not following JSON instructions

### 12.3 Dev Logging

All `[WireAI]` prefixed logs are from the SDK's `devLog` utility:

```
LOG  [WireAI] LLM request { provider, model, messageCount, lastUserMsg }
LOG  [WireAI] LLM response { raw: "..." }
LOG  [WireAI] parsed response { action, component }
WARN [WireAI] ComponentRenderer: props validation failed for TextInputCard
WARN [WireAI] context trimmed { kept: 12, total: 24 }
ERROR [WireAI] ComponentErrorBoundary caught error in SelectionCard
```

These logs are automatically stripped in production builds (`__DEV__ === false`).

---

## 13. Testing

### 13.1 Testing Custom Components

```ts
import { render, fireEvent } from "@testing-library/react-native";
import { MySelectCard } from "./MySelectCard";

test("calls onSelect with chosen option", () => {
  const onSelect = jest.fn();
  const { getByText } = render(
    <MySelectCard
      messageId="msg-1"
      title="Pick a mood"
      options={["Happy", "Neutral", "Stressed"]}
      onSelect={onSelect}
    />
  );

  fireEvent.press(getByText("Happy"));
  expect(onSelect).toHaveBeenCalledWith("Happy");
});

test("prevents double-select after first selection", () => {
  const onSelect = jest.fn();
  const { getByText } = render(
    <MySelectCard messageId="m1" title="Pick" options={["A", "B"]} onSelect={onSelect} />
  );

  fireEvent.press(getByText("A"));
  fireEvent.press(getByText("B")); // should be ignored
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onSelect).toHaveBeenCalledWith("A");
});
```

### 13.2 Testing Response Validation

```ts
import { validateLLMResponse } from "wireai-rn";
import { createComponentRegistry } from "wireai-rn";
import { defaultComponents } from "wireai-rn/components";

const registry = createComponentRegistry(defaultComponents);

test("parses render response", () => {
  const raw = JSON.stringify({
    action: "render",
    component: "ActionCard",
    props: { title: "Next steps", primaryLabel: "Continue", primaryAction: "continue" },
  });

  const result = validateLLMResponse(raw, registry);
  expect(result.action).toBe("render");
});
```

### 13.3 Running Tests

```bash
cd packages/core
yarn test         # run once
yarn test --watch # watch mode
yarn test --coverage # with coverage report
```

---

## 14. Performance Best Practices

### 14.1 Registry Size

Keep your component registry under 10 components for local models (Llama, Phi, Mistral). More components = longer system prompt = more tokens consumed = slower responses.

**Strategy:**
- Start with 5-6 components
- Add components progressively as you discover UI patterns
- Separate specialized components into their own `<WireAIProvider>` if your app has very different screens

### 14.2 Context Budget Tuning

For local models, use smaller budgets:

```tsx
// For llama3 8B running locally
<WireAIProvider maxContextMessages={10} maxContextChars={6000}>

// For GPT-4o-mini via cloud
<WireAIProvider maxContextMessages={30} maxContextChars={20000}>
```

### 14.3 Avoiding Re-renders

```tsx
// ✅ GOOD: stable component array reference
const COMPONENTS = [MyCard, ...defaultComponents]; // defined outside component

// ❌ BAD: new array on every render triggers registry rebuild
<WireAIProvider components={[MyCard, ...defaultComponents]}>
```

```tsx
// ✅ GOOD: stable callbacks via useWireAIAction
const createCallbacks = useWireAIAction(sendMessage);
<ComponentRenderer callbackOverrides={createCallbacks(item.id)} />

// ❌ BAD: inline object creates new reference every render
<ComponentRenderer callbackOverrides={{ onSubmit: (v) => sendMessage(...) }} />
```

### 14.4 FlatList Optimization

```tsx
<FlatList
  data={messages}
  keyExtractor={(item) => item.id}         // stable key
  renderItem={renderItem}                   // defined with useCallback
  removeClippedSubviews={true}              // unmount off-screen items
  maxToRenderPerBatch={5}                   // batch size
  windowSize={10}                           // render window
  initialNumToRender={10}                   // initial render count
/>
```

---

## 15. Production Deployment Checklist

- [ ] Replace `OpenAIAdapter` with `WebhookAdapter` (never ship raw API keys)
- [ ] Backend validates user session before forwarding to LLM
- [ ] Set appropriate `maxContextMessages` and `maxContextChars` for your model
- [ ] `useLLMConfigStorage` uses `expo-secure-store` (not AsyncStorage) for keys
- [ ] Component registry has ≤ 15 components
- [ ] All custom components use `React.memo` + `useCallback`
- [ ] All custom components implement submitted-state pattern
- [ ] Error UI shown when `error !== null`
- [ ] Tested on both iOS and Android
- [ ] `__DEV__` builds pass: `yarn typecheck` + `yarn test` + `yarn build`

---

## Dependencies

| Package | Version | Role |
|---------|---------|------|
| `react` | >=18.0.0 | Framework (peer dep) |
| `react-native` | >=0.73.0 | Platform (peer dep) |
| `zod` | >=3.22.0 (v3 only) | Schema validation |
| `expo-secure-store` | >=13.0.0 | API key storage (optional, app-level) |
| `react-native-mmkv` | >=2.0.0 | Message history storage (optional, app-level) |

---

## Changelog

See [packages/core/CHANGELOG.md](packages/core/CHANGELOG.md) for version history.

---

**Built by [Malik Chohra](https://getwireai.com)** · MIT License
