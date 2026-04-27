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

type ChatMessage = { role: string; content: string };

export class WebhookAdapter {
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
    const combined = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      combined.abort("timeout");
    }, this.timeoutMs);
    signal?.addEventListener("abort", () => combined.abort(signal.reason));

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
}
