# wireai-rn

**Wire your AI agent to native mobile UI.**

Open-source React Native SDK for generative UI — render interactive native components from LLM responses. No custom parsers. No prompt engineering. Works with Ollama, LM Studio, or any HTTP agent endpoint.

[![npm version](https://img.shields.io/npm/v/wireai-rn.svg)](https://www.npmjs.com/package/wireai-rn)
[![license](https://img.shields.io/npm/l/wireai-rn.svg)](https://github.com/chohra-med/wireai-rn/blob/main/LICENSE)

---

## The Problem

AI agents speak text. Mobile users expect native UI. Nothing bridges them in React Native.

Your agent works — it answers questions, follows instructions, produces useful output. But when someone asks for a mobile app, your options are: a text chat that feels like 2018, a WebView wrapper that feels cheap, or a custom UI that takes months.

**WireAI fills this gap.** Register your components with a description and Zod schema. The agent decides which to render. WireAI validates the props and renders it natively.

---

## Install

```bash
npm install wireai-rn zod
```

---

## Quickstart (3 minutes)

### 1. Wrap your app

```tsx
import { WireAIProvider } from "wireai-rn";
import { defaultComponents } from "./components";

const LLM_CONFIG = {
  provider: "ollama" as const,
  baseUrl: "http://localhost:11434",
  model: "llama3",
};

export default function App() {
  return (
    <WireAIProvider llm={LLM_CONFIG} components={defaultComponents}>
      <ChatScreen />
    </WireAIProvider>
  );
}
```

### 2. Use the thread hook

```tsx
import { useWireAIThread, useWireAIInput, ComponentRenderer } from "wireai-rn";

function ChatScreen() {
  const { messages, sendMessage, isLoading } = useWireAIThread();
  const { inputText, setInputText, handleSubmit } = useWireAIInput(sendMessage);

  return (
    <FlatList
      data={messages}
      renderItem={({ item }) =>
        item.response?.action === "render" ? (
          <ComponentRenderer
            messageId={item.id}
            response={item.response}
          />
        ) : (
          <Text>{item.content}</Text>
        )
      }
    />
  );
}
```

### 3. Register components

```tsx
import { z } from "zod";
import type { WireAIComponent } from "wireai-rn";

const schema = z.object({
  question: z.string().describe("Question to ask the user"),
  options: z.array(z.string()).describe("3-6 selectable options"),
});

export const MoodSelector: WireAIComponent<typeof schema> = {
  name: "MoodSelector",
  description:
    "Use when checking how the user is feeling. " +
    "Ideal for opening a coaching session. " +
    "Provide 4-6 warm, non-clinical mood labels.",
  component: MoodSelectorView,
  propsSchema: schema,
};
```

**That's it.** The LLM now knows when and how to render your component.

---

## How It Works

```
Your AI Agent                    Your Mobile App
(speaks JSON)    ←── WireAI ──→  (speaks React Native)
```

1. **Register** your components with a name, description, and Zod schema
2. WireAI **auto-generates** the LLM system prompt from your registry
3. The agent returns JSON → WireAI **validates** every prop before rendering
4. User interactions feed **back to the agent** as natural language
5. The agent responds with the **next component** — the loop continues

---

## Built-in Components (11)

| Component | Use When |
|---|---|
| `ActionCard` | Offering 1–3 next-step options with a CTA button |
| `ChipSelectCard` | Quick selection from 3–8 compact labels (moods, tags) |
| `ConfirmPrompt` | Asking yes/no or confirming an action |
| `ContentSelectCard` | Selecting from items with title + description |
| `InfoList` | Displaying read-only key/value summary data |
| `MessageBubble` | Showing a text chat message |
| `NumberStepperCard` | Picking a number within a range (days, people) |
| `SelectionCard` | Choosing one option from a short list with longer labels |
| `StatusCard` | Showing success, error, or info status |
| `StepList` | Displaying ordered steps or itinerary |
| `TextInputCard` | Collecting free-text input (name, destination) |

All components use plain React Native primitives — no external styling library required.

---

## Supported LLM Providers

| Provider | Status | Setup |
|---|---|---|
| **Ollama** | ✅ Free | `ollama serve` + `ollama pull llama3` |
| **LM Studio** | ✅ Free | Load a model, start local server |
| **Webhook** | ✅ Free | Any HTTP agent endpoint (LangChain, CrewAI, n8n, Flowise) |
| **Custom** | ✅ Free | Any OpenAI-compatible API |
| OpenAI | Coming in `@wireai/cloud` | API key required |
| Anthropic | Coming in `@wireai/cloud` | API key required |
| Gemini | Coming in `@wireai/cloud` | API key required |

### Local LLM Setup (Ollama)

```bash
# 1. Install Ollama
brew install ollama

# 2. Pull a model
ollama pull llama3

# 3. Start the server
ollama serve

# 4. Configure WireAI
const config = {
  provider: "ollama",
  baseUrl: "http://localhost:11434",  // Simulator
  // baseUrl: "http://YOUR_IP:11434", // Physical device
  model: "llama3",
};
```

### Connect Any Agent (WebhookAdapter)

```tsx
// Connect your existing LangChain, CrewAI, or n8n agent
const config = {
  provider: "webhook",
  baseUrl: "https://your-agent.example.com/api/chat",
  model: "your-agent",
};
```

Your agent receives `{ messages, model }` via POST and returns `{ content: "..." }`.

---

## Add Custom Components

Every component needs:
1. A **Zod schema** for props (only JSON-serializable — no functions)
2. A **description** written as an LLM routing instruction
3. The **React component** itself

```tsx
import React, { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { z } from "zod";
import type { WireAIComponent, InjectedProps } from "wireai-rn";

const schema = z.object({
  question: z.string().describe("The reflective question to ask"),
  moods: z.array(z.string()).describe("4-6 mood options"),
});

type Props = z.infer<typeof schema> & InjectedProps & {
  onSubmit?: (mood: string) => void;
};

const MoodCheckIn = React.memo(({ question, moods, onSubmit }: Props) => {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = useCallback((mood: string) => {
    if (selected) return; // submitted-state pattern — no double-submit
    setSelected(mood);
    onSubmit?.(mood);
  }, [selected, onSubmit]);

  return (
    <View style={styles.card}>
      <Text style={styles.question}>{question}</Text>
      <View style={styles.grid}>
        {moods.map((mood) => (
          <TouchableOpacity
            key={mood}
            style={[styles.btn, selected === mood && styles.btnSelected]}
            onPress={() => handleSelect(mood)}
            disabled={!!selected}
          >
            <Text style={styles.btnText}>{mood}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

export const MoodCheckInDef: WireAIComponent<typeof schema> = {
  name: "MoodCheckIn",
  description:
    "Use to ask the user how they are feeling. Show this at the start of " +
    "a coaching session or when checking emotional state. " +
    "Provide 4-6 warm, non-clinical mood options.",
  component: MoodCheckIn,
  propsSchema: schema,
};
```

### Component Best Practices

- ✅ Use `React.memo` on every component
- ✅ Use `useCallback` for all event handlers
- ✅ Implement the **submitted-state pattern** (disable after first interaction)
- ✅ Write descriptions as LLM routing instructions: `"Use when..."`, `"Ideal for..."`, `"Use X instead of Y when..."`
- ✅ Add `.describe()` to every Zod field
- ❌ Never put functions in the Zod schema — they come from `callbackOverrides`

---

## API Reference

### Provider

```tsx
<WireAIProvider
  llm={config}                    // Required — LLM connection config
  components={components}          // Required — component registry array
  maxContextMessages={20}          // Max messages in context window
  maxContextChars={12000}          // Max chars (~3k tokens for 4k models)
  systemPromptSuffix="You are..." // App-specific system prompt additions
  initialMessages={[]}             // Pre-populate conversation
  onMessage={(msg) => {}}          // Lifecycle hook for persistence/analytics
  licenseKey="..."                 // Reserved for future premium features
>
  {children}
</WireAIProvider>
```

### Hooks

| Hook | Returns |
|---|---|
| `useWireAIThread()` | `{ messages, sendMessage, isLoading, error, reset, abort }` |
| `useWireAIInput(sendMessage)` | `{ inputText, setInputText, handleSubmit }` |
| `useWireAIAction(triggerAction, name)` | Callback factory for component interactions |

### Renderer

```tsx
<ComponentRenderer
  messageId={msg.id}
  response={msg.response}
  callbackOverrides={{ onSubmit: (v) => triggerAction("submitted", v) }}
/>
```

---

## Design System

WireAI ships with a design token system aligned with the [getwireai.com](https://getwireai.com) brand. Import tokens to style your custom components:

```tsx
import { colors, violet, ink, spacing, radii, textStyles } from "wireai-rn";

// Dark mode tokens also available
import { darkColors } from "wireai-rn";
```

---

## A2UI Protocol

WireAI's component registry format (name + description + schema → JSON output) is architecturally aligned with [Google's A2UI v0.9 protocol](https://a2ui.org). Full A2UI compatibility is planned for v0.2.

---

## What's Coming

| Feature | Version |
|---|---|
| Real token streaming | v0.2 (Pro) |
| Cloud LLMs (OpenAI, Anthropic, Gemini) | v0.2 (Pro) |
| Thread persistence (MMKV/SQLite) | v0.2 (Pro) |
| A2UI protocol compatibility | v0.2 |
| On-device LLM via `llama.rn` | v0.3 |
| Component packs (Mental Health, Fitness) | v0.2 |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT — see [LICENSE](LICENSE) for details.

---

**Built by [Malik Chohra](https://getwireai.com)** · [Code Meet AI Newsletter](https://codemeetnewsletter.com) · [CasaInnov](https://casainnov.com)
