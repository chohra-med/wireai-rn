import type { LocalLLMConfig } from "../types";
import type { BaseAdapter } from "./base-adapter";
import { LMStudioAdapter } from "./lmstudio.adapter";
import { OllamaAdapter } from "./ollama.adapter";
import { OpenAIAdapter } from "./openai.adapter";
import { WebhookAdapter } from "./webhook.adapter";

export const createAdapter = (config: LocalLLMConfig): BaseAdapter => {
  switch (config.provider) {
    case "ollama":
      return new OllamaAdapter(config);
    case "lmstudio":
      return new LMStudioAdapter(config);
    case "openai":
      return new OpenAIAdapter(config);
    case "webhook":
      return new WebhookAdapter(config);
    case "custom":
      // Custom uses the LM Studio adapter (OpenAI-compatible endpoint)
      return new LMStudioAdapter(config);
    default:
      throw new Error(
        `[WireAI] Unknown LLM provider: "${(config as LocalLLMConfig).provider}". ` +
          'Valid options: "ollama" | "lmstudio" | "webhook" | "custom"'
      );
  }
};
