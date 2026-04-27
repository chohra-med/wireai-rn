import { WIREAI_JSON_SCHEMA } from "../schema/wireai-response.schema";
import type { LocalLLMConfig, Message } from "../types";
import type { BaseAdapter } from "./base-adapter";

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
}
