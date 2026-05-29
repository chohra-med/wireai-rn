# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
