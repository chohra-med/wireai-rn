# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.5] - 2026-08-09

### Added
- **A2A: DataParts past the first are no longer dropped.** When an A2A agent message carried more than one `DataPart`, the first became the component envelope `chat()` returns as its string and every later part was discarded inside the adapter with no way for a consumer to recover it. `A2AAdapter` now keeps them: new `readLastDataParts(): unknown[] | undefined` returns every DataPart past the first, uninterpreted, in the adapter's collection order — agent messages latest-first, then artifacts latest-first, so wire order holds only within a single message's parts — or `undefined` when the task carried at most one. Do not index positionally across a task that returns several agent messages. Declared as an optional member on `BaseAdapter`, so adapters that never carry extra data simply omit it. Purely additive — no export was removed or renamed, and the string `chat()` returns is unchanged.
- **`Message.dataParts?: unknown[]`** — `useWireAIThread` reads `readLastDataParts()` immediately after the awaited non-streaming `chat()` and attaches the result to the assistant message. The key is absent, not `[]`, on a turn that carried no extra data. The SDK deliberately does not interpret these payloads; a consumer narrows by its own convention.
  - Read-back is scoped to the most recent `chat()`. Each `chat()` clears the stored value before it can fail, so a rejected call or a turn with no extras can never leave an earlier turn's data readable, and `resetContext()` clears it too.
- README section **"Acceptable use and the EU AI Act"** — the Annex III high-risk boundary, the two Article 5(1) prohibitions, who the deployer is, and the written Article 50(1)/50(2) position for a generative-UI render layer. Full text in the repo's `EU-AI-ACT.md`.

### Changed
- `prepublishOnly: yarn build` added to the package — the tarball is rebuilt at publish time, so a release can no longer ship a stale `dist/`.
- Repo landing README reworked: code before marketing, and the Quick Start now defaults to a `webhook` config with the provider key on a server instead of an `apiKey` in the bundle. (Repo page only — not part of the published npm package.)

## [0.2.4] - 2026-07-06

### Changed
- Release/packaging sync — republished to align the git tag and npm `latest` with the 0.2.3 runtime. No functional changes to the SDK since 0.2.3.

## [0.2.3] - 2026-07-06

### Fixed
- **A2A: `timeoutMs` is now the single ceiling for the whole request, including the `tasks/get` poll loop.** A hidden 30-poll (~30s) cap in `_poll` used to kill any agent run past ~30s regardless of the configured `timeoutMs` (e.g. a 45s agent run under the default 60s died silently). The poll budget is now derived from `timeoutMs`; a timeout reports as a timeout instead of "after 30 polls" or a bare `AbortError`, and a mid-poll timeout no longer surfaces as a raw `AbortError`. (Fable 5 audit finding F1.)

## [0.2.2] - 2026-07-03

### Changed
- Release version bump only — republished byte-identical to 0.2.1 (no functional changes). Kept for npm version continuity.

## [0.2.1] - 2026-06-27

### Fixed
- `metadata` now forwarded to A2A requests at runtime — `LocalLLMConfig.metadata` is merged into every A2A `params.metadata` (the published 0.2.0 build dropped it).

## [0.2.0] - 2026-05-29

### Added
- **Streaming by default** — every adapter streams unless disabled via a flag. New `useWireAIStream` hook + internal `streamStore`, plus a partial-JSON parser so incomplete component JSON renders progressively instead of waiting for the full payload.
- **A2A (Agent-to-Agent) protocol adapter** (`llm/a2a.adapter.ts`) + agent-card builder (`schema/agent-card.builder.ts`) — render UI emitted by an upstream agent.
- **Local LLM adapters** — first-class Ollama and LM Studio support.
- **Nested component composition** via the `node-ref` schema — generated components can nest other components, not just a flat list.
- Test coverage across a2a, agent-card, streaming, partial-JSON, and response validation.

### Fixed
- `react-native` export condition now resolves: `src` is included in the published `files` so Metro can consume the TypeScript entry points directly (previously the condition pointed at an unshipped path).

