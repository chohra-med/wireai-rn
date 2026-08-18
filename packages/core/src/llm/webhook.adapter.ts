/**
 * WebhookAdapter — connects WireAI to any HTTP agent endpoint.
 *
 * Send the conversation to your LangChain, CrewAI, n8n, Flowise, or custom
 * agent server. The agent responds with JSON, WireAI validates and renders.
 *
 * @example
 * ```ts
 * const config: LocalLLMConfig = {
 *   provider: "webhook",
 *   baseUrl: "https://your-agent.example.com/api/chat",
 *   model: "your-agent", // informational — sent in request body
 * };
 * ```
 *
 * Expected request body (POST):
 * ```json
 * {
 *   "messages": [{ "role": "system", "content": "..." }, { "role": "user", "content": "..." }],
 *   "model": "your-agent"
 * }
 * ```
 *
 * Expected response (JSON):
 * ```json
 * { "content": "{\"action\":\"render\",\"component\":\"ActionCard\",\"props\":{...}}" }
 * ```
 * OR a plain string response body.
 */
import type { LocalLLMConfig } from "../types";
import { createAbortError } from "./abort-error";
import type { BaseAdapter, ChatMessages, StreamOnChunk } from "./base-adapter";

type ChatMessage = { role: string; content: string };

export class WebhookAdapter implements BaseAdapter {
  private readonly url: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly apiKey?: string;

  constructor(config: LocalLLMConfig) {
    this.url = config.baseUrl.replace(/\/$/, "");
    this.model = config.model;
    this.timeoutMs = config.timeoutMs ?? 60_000;
    this.apiKey = config.apiKey;
  }

  async chat(messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
    // An already-aborted signal never fires another "abort" event, so the
    // listener below would never run and the request would go out anyway.
    // Checked before the timeout timer is armed so nothing is left to leak.
    if (signal?.aborted) throw createAbortError();

    const combined = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      combined.abort();
    }, this.timeoutMs);
    signal?.addEventListener("abort", () => combined.abort());

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    let response: Response;
    try {
      response = await fetch(this.url, {
        method: "POST",
        headers,
        body: JSON.stringify({ messages, model: this.model }),
        signal: combined.signal,
      });
    } catch (e) {
      clearTimeout(timeoutId);
      if (e instanceof Error && e.name === "AbortError") {
        if (timedOut) {
          throw new Error(
            `[WireAI] Webhook did not respond within ${this.timeoutMs}ms. ` +
              `Check that your agent at ${this.url} is running.`
          );
        }
        throw e;
      }
      throw new Error(
        `[WireAI] Cannot connect to webhook at ${this.url}. ` +
          `Make sure your agent server is running and accessible.`
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `[WireAI] Webhook returned HTTP ${response.status}: ${errorText}`
      );
    }

    const text = await response.text();

    // Try to parse as JSON with a `content` field (standard format)
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      if (typeof json.content === "string") return json.content;
      if (typeof json.response === "string") return json.response;
      if (typeof json.output === "string") return json.output;
      if (typeof json.message === "string") return json.message;
      // If JSON but no known field, return the stringified JSON
      return text;
    } catch {
      // Plain string response — return as-is
      return text;
    }
  }

  async ping(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(this.url, {
        method: "OPTIONS",
        signal: controller.signal,
      });
      clearTimeout(id);
      return response.ok || response.status === 405; // 405 = endpoint exists but doesn't support OPTIONS
    } catch {
      return false;
    }
  }

  /**
   * Streaming variant — XHR-based to read chunks as they arrive (RN's fetch
   * does not expose `response.body` as a ReadableStream).
   *
   * Server contract: respond with `Transfer-Encoding: chunked`, writing the
   * assistant's raw JSON output progressively. The adapter accumulates the
   * full body and the SDK validates the final shape with the strict schema.
   * If your server wraps the response in `{ content: ... }`, prefer the
   * non-streaming `chat()` method or strip the wrapper server-side before
   * streaming.
   */
  chatStream(
    messages: ChatMessages,
    onChunk: StreamOnChunk,
    signal?: AbortSignal
  ): Promise<void> {
    // An already-aborted signal never fires another "abort" event, so without
    // this the XHR would be opened and sent with nothing left to cancel it.
    if (signal?.aborted) return Promise.reject(createAbortError());

    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let lastLen = 0;
      let accumulated = "";
      let timedOut = false;
      let settled = false;

      const timeoutId = setTimeout(() => {
        timedOut = true;
        xhr.abort();
      }, this.timeoutMs);

      const onAbort = () => xhr.abort();
      signal?.addEventListener("abort", onAbort);

      const cleanup = () => {
        clearTimeout(timeoutId);
        signal?.removeEventListener("abort", onAbort);
      };

      xhr.open("POST", this.url, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      if (this.apiKey) xhr.setRequestHeader("Authorization", `Bearer ${this.apiKey}`);

      xhr.onprogress = () => {
        const newText = xhr.responseText.slice(lastLen);
        lastLen = xhr.responseText.length;
        if (!newText) return;
        accumulated += newText;
        onChunk(accumulated, false);
      };

      xhr.onload = () => {
        if (settled) return;
        settled = true;
        const tail = xhr.responseText.slice(lastLen);
        if (tail) accumulated += tail;
        cleanup();
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(
            new Error(`[WireAI] Webhook returned HTTP ${xhr.status}: ${accumulated}`)
          );
          return;
        }
        onChunk(accumulated, true);
        resolve();
      };

      xhr.onerror = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(
          new Error(
            `[WireAI] Cannot connect to webhook at ${this.url}. ` +
              `Make sure your agent server is running and accessible.`
          )
        );
      };

      xhr.onabort = () => {
        if (settled) return;
        settled = true;
        cleanup();
        if (timedOut) {
          reject(
            new Error(
              `[WireAI] Webhook did not respond within ${this.timeoutMs}ms. ` +
                `Check that your agent at ${this.url} is running.`
            )
          );
        } else {
          const err = new Error("Aborted");
          err.name = "AbortError";
          reject(err);
        }
      };

      xhr.send(JSON.stringify({ messages, model: this.model }));
    });
  }
}
