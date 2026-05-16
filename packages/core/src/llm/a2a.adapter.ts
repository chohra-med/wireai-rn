/**
 * A2AAdapter — connects WireAI to any Google A2A (Agent-to-Agent) protocol endpoint.
 *
 * Implements A2A v1.0 JSON-RPC 2.0 with v0.3 backwards compatibility.
 * The remote agent must be pre-configured to return wireai-rn JSON format
 * in either a TextPart or a DataPart of the final task response.
 *
 * Multi-turn conversations are maintained server-side via `contextId`.
 * Clearing the conversation (reset()) re-creates this adapter instance,
 * which clears the contextId and starts a fresh A2A session.
 *
 * @example
 * ```ts
 * const config: LocalLLMConfig = {
 *   provider: "a2a",
 *   baseUrl: "https://your-a2a-agent.example.com/a2a",
 *   model: "mental-coach-agent",   // informational — sent as metadata
 *   apiKey: "optional-bearer-token",
 *   timeoutMs: 60_000,
 * };
 * ```
 *
 * Expected agent response (DataPart — preferred):
 * ```json
 * {
 *   "task": {
 *     "id": "...", "contextId": "...",
 *     "status": { "state": "COMPLETED" },
 *     "messages": [{
 *       "role": "agent",
 *       "parts": [{ "data": { "action": "render", "component": "ActionCard", "props": {} } }]
 *     }]
 *   }
 * }
 * ```
 *
 * Or as a TextPart (fallback):
 * ```json
 * { "parts": [{ "text": "{\"action\":\"render\",\"component\":\"ActionCard\",\"props\":{}}" }] }
 * ```
 */
import type {
  LocalLLMConfig,
  Message,
  A2ATask,
  A2ATaskState,
  A2APart,
  A2AMessage,
  A2AJsonRpcResponse,
  A2AAgentCard,
} from "../types";
import type { BaseAdapter } from "./base-adapter";
import { devLog } from "../utils/dev-log";

const TERMINAL = new Set<A2ATaskState>([
  "COMPLETED", "FAILED", "CANCELED", "REJECTED", "INPUT_REQUIRED",
  "completed", "failed", "canceled", "rejected", "input-required",
]);

const WORKING = new Set<A2ATaskState>([
  "SUBMITTED", "WORKING",
  "submitted", "working",
]);

const MAX_POLLS = 30;
const POLL_INTERVAL_MS = 1000;

let _rpcId = 1;

export class A2AAdapter implements BaseAdapter {
  private readonly url: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly apiKey?: string;
  private contextId: string | undefined = undefined;

  constructor(config: LocalLLMConfig) {
    this.url = config.baseUrl.replace(/\/$/, "");
    this.model = config.model;
    this.timeoutMs = config.timeoutMs ?? 60_000;
    this.apiKey = config.apiKey;
  }

  /** Clears the A2A contextId so the next chat() starts a fresh session. */
  resetContext(): void {
    this.contextId = undefined;
  }

  // ─── ping ───────────────────────────────────────────────────────────────────

  async ping(): Promise<boolean> {
    try {
      const { protocol, host } = new URL(this.url);
      const cardUrl = `${protocol}//${host}/.well-known/agent-card.json`;
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(cardUrl, {
        method: "GET",
        headers: this._authHeaders(),
        signal: controller.signal,
      });
      clearTimeout(tid);
      if (!res.ok) return false;
      const card = (await res.json()) as A2AAgentCard;
      return typeof card.url === "string";
    } catch {
      return false;
    }
  }

  // ─── chat ───────────────────────────────────────────────────────────────────

