import type { ComponentType, ReactNode } from "react";
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

/**
 * Loose runtime shape for a nested component reference inside another
 * component's props. The full Zod schema lives in `schema/node-ref.schema.ts`.
 */
export type WireAINodeRef = {
  component: string;
  props?: Record<string, unknown>;
};

export type InjectedProps = {
  messageId: string;
  /**
   * Renders a child `WireAINodeRef` ad-hoc. Useful when a container needs to
   * lay children out in slots that the SDK can't auto-detect. The renderer
   * already pre-renders any `NodeRefSchema` arrays in props into `ReactNode[]`,
   * so most containers don't need this helper.
   */
  renderNode?: (child: WireAINodeRef) => ReactNode;
  /** True while the parent message is still streaming. Optional UI hint. */
  isStreaming?: boolean;
};

export type WireAIComponent<T extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: string;
  description: string;
  component: ComponentType<z.infer<T> & InjectedProps>;
  propsSchema: T;
  defaultProps?: Partial<z.infer<T>>;
};

export type LocalLLMConfig = {
  provider: "ollama" | "lmstudio" | "openai" | "webhook" | "custom" | "a2a";
  baseUrl: string;
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  /**
   * Extra metadata merged into every A2A request's `params.metadata`. Lets the
   * app forward context the agent can use — e.g. install attribution
   * (`{ attribution: { provider, payload } }`) from AppsFlyer/Branch. A2A only.
   */
  metadata?: Record<string, unknown>;
};

export type MessageRole = "user" | "assistant" | "system";

export type Message = {
  id: string;
  role: MessageRole;
  content: string;
  response?: WireAIResponse;
  /**
   * Structured data the transport carried alongside `content`, past the part
   * that became `content` itself — in wire order, uninterpreted. Today only
   * `A2AAdapter` produces it, from an A2A task whose agent message holds more
   * than one DataPart.
   *
   * The SDK deliberately does not know what any of these payloads mean: it is
   * a generic carrier, so a consumer narrows by its own convention (for the
   * Wire onboarding server, a part with `kind: "onboarding_plan"`). Absent —
   * not `[]` — when the turn carried no extra data.
   */
  dataParts?: unknown[];
  /** True while the assistant message is still being streamed. */
  isStreaming?: boolean;
  timestamp: number;
};

export type CallbackOverrides = Record<string, (...args: unknown[]) => void>;

// ─── A2A Internal Types ───────────────────────────────────────────────────────

export type A2ATaskState =
  | "SUBMITTED" | "WORKING" | "COMPLETED" | "FAILED"
  | "CANCELED" | "INPUT_REQUIRED" | "REJECTED"
  // v0.3 compat (lowercase)
  | "submitted" | "working" | "completed" | "failed"
  | "canceled" | "input-required" | "rejected";

export type A2APart = {
  text?: string;
  data?: Record<string, unknown>;
  mimeType?: string;
  url?: string;
  raw?: string;
  content?: string; // v0.3 compat
};

export type A2AMessage = {
  role: "user" | "agent" | "assistant"; // assistant = v0.3 compat
  parts: A2APart[];
};

export type A2ATask = {
  id: string;
  contextId?: string;
  status: { state: A2ATaskState; message?: string };
  messages?: A2AMessage[];
  artifacts?: { parts: A2APart[] }[];
};

export type A2AJsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number;
  result?: A2ATask;
  error?: { code: number; message: string };
};

export type A2AAgentCard = {
  name: string;
  url: string;
  capabilities?: { streaming?: boolean };
};
