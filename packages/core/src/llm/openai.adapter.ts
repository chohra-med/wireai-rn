import type { LocalLLMConfig, Message } from "../types";
import { devLog } from "../utils/dev-log";
import { createAbortError } from "./abort-error";
import type { BaseAdapter, ChatMessages, StreamOnChunk } from "./base-adapter";

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

    // An already-aborted signal never fires another "abort" event, so the
    // listener below would never run and the request would go out anyway.
    // Checked before the timeout timer is armed so nothing is left to leak.
    if (signal?.aborted) throw createAbortError();

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

  /**
   * Streaming variant — uses XMLHttpRequest because React Native's `fetch`
   * does not expose `response.body` as a ReadableStream. The `onprogress`
   * event fires as each chunk arrives, which we parse as SSE frames.
   */
  chatStream(
    messages: ChatMessages,
    onChunk: StreamOnChunk,
    signal?: AbortSignal
  ): Promise<void> {
    if (!this.apiKey) {
      return Promise.reject(
        new Error("[WireAI] OpenAIAdapter: apiKey is required. Pass it via LocalLLMConfig.apiKey.")
      );
    }

    // An already-aborted signal never fires another "abort" event, so without
    // this the XHR would be opened and sent with nothing left to cancel it.
    if (signal?.aborted) return Promise.reject(createAbortError());

    const url = `${this.baseUrl}/v1/chat/completions`;
    const timeoutMs = this.config.timeoutMs ?? 30000;

    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let lastResponseLength = 0;
      let bufferedFrame = "";
      let accumulated = "";
      let timedOut = false;
      let settled = false;

      const timeoutId = setTimeout(() => {
        timedOut = true;
        xhr.abort();
      }, timeoutMs);

      const onAbort = () => xhr.abort();
      signal?.addEventListener("abort", onAbort);

      const cleanup = () => {
        clearTimeout(timeoutId);
        signal?.removeEventListener("abort", onAbort);
      };

      const consumeFrames = (text: string): void => {
        bufferedFrame += text;
        // SSE frames are separated by a blank line.
        const frames = bufferedFrame.split("\n\n");
        bufferedFrame = frames.pop() ?? "";
        for (const frame of frames) {
          for (const line of frame.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload) as {
                choices?: { delta?: { content?: string } }[];
              };
              const delta = json.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta.length > 0) {
                accumulated += delta;
                onChunk(accumulated, false);
              }
            } catch {
              // Ignore malformed frames — OpenAI occasionally emits keep-alives.
            }
          }
        }
      };

      xhr.open("POST", url, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("Authorization", `Bearer ${this.apiKey}`);
      xhr.setRequestHeader("Accept", "text/event-stream");

      xhr.onprogress = () => {
        const newText = xhr.responseText.slice(lastResponseLength);
        lastResponseLength = xhr.responseText.length;
        if (newText) consumeFrames(newText);
      };

      xhr.onload = () => {
        if (settled) return;
        settled = true;
        const tail = xhr.responseText.slice(lastResponseLength);
        if (tail) consumeFrames(tail);
        cleanup();
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(`OpenAI error ${xhr.status}: ${xhr.responseText}`));
          return;
        }
        onChunk(accumulated, true);
        resolve();
      };

      xhr.onerror = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error("OpenAI stream network error"));
      };

      xhr.onabort = () => {
        if (settled) return;
        settled = true;
        cleanup();
        if (timedOut) {
          reject(new Error("OpenAI stream timed out"));
        } else {
          reject(createAbortError());
        }
      };

      const body = {
        model: this.config.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: this.config.temperature ?? 0.7,
        max_tokens: this.config.maxTokens ?? 1024,
        stream: true,
        response_format: { type: "json_object" },
      };

      devLog.info(`OpenAI streaming request: ${url}`);
      xhr.send(JSON.stringify(body));
    });
  }
}