  async chat(
    messages: Pick<Message, "role" | "content">[],
    signal?: AbortSignal
  ): Promise<string> {
    const combined = new AbortController();
    let timedOut = false;
    const tid = setTimeout(() => {
      timedOut = true;
      combined.abort();
    }, this.timeoutMs);
    signal?.addEventListener("abort", () => combined.abort());

    try {
      // Filter system messages; A2A agents are pre-configured server-side.
      // Map "assistant" → "agent" to match A2A v1.0 role naming.
      const a2aMessages: A2AMessage[] = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "agent" : "user",
          parts: [{ text: m.content }],
        }));

      if (!a2aMessages.length) {
        throw new Error("[WireAI] A2AAdapter: no non-system messages to send.");
      }

      // A2A is stateful via contextId — only the latest user message is sent.
      // The server reconstructs history from its own session store.
      const body = {
        jsonrpc: "2.0",
        id: _rpcId++,
        method: "message/send",
        params: {
          message: a2aMessages[a2aMessages.length - 1],
          ...(this.contextId ? { contextId: this.contextId } : {}),
          metadata: { model: this.model },
        },
      };

      devLog.info("[A2AAdapter] message/send", {
        url: this.url,
        contextId: this.contextId,
      });

      let res: Response;
      try {
        res = await fetch(this.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...this._authHeaders() },
          body: JSON.stringify(body),
          signal: combined.signal,
        });
      } catch (e) {
        clearTimeout(tid);
        if (e instanceof Error && e.name === "AbortError") {
          if (timedOut) {
            throw new Error(
              `[WireAI] A2A agent did not respond within ${this.timeoutMs}ms. ` +
                `Check that your agent at ${this.url} is running.`
            );
          }
          throw e;
        }
        throw new Error(
          `[WireAI] Cannot connect to A2A agent at ${this.url}. ` +
            `Make sure the agent server is running and accessible.`
        );
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`[WireAI] A2A agent returned HTTP ${res.status}: ${txt}`);
      }

      const rpc = (await res.json()) as A2AJsonRpcResponse;

      if (rpc.error) {
        throw new Error(
          `[WireAI] A2A JSON-RPC error ${rpc.error.code}: ${rpc.error.message}`
        );
      }
      if (!rpc.result) {
        throw new Error("[WireAI] A2A response missing result field.");
      }

      let task = rpc.result;

      if (task.contextId) {
        this.contextId = task.contextId;
        devLog.info("[A2AAdapter] contextId stored", { contextId: this.contextId });
      }

      // Poll tasks/get until a terminal state is reached
      task = await this._poll(task, combined.signal, timedOut);
      clearTimeout(tid);

      const state = task.status.state;
      if (
        ["FAILED", "CANCELED", "REJECTED", "failed", "canceled", "rejected"].includes(state)
      ) {
        throw new Error(
          `[WireAI] A2A task ended in state "${state}": ${task.status.message ?? "no detail"}`
        );
      }

      return this._extractContent(task);
    } catch (err) {
      clearTimeout(tid);
      throw err;
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async _poll(
    task: A2ATask,
    signal: AbortSignal,
    timedOut: boolean
  ): Promise<A2ATask> {
    let current = task;
    let attempts = 0;

    while (WORKING.has(current.status.state) && attempts < MAX_POLLS) {
      if (signal.aborted) {
        throw Object.assign(new Error("AbortError"), { name: "AbortError" });
      }

      await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
      attempts++;

      devLog.info("[A2AAdapter] tasks/get poll", {
        taskId: current.id,
        attempt: attempts,
        state: current.status.state,
      });

      try {
        const res = await fetch(this.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...this._authHeaders() },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: _rpcId++,
            method: "tasks/get",
            params: { taskId: current.id },
          }),
          signal,
        });

        if (!res.ok) continue; // transient — retry

        const rpc = (await res.json()) as A2AJsonRpcResponse;
        if (rpc.error) {
          throw new Error(
            `[WireAI] A2A poll error ${rpc.error.code}: ${rpc.error.message}`
          );
        }
        if (rpc.result) {
          current = rpc.result;
          if (current.contextId && !this.contextId) {
            this.contextId = current.contextId;
          }
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") throw e;
        // Swallow transient network errors and retry on next iteration
      }
    }

    if (attempts >= MAX_POLLS && WORKING.has(current.status.state)) {
      throw new Error(
        `[WireAI] A2A task still in state "${current.status.state}" after ${MAX_POLLS} polls. ` +
          "The agent may be overloaded."
      );
    }

    return current;
  }

  /**
   * Extracts a wireai-rn compatible string from a terminal A2A task.
   *
   * Priority:
   *   1. DataPart (latest agent message first) — return JSON.stringify(part.data)
   *   2. TextPart (latest agent message first) — return the text string
   *   3. Same from artifacts
   *
   * Supports both A2A v1.0 (unified Part) and v0.3 (separate types with "content" field).
   */
  private _extractContent(task: A2ATask): string {
    const parts: A2APart[] = [];

    // Collect from agent messages, reversed so the latest message is checked first
    for (const msg of (task.messages ?? []).slice().reverse()) {
      if (msg.role === "agent" || msg.role === "assistant") {
        parts.push(...(msg.parts ?? []));
      }
    }
    // Collect from artifacts (latest first)
    for (const artifact of (task.artifacts ?? []).slice().reverse()) {
      parts.push(...(artifact.parts ?? []));
    }

    // Pass 1: DataPart — structured wireai-rn JSON or A2UI payload
    for (const p of parts) {
      if (p.data !== undefined) return JSON.stringify(p.data);
    }

    // Pass 2: TextPart — wireai-rn JSON embedded in a text string
    for (const p of parts) {
      if (p.text?.trim()) return p.text;
      if (p.content?.trim()) return p.content; // v0.3 compat
    }

    return "";
  }

  private _authHeaders(): Record<string, string> {
    return this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {};
  }
}
