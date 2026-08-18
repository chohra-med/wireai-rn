# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **`errorKind` and `retry()` on `useWireAIThread`.** Sending the app to background mid-turn aborted the in-flight request, and the catch returned silently on any `AbortError`: the assistant placeholder was deleted, `isLoading` went false and `error` stayed `null`, so the user came back to their own message with no answer, no error and no way to ask again. `errorKind: "interrupted" | "failed" | null` now says why a turn ended unanswered. `"failed"` means the request errored and `error` carries the message. `"interrupted"` means the app was backgrounded, the request was aborted, `error` stays `null` and the user's message is retained: show a retry affordance and call `retry()`. `retry: () => void` re-runs the last user message without appending a second copy of it, and is a no-op while a send is in flight or when the newest message is not an unanswered user message. The SDK never resends by itself. Purely additive: no existing member changed meaning, and `abort()`, `reset()` and a superseding `sendMessage` stay silent exactly as before.

### Fixed
- **Ollama and LM Studio streaming no longer lose tokens on a chunk-split line.** The read cursor advanced to the full `responseText` length on every `onprogress`, so a line that arrived half-formed was parsed once, threw inside `JSON.parse`, was swallowed by the catch, and its bytes were never read again. Neither adapter parsed the tail on `onload` either, so a final line with no trailing newline was lost too. Both now buffer the trailing fragment the way the OpenAI adapter already did, and flush what remains when the stream completes. Tokens that used to disappear from a local stream now arrive.
- **Cancelling an Ollama or LM Studio stream is reported as a cancellation, not a failure.** `xhr.onabort` rejected with a bare `Error`, whose `name` is `"Error"`, but the thread hook tells a user or background cancellation apart from a real failure by `name === "AbortError"`. Every cancelled local stream therefore surfaced to the user as a hard error. Both adapters now reject with an `AbortError`, and a stream that hit its timeout reports as a timeout rather than as a plain abort.
- **A permanent A2A poll error fails immediately with the agent's own message.** The throw for a JSON RPC error inside the `tasks/get` poll sat in a `try` whose catch swallows transient network errors, so it could never escape: an agent that rejected the task, or a server with no `tasks/get`, was polled until `timeoutMs` elapsed and then reported as a timeout, hiding the real cause. A well formed JSON RPC error is now carried past that catch and rethrown. Transient network errors keep their retry and the poll budget is unchanged.
- **Every adapter honours an `AbortSignal` that is already aborted.** `signal.addEventListener("abort", ...)` never fires for a signal aborted before the call, so the request went out with nothing left to cancel it. `chat()` and `chatStream()` on the Ollama, LM Studio, OpenAI and Webhook adapters, plus A2A `chat()`, now check `signal.aborted` before arming their timeout and reject with an `AbortError` without issuing a request.
- **An inline `llm` prop no longer rebuilds the adapter on every render.** The provider's context memo and the thread hook's adapter effect both keyed on object identity, so `llm={{ ... }}` written inline created a new adapter each render. For A2A that meant a new server session every turn, because the adapter holds `contextId` as instance state, and the agent lost the conversation. Both now key on a fingerprint of the config's contents, covering all eight fields of `LocalLLMConfig`, so a genuine config change still rebuilds the adapter and a stable config no longer does.
- **`sendMessage` no longer holds a stale `streaming` value.** `streaming` is read inside the callback to choose the streaming path but was missing from its dependency array, so flipping the provider's `streaming` prop left the callback using the value from the render that created it.
- **A persisted LLM config is validated before it is adopted.** The stored entry was cast, not parsed, so anything able to write the storage key chose the app's LLM config including `baseUrl`, and `apiKey` travels to `baseUrl`. The entry is now parsed against a schema and falls back to the default the app itself supplied on any mismatch. The schema mirrors the public type and tightens nothing, so any config a consumer may legally pass to `WireAIProvider` still survives a round trip through storage.
- **Interactive built-in components are disabled while their message is still streaming.** `ComponentRenderer` has always injected `isStreaming` into every rendered component, but no built-in consumed it, so every button, chip, option row and text field of a partially rendered component was live mid-stream. A tap fired a handler whose result was then overwritten by the next chunk or by the final validated render, with no feedback that it had done nothing. All ten interactive built-ins now gate on the injected value, and chip, item and option rows gained a disabled visual state they never had. `MessageBubble` is display only and is unchanged. No schema, description, prop or export changed.
- **Documentation corrected against the code.** The SDK README had the streaming matrix backwards: it named OpenAI and Webhook as the only adapters implementing `chatStream` and listed Ollama and LM Studio as one-shot, when A2A is in fact the only adapter without `chatStream`. The README's "How It Works" diagram and the repo landing README both routed invalid model output to `FallbackMessage`, which that path never reaches: the validator throws, the thread hook drops the turn and sets `error`, and `FallbackMessage` covers per node failures inside the renderer and a render crash caught by the error boundary. Both are now described where they actually happen. The streaming section and the provider setup section also state plainly that the SDK has no offline or cold-start lane, and the repo landing README's Wire AI attribution line now matches the current product wording.
- **`FEATURES.md` no longer names an API that does not exist.** The file is copied into the marketing website by its prebuild, so every false identifier in it became public copy. Its hook list named three hooks the SDK does not export and its provider was written without the `AI` that is in the real export name. The list now matches `src/index.ts`, and the version line points at `packages/core/package.json` instead of carrying a literal that had been stale since 0.1.3. The two dated release notes claiming that every adapter streams keep their text and carry an inline correction.

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
- **Streaming by default** — every adapter streams unless disabled via a flag. New `useWireAIStream` hook + internal `streamStore`, plus a partial-JSON parser so incomplete component JSON renders progressively instead of waiting for the full payload. ⟳ CORRECTED 2026-08-18: the A2A adapter shipped in this same release and has never implemented `chatStream`, so an A2A turn always took the one-shot `chat()` path. Every other adapter (OpenAI, Ollama, LM Studio, Webhook) does stream.
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
