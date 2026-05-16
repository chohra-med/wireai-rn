import { WIREAI_JSON_SCHEMA } from "../schema/wireai-response.schema";
import type { LocalLLMConfig, Message } from "../types";
import type { BaseAdapter, ChatMessages, StreamOnChunk } from "./base-adapter";

export class LMStudioAdapter implements BaseAdapter {
  constructor(private config: LocalLLMConfig) {}

  async ping(): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(`${this.config.baseUrl}/v1/models`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) return false;
      const data = (await res.json()) as { data?: { id: string }[] };
      return data.data?.some((m) => m.id.includes(this.config.model)) ?? false;
    } catch {
      clearTimeout(timeoutId);
      return false;
    }
  }

  async chat(
    messages: Pick<Message, "role" | "content">[],
    signal?: AbortSignal
  ): Promise<string> {
    const combined = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      combined.abort();
    }, this.config.timeoutMs ?? 30000);

    if (signal) {
      signal.addEventListener("abort", () => combined.abort());
    }

    try {
      const body = {
        model: this.config.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: this.config.temperature ?? 0.7,
        max_tokens: this.config.maxTokens ?? 1024,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "WireAIResponse",
            strict: true,
            schema: WIREAI_JSON_SCHEMA,
          },
        },
      };

      const res = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: combined.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`LM Studio error ${res.status}: ${text}`);
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };

      return data.choices?.[0]?.message?.content ?? "";
    } catch (err) {
      clearTimeout(timeoutId);
      if (timedOut) throw new Error("LM Studio request timed out");
      throw err;
    }
  }

  // LMStudio exposes OpenAI-compatible SSE. response_format is dropped in streaming
  // mode because structured output + streaming are mutually exclusive in LMStudio.
  chatStream(messages: ChatMessages, onChunk: StreamOnChunk, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutMs = this.config.timeoutMs ?? 30000;
      let accumulated = "";
      let timedOut = false;

      const xhr = new XMLHttpRequest();
      let cursor = 0;

      const timeoutId = setTimeout(() => {
        timedOut = true;
        xhr.abort();
      }, timeoutMs);

      signal?.addEventListener("abort", () => xhr.abort());

      xhr.open("POST", `${this.config.baseUrl}/v1/chat/completions`, true);
      xhr.setRequestHeader("Content-Type", "application/json");

      xhr.onprogress = () => {
        const chunk = xhr.responseText.slice(cursor);
        cursor = xhr.responseText.length;

        for (const line of chunk.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (!trimmed.startsWith("data:")) continue;
          try {
            const parsed = JSON.parse(trimmed.slice(5).trim()) as {
              choices?: { delta?: { content?: string } }[];
            };
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              onChunk(accumulated, false);
            }
          } catch {
            // partial SSE frame — handled on next onprogress
          }
        }
      };

      xhr.onload = () => {
        clearTimeout(timeoutId);
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(`LM Studio error ${xhr.status}: ${xhr.responseText.slice(0, 200)}`));
          return;
        }
        onChunk(accumulated, true);
        resolve();
      };

      xhr.onerror = () => {
        clearTimeout(timeoutId);
        reject(timedOut ? new Error("LM Studio request timed out") : new Error("LM Studio network error"));
      };

      xhr.onabort = () => {
        clearTimeout(timeoutId);
        reject(new Error("LM Studio request aborted"));
      };

      xhr.send(
        JSON.stringify({
          model: this.config.model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          temperature: this.config.temperature ?? 0.7,
          max_tokens: this.config.maxTokens ?? 1024,
          stream: true,
        })
      );
    });
  }
}
