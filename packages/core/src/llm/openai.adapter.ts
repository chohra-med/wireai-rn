import type { LocalLLMConfig } from "../types";
import type { BaseAdapter } from "./base-adapter";

/**
 * @deprecated OpenAI support requires @wireai/cloud (coming soon).
 * Use OllamaAdapter, LMStudioAdapter, or WebhookAdapter instead.
 */
export class OpenAIAdapter implements BaseAdapter {
  constructor(_config: LocalLLMConfig) {
    if (__DEV__) {
      console.warn(
        "[WireAI] OpenAI adapter is not included in the free tier. " +
          "Install @wireai/cloud for cloud LLM support. " +
          "For local LLMs, use OllamaAdapter or LMStudioAdapter. " +
          "To connect an existing agent, use WebhookAdapter."
      );
    }
  }

  async chat(): Promise<string> {
    throw new Error(
      "[WireAI] OpenAI adapter is not available in the free tier. " +
        "Use OllamaAdapter, LMStudioAdapter, or WebhookAdapter."
    );
  }

  async ping(): Promise<boolean> {
    return false;
  }
}
