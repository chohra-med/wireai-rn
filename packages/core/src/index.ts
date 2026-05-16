/**
 * wireai-rn — Wire your AI agent to native mobile UI
 *
 * Open-source React Native SDK for generative UI.
 * Render interactive native components from LLM responses.
 *
 * @see https://getwireai.com
 * @license MIT
 */

// ─── Provider ────────────────────────────────────────────────────────────────
export { WireAIProvider } from "./provider/WireAIProvider";

// ─── Hooks ───────────────────────────────────────────────────────────────────
export { useWireAIThread } from "./hooks/useWireAIThread";
export { useWireAIInput } from "./hooks/useWireAIInput";
export { useWireAIAction } from "./hooks/useWireAIAction";
export { useLLMConfigStorage } from "./hooks/useLLMConfigStorage";
export { useWireAIStream } from "./hooks/useWireAIStream";
export type { UseWireAIThreadResult, SendMessageOptions } from "./hooks/useWireAIThread";
export type { StorageBackend, UseLLMConfigStorageResult } from "./hooks/useLLMConfigStorage";

// ─── Streaming (advanced) ────────────────────────────────────────────────────
export { pushStream, clearStream, getStream, subscribeStream } from "./streaming/streamStore";
export type { StreamContent } from "./streaming/streamStore";
export { parsePartialJson } from "./utils/parse-partial-json";
export type { PartialParseResult } from "./utils/parse-partial-json";

// ─── Renderer ────────────────────────────────────────────────────────────────
export { ComponentRenderer } from "./renderer/ComponentRenderer";
export { ComponentErrorBoundary } from "./renderer/ComponentErrorBoundary";
export { FallbackMessage } from "./renderer/FallbackMessage";
export { LoadingState } from "./renderer/LoadingState";

// ─── Registry ────────────────────────────────────────────────────────────────
export { createComponentRegistry } from "./registry/component-registry";
export { useWireAIContext } from "./registry/registry-context";
export type { ComponentRegistry, RegistryEntry } from "./registry/component-registry";

// ─── Schema (advanced use) ───────────────────────────────────────────────────
export { validateLLMResponse, MAX_NODE_DEPTH } from "./schema/validate-response";
export { buildSystemPrompt } from "./schema/system-prompt.builder";
export {
  WireAIResponseSchema,
  WireAIRenderResponseSchema,
  WireAIAskResponseSchema,
  WireAIPartialResponseSchema,
  WIREAI_JSON_SCHEMA,
} from "./schema/wireai-response.schema";
export type { WireAIPartialResponse } from "./schema/wireai-response.schema";
export { NodeRefSchema, isNodeRefArray } from "./schema/node-ref.schema";
export type { NodeRef } from "./schema/node-ref.schema";

// ─── LLM Adapters ────────────────────────────────────────────────────────────
export { OllamaAdapter } from "./llm/ollama.adapter";
export { LMStudioAdapter } from "./llm/lmstudio.adapter";
export { OpenAIAdapter } from "./llm/openai.adapter";
export { WebhookAdapter } from "./llm/webhook.adapter";
export { createAdapter } from "./llm/llm-factory";
export type { BaseAdapter, ChatMessages, StreamOnChunk } from "./llm/base-adapter";

// ─── Components (Built-in) ───────────────────────────────────────────────────
export { defaultComponents } from "./components";
export { ActionCard } from "./components/ActionCard";
export { ChipSelectCard } from "./components/ChipSelectCard";
export { ConfirmPrompt } from "./components/ConfirmPrompt";
export { ContentSelectCard } from "./components/ContentSelectCard";
export { InfoList } from "./components/InfoList";
export { MessageBubble } from "./components/MessageBubble";
export { NumberStepperCard } from "./components/NumberStepperCard";
export { SelectionCard } from "./components/SelectionCard";
export { StatusCard } from "./components/StatusCard";
export { StepList } from "./components/StepList";
export { TextInputCard } from "./components/TextInputCard";

// ─── UI Primitives ───────────────────────────────────────────────────────────
export { Btn } from "./ui/Btn";
export { InputField } from "./ui/InputField";

// ─── Design Tokens ───────────────────────────────────────────────────────────
export {
  colors,
  darkColors,
  violet,
  ink,
  spacing,
  radii,
  textStyles,
  iconSizes,
  widths,
} from "./styles/tokens";

// ─── Types ───────────────────────────────────────────────────────────────────
export type {
  LocalLLMConfig,
  WireAIResponse,
  WireAIRenderResponse,
  WireAIAskResponse,
  WireAIComponent,
  WireAINodeRef,
  Message,
  MessageRole,
  InjectedProps,
  CallbackOverrides,
} from "./types";
