import type { LocalLLMConfig, Message } from "../types";
import { devLog } from "../utils/dev-log";
import type { BaseAdapter } from "./base-adapter";

export class OpenAIAdapter implements BaseAdapter {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private config: LocalLLMConfig) {
    // Allow baseUrl override (Azure, OpenRouter, etc.) — default to OpenAI
    let base = (config.baseUrl && !config.baseUrl.includes("localhost") && !config.baseUrl.includes("127.0.0.1")
      ? config.baseUrl
      : "https://api.openai.com"
    ).replace(/\/$/, "");

    // If the user provided a URL ending in /v1, strip it so the adapter can append its own paths consistently
    if (base.endsWith("/v1")) {
      base = base.slice(0, -3);
    }

    this.baseUrl = base;
    this.apiKey = config.apiKey ?? "";

    devLog.info(`OpenAIAdapter initialized with baseUrl: ${this.baseUrl}`);

    if (!this.apiKey && __DEV__) {
      console.warn("[WireAI] OpenAIAdapter: no apiKey provided. Set apiKey in LocalLLMConfig.");
    }

    if (this.apiKey && !__DEV__) {
      console.warn(
        "[WireAI] OpenAIAdapter: apiKey is set in a production build. " +
          "Bundling API keys in mobile apps exposes them to extraction. " +
          "Use WebhookAdapter with a server-side proxy instead."
      );
    }
  }

  async ping(): Promise<boolean> {
    if (!this.apiKey) return false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const url = `${this.baseUrl}/v1/models`;
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      devLog.info(`OpenAI ping status: ${res.status} (${url})`);
      return res.ok;
    } catch (err) {
      clearTimeout(timeoutId);
      devLog.warn(`OpenAI ping failed: ${url}`, err);
      return false;
    }
  }

  async chat(
    messages: Pick<Message, "role" | "content">[],
    signal?: AbortSignal
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error("[WireAI] OpenAIAdapter: apiKey is required. Pass it via LocalLLMConfig.apiKey.");
    }

    const combined = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      combined.abort();
    }, this.config.timeoutMs ?? 30000);

    if (signal) {
      signal.addEventListener("abort", () => combined.abort());
    }

    const url = `${this.baseUrl}/v1/chat/completions`;
    devLog.info(`OpenAI request: ${url}`);

    try {
      const body = {
        model: this.config.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: this.config.temperature ?? 0.7,
        max_tokens: this.config.maxTokens ?? 1024,
        // json_object works across all GPT-4o, GPT-4-turbo, GPT-3.5-turbo-1106+
        // The system prompt already instructs strict JSON — this enforces it at the API level.
        response_format: { type: "json_object" },
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: combined.signal,
      });

      clearTimeout(timeoutId);

      devLog.info(`OpenAI response status: ${res.status}`);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`OpenAI error ${res.status}: ${text}`);
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };

      return data.choices?.[0]?.message?.content ?? "";
    } catch (err) {
      clearTimeout(timeoutId);
      if (timedOut) throw new Error("OpenAI request timed out");
      throw err;
    }
  }
}