## [0.1.3]

### Fixed
- `webhook.adapter.ts` — removed `reason` argument from `AbortController.abort()` calls; React Native's `globals.d.ts` declares `abort(): void` with no params, causing CI typecheck failures
- `WireAIComponent` generic widened from `ZodObject<ZodRawShape>` to `ZodTypeAny`; Zod v3.25 changed internal `ZodObject` type params (`$strip`) breaking the old constraint
- `useWireAIAction` — `onPress` callback now accepts `unknown` (was `string`); fixes `CallbackFactory` index signature incompatibility

## [0.1.2]

### Fixed
- `context-budget.ts` — removed false "system message" assumption; first user message no longer dropped from context
- `useWireAIThread` — adapter and system prompt now memoized in refs; no longer rebuilt on every `sendMessage` call
- `useWireAIAction` — rewritten as working factory; previous version only logged and never sent messages to the thread
- `system-prompt.builder.ts` — replaced private `_def?.description` Zod field with public `.description` API
- `useWireAIThread` — removed `isLoading` from `sendMessage` deps (stale closure eliminated via `isLoadingRef`)
- `extract-json.ts` — replaced `lastIndexOf("}")` with balanced-brace parser; trailing content no longer corrupts extraction
- `src/index.ts` — removed internal `devLog` from public API exports
- `provider/WireAIProvider.tsx` — `onThreadUpdate` was never destructured; always `undefined` at runtime
- `openai.adapter.ts` — strips trailing `/v1` from baseUrl; prevents double `/v1/v1/chat/completions` 404
- `openai.adapter.ts` — `ping()` referenced undefined `timeoutId` (ReferenceError on health check)

### Added
- `useLLMConfigStorage(storage, defaultConfig)` — storage-backend-agnostic hook for LLM config persistence
- `StorageBackend` interface — compatible with expo-secure-store, MMKV, AsyncStorage, or any get/set/delete store
- `Btn` and `InputField` exported as public UI primitives for custom component authors
- Production warning in `OpenAIAdapter` constructor when `apiKey` present in release build
- `wireai-rn/components` subpath export with correct `package.json` exports + dedicated tsup build entry
- `OpenAIAdapter` — added to SDK (was missing from v0.1.0 despite being documented)
- Regression tests: `context-budget.test.ts` and `extract-json.test.ts` with named regression guards

## [0.1.1] - 2026-04-27

### Fixed
- Initial npm publish corrections (package metadata)

## [0.1.0] - 2026-04-27

### Added
- Initial release
- `WireAIProvider` — provider component for LLM config and component registry
- `useWireAIThread` — conversation thread hook with message history, loading state, and error handling
- `useWireAIInput` — input field state management hook
- `useWireAIAction` — callback factory for component interactions
- `ComponentRenderer` — validates and renders registered components from LLM responses
- `ComponentErrorBoundary` — prevents component crashes from breaking the app
- `FallbackMessage` — graceful fallback for text responses and validation failures
- `LoadingState` — skeleton loading with elapsed time counter
- 11 built-in interactive components (ActionCard, ChipSelectCard, ConfirmPrompt, ContentSelectCard, InfoList, MessageBubble, NumberStepperCard, SelectionCard, StatusCard, StepList, TextInputCard)
- `OllamaAdapter` — local LLM via Ollama server
- `LMStudioAdapter` — local LLM via LM Studio (OpenAI-compatible)
- `WebhookAdapter` — connect any HTTP agent endpoint (LangChain, CrewAI, n8n, Flowise)
- Zod-validated component registry with auto-generated system prompt
- Context budget management (message count + character count trimming)
- AppState backgrounding guard (abort on app suspend)
- Spilled props rescue (handles LLM placing props at wrong nesting level)
- Design tokens aligned with WireAI website brand (violet + ink palette)
- TypeScript-first public API (zero `any` in exports)
- Expo-compatible (works with Expo Go)
