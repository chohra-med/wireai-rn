import { WIREAI_JSON_SCHEMA } from "../schema/wireai-response.schema";
import type { LocalLLMConfig, Message } from "../types";
import { createAbortError } from "./abort-error";
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
    // An already-aborted signal never fires another "abort" event, so without
    // this the XHR would be opened and sent with nothing left to cancel it.
    if (signal?.aborted) return Promise.reject(createAbortError());

    return new Promise((resolve, reject) => {
      const timeoutMs = this.config.timeoutMs ?? 30000;
      let accumulated = "";
      let timedOut = false;

      const xhr = new XMLHttpRequest();
      let lastResponseLength = 0;
      let bufferedLine = "";

      const timeoutId = setTimeout(() => {
        timedOut = true;
        xhr.abort();
      }, timeoutMs);

      signal?.addEventListener("abort", () => xhr.abort());

      const parseLine = (line: string): void => {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") return;
        if (!trimmed.startsWith("data:")) return;
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
          // Malformed frame — LMStudio occasionally emits a keep-alive line.
        }
      };

      // LMStudio puts one SSE `data:` payload per line, but a chunk boundary
      // can land mid-line. The trailing fragment is held in `bufferedLine`
      // until the rest of it arrives instead of being parsed once and dropped;
      // `flush` (end of stream) parses that remainder, which by then is a
      // complete line carrying no trailing newline.
      const consumeLines = (text: string, flush: boolean): void => {
        bufferedLine += text;
        const lines = bufferedLine.split("\n");
        bufferedLine = lines.pop() ?? "";
        for (const line of lines) parseLine(line);
        if (flush) {
          const remainder = bufferedLine;
          bufferedLine = "";
          parseLine(remainder);
        }
      };

      xhr.open("POST", `${this.config.baseUrl}/v1/chat/completions`, true);
      xhr.setRequestHeader("Content-Type", "application/json");

      xhr.onprogress = () => {
        const newText = xhr.responseText.slice(lastResponseLength);
        lastResponseLength = xhr.responseText.length;
        if (newText) consumeLines(newText, false);
      };

      xhr.onload = () => {
        clearTimeout(timeoutId);
        // Tail flush: text that arrived without a further onprogress, plus the
        // buffered fragment, is the last content of the stream.
        const tail = xhr.responseText.slice(lastResponseLength);
        lastResponseLength = xhr.responseText.length;
        consumeLines(tail, true);
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
        // The timeout aborts the XHR, so the timeout branch has to be read
        // here or a timed-out stream reports as a plain abort. A caller abort
        // must carry name "AbortError" to be told apart from a real failure.
        reject(timedOut ? new Error("LM Studio request timed out") : createAbortError());
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
