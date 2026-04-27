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
export type { UseWireAIThreadResult, SendMessageOptions } from "./hooks/useWireAIThread";

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
export { validateLLMResponse } from "./schema/validate-response";
export { buildSystemPrompt } from "./schema/system-prompt.builder";
export {
  WireAIResponseSchema,
  WireAIRenderResponseSchema,
  WireAIAskResponseSchema,
  WIREAI_JSON_SCHEMA,
} from "./schema/wireai-response.schema";

// ─── LLM Adapters ────────────────────────────────────────────────────────────
export { OllamaAdapter } from "./llm/ollama.adapter";
export { LMStudioAdapter } from "./llm/lmstudio.adapter";
export { WebhookAdapter } from "./llm/webhook.adapter";
export { createAdapter } from "./llm/llm-factory";
export type { BaseAdapter } from "./llm/base-adapter";

// ─── UI Helpers (Internal) ──────────────────────────────────────────────────
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
  Message,
  MessageRole,
  InjectedProps,
  CallbackOverrides,
} from "./types";

// ─── Dev Utils ───────────────────────────────────────────────────────────────
export { devLog } from "./utils/dev-log";
