import type { LocalLLMConfig, Message } from "../types";
import type { BaseAdapter } from "./base-adapter";

export class OllamaAdapter implements BaseAdapter {
  constructor(private config: LocalLLMConfig) {}

  async ping(): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(`${this.config.baseUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) return false;
      const data = (await res.json()) as { models?: { name: string }[] };
      return data.models?.some((m) => m.name.startsWith(this.config.model)) ?? false;
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
        stream: false,
        format: "json",
        options: {
          temperature: this.config.temperature ?? 0.7,
          num_predict: this.config.maxTokens ?? 1024,
        },
      };

      const res = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: combined.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Ollama error ${res.status}: ${text}`);
      }

      const data = (await res.json()) as {
        message?: { content?: string };
        done_reason?: string;
        finish_reason?: string;
      };

      const rawReason = data.done_reason ?? (data as Record<string, unknown>)["finish_reason"];
      if (rawReason && rawReason !== "stop") {
        throw new Error(`Ollama did not finish normally: ${rawReason}`);
      }

      return data.message?.content ?? "";
    } catch (err) {
      clearTimeout(timeoutId);
      if (timedOut) throw new Error("Ollama request timed out");
      throw err;
    }
  }
}
