import type { ComponentType } from "react";
import type { z } from "zod";

export type WireAIRenderResponse = {
  action: "render";
  component: string;
  props: Record<string, unknown>; // biome-ignore lint/suspicious/noExplicitAny: dynamic props from LLM
  message?: string;
};

export type WireAIAskResponse = {
  action: "ask";
  component?: never;
  props?: never;
  message: string;
};

export type WireAIResponse = WireAIRenderResponse | WireAIAskResponse;

export type InjectedProps = {
  messageId: string;
};

export type WireAIComponent<T extends z.ZodObject<z.ZodRawShape>> = {
  name: string;
  description: string;
  component: ComponentType<z.infer<T> & InjectedProps>;
  propsSchema: T;
  defaultProps?: Partial<z.infer<T>>;
};

export type LocalLLMConfig = {
  provider: "ollama" | "lmstudio" | "openai" | "webhook" | "custom";
  baseUrl: string;
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

export type MessageRole = "user" | "assistant" | "system";

export type Message = {
  id: string;
  role: MessageRole;
  content: string;
  response?: WireAIResponse;
  timestamp: number;
};

export type CallbackOverrides = Record<string, (...args: unknown[]) => void>;
