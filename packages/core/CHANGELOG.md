# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
