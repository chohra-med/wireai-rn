# wireai-rn — FEATURES

Source of truth for what the SDK ships today. Committed to git. Read by:
- The marketing website (`getwireai_website`) via a `prebuild`/`predev` script that copies this into its `content/` folder.
- AI agents and humans authoring copy, docs, or blog posts about the SDK.

> Last updated: 2026-08-19
> Version: see `packages/core/package.json`

---

## Components (11 total)

Built-in generative-UI primitives in `packages/core/src/components/`:

- **ActionCard** — single primary action with optional secondary
- **ChipSelectCard** — multi-select chips with selection state
- **ConfirmPrompt** — two-button yes/no dialog
- **ContentSelectCard** — rich-content selection with images / descriptions
- **InfoList** — labeled key/value rows
- **MessageBubble** — chat-style message rendering
- **NumberStepperCard** — incrementable numeric input
- **SelectionCard** — single-select radio-style card
- **StatusCard** — status / progress indicator with icon
- **StepList** — ordered list of steps with completion state
- **TextInputCard** — free-text input with validation

All components:
- Validated with Zod schemas before render (no invalid AI output reaches the UI)
- Use `StyleSheet.create` + design tokens (no inline styles)
- Hermes-compatible (no browser globals, no `fetch` for streams — XHR only)
- Styled from the SDK's design tokens, which are exported from `wireai-rn`
  (`colors`, `darkColors`, `violet`, `ink`, `spacing`, `radii`, `textStyles`,
  `iconSizes`, `widths`) so an app can reuse them in its own screens. The
  tokens are frozen constants: there is no theming or token-override prop on
  `WireAIProvider` today.

## LLM adapters (5)

Located in `packages/core/src/llm/`:

- **OpenAI** — chat completions + streaming
- **Ollama** — local Ollama instance support
- **LMStudio** — local LMStudio instance support
- **Webhook** — generic webhook adapter for custom backends
- **A2A (Agent-to-Agent)** — protocol adapter for agent-card-based multi-agent flows

Streaming: enabled by default with a flag to disable. A2A is the exception: it has
no `chatStream`, so an A2A turn always takes the one-shot `chat()` path. Works in
Hermes because the streaming adapters read `XMLHttpRequest.onprogress` directly.
There is no polyfill: React Native's `fetch` does not expose `response.body` as a
`ReadableStream`, so `XMLHttpRequest` is the stream.

## Provider

`WireAIProvider` — top-level context provider. Wraps the app. Exposes:
- LLM adapter selection (`llm`)
- Default streaming flag (`streaming`)
- Custom component registry (`components`)
- Context budget (`maxContextMessages`, `maxContextChars`)
- System prompt suffix (`systemPromptSuffix`) and seed history (`initialMessages`)
- Thread callbacks (`onMessage`, `onThreadUpdate`)

It does not expose a theme or token-override prop. Verify the prop list against
`packages/core/src/provider/WireAIProvider.tsx` before writing copy about it.

## Custom components

Consumers can register their own components via the registry API (`packages/core/src/registry/`). Each component must declare a Zod schema. The renderer falls back to the registry for any schema name not in the built-in component set.

## Schema validation

All AI-generated UI output is validated with Zod (`packages/core/src/schema/`). Invalid output is dropped with a `devLog()` warning rather than rendering broken UI.

## Hooks

Exported from `packages/core/src/hooks/`:
- `useWireAIThread` — chat state + LLM interaction
- `useWireAIInput` — controlled text input that feeds `sendMessage`
- `useWireAIAction` — callback props for interactive components
- `useWireAIStream` — streaming response handler
- `useLLMConfigStorage` — persist and restore the LLM config from device storage

The component registry is not reached through a hook in `hooks/`: use
`useWireAIContext` and `createComponentRegistry`, both exported from
`packages/core/src/registry/`.

## Styles

Design-token-driven styles in `packages/core/src/styles/`. The tokens are frozen
constants (`as const`), and they are exported from `wireai-rn` as `colors`,
`darkColors`, `violet`, `ink`, `spacing`, `radii`, `textStyles`, `iconSizes` and
`widths`, so an app can reuse the same scale in its own components. Overriding
them is not supported today: there is no theming prop on `WireAIProvider`, and a
built-in's look is changed by registering a custom component instead.

## What's NOT included (yet)

These are deliberately out of scope for the current version:
- Voice input / Whisper integration
- ONNX or on-device model inference (llama.rn or similar not bundled)
- OTA updates (consumers manage their own update strategy)
- Analytics (consumers add their own)
- **LangChain / LangGraph / CrewAI / n8n** — agent frameworks stay out of
  `packages/core/` to keep the React Native bundle lean and protocol-agnostic.
  They ship instead as reference examples behind the generic `WebhookAdapter`.
  See `examples/langchain-multistep/` for the first such integration (Express
  + LangChain LCEL on the server, wireai-rn on the device).

---

## Source files for the website to read

If the website's `prebuild` script wants additional detail beyond this file:
- Component list: `packages/core/src/components/index.ts` (exports)
- LLM adapter list: `packages/core/src/llm/` (one file per adapter)
- Exported API: `packages/core/src/index.ts`

When this file falls behind reality, the website's AI is generating stale copy. Update on every SDK ship.

---

## What's new (2026-05-29)

Pushed to `main` (`wireai-rn` 602ff13..95db9a4):

- **Streaming by default** — every adapter streams unless you opt out with a flag. New `useWireAIStream` hook + internal `streamStore`, plus a partial-JSON parser so half-arrived component JSON renders progressively instead of waiting for the full payload. ⟳ CORRECTED 2026-08-18: the A2A adapter has never implemented `chatStream`, so an A2A turn always takes the one-shot `chat()` path. Every other adapter (OpenAI, Ollama, LM Studio, Webhook) does stream.
- **A2A (Agent-to-Agent) protocol adapter** — `llm/a2a.adapter.ts` + an agent-card builder (`schema/agent-card.builder.ts`). Wire RN can now sit behind an agent and render what the agent emits.
- **Local LLM adapters** — first-class Ollama and LMStudio support for running fully on-device / on-LAN.
- **Nested component composition** — `node-ref` schema lets generated components nest other components, not just a flat list.
- **mental-coach example** — a runnable streaming demo app (drawer nav, composed-demo screen) under `examples/`.
- Test coverage added across a2a, agent-card, streaming, partial-JSON, and response validation.
