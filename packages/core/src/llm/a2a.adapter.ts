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
 * `timeoutMs` bounds the entire request, including the tasks/get polling loop
 * for long-running agents, not just the initial connection.
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
import { createAbortError } from "./abort-error";
import { devLog } from "../utils/dev-log";

const TERMINAL = new Set<A2ATaskState>([
  "COMPLETED", "FAILED", "CANCELED", "REJECTED", "INPUT_REQUIRED",
  "completed", "failed", "canceled", "rejected", "input-required",
]);

const WORKING = new Set<A2ATaskState>([
  "SUBMITTED", "WORKING",
  "submitted", "working",
]);

const POLL_INTERVAL_MS = 1000;
// Safety guard only. The real stop condition for the poll loop is the
// timeoutMs abort armed in chat(); this sits a few polls *above* the timeout
// budget so a timer that never fires can't spin forever, but it can never
// pre-empt the configured timeout.
const POLL_SAFETY_MARGIN_POLLS = 5;

let _rpcId = 1;

export class A2AAdapter implements BaseAdapter {
  private readonly url: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly apiKey?: string;
  private readonly metadata?: Record<string, unknown>;
  private contextId: string | undefined = undefined;
  // Extra DataParts of the most recent completed chat() — see readLastDataParts().
  private lastDataParts: unknown[] | undefined = undefined;

  constructor(config: LocalLLMConfig) {
    this.url = config.baseUrl.replace(/\/$/, "");
    this.model = config.model;
    this.timeoutMs = config.timeoutMs ?? 60_000;
    this.apiKey = config.apiKey;
    this.metadata = config.metadata;
  }

  /** Clears the A2A contextId so the next chat() starts a fresh session. */
  resetContext(): void {
    this.contextId = undefined;
    this.lastDataParts = undefined;
  }

  /**
   * Every DataPart of the last completed chat() past the first one — the first
   * is what chat() itself returned as its string. Uninterpreted: this SDK is a
   * transport and does not know what any payload means. Returns `undefined`
   * when the last task carried at most one DataPart.
   *
   * ⚠️ This is _collectParts()' collection order, NOT one turn's parts in
   * arrival order. Parts are gathered across the whole task — agent messages
   * latest-first, then artifacts latest-first — so wire order holds only
   * within a single message's (or artifact's) own parts array. Match a payload
   * by a marker it carries, never by its index in this array.
   *
   * ⚠️ Read it synchronously after the awaited chat() that produced it. Each
   * chat() overwrites this, so a turn with no extra data clears the previous
   * turn's value rather than leaving it readable.
   */
  readLastDataParts(): unknown[] | undefined {
    return this.lastDataParts;
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
    // Fail closed: drop the previous turn's extra parts before this call can
    // fail, so a rejected chat() never leaves an earlier turn's data readable.
    this.lastDataParts = undefined;

    // An already-aborted signal never fires another "abort" event, so the
    // listener below would never run and the request would go out anyway.
    // Checked before the timeout timer is armed so nothing is left to leak.
    if (signal?.aborted) throw createAbortError();

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
          metadata: { model: this.model, ...(this.metadata ?? {}) },
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
      task = await this._poll(task, combined.signal, () => timedOut);
      clearTimeout(tid);

      const state = task.status.state;
      if (
        ["FAILED", "CANCELED", "REJECTED", "failed", "canceled", "rejected"].includes(state)
      ) {
        throw new Error(
          `[WireAI] A2A task ended in state "${state}": ${task.status.message ?? "no detail"}`
        );
      }

      this.lastDataParts = this._extractExtraDataParts(task);
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
    isTimedOut: () => boolean
  ): Promise<A2ATask> {
    let current = task;
    let attempts = 0;
    // A well-formed JSON-RPC error is permanent (the agent rejected the task,
    // or does not implement the method). Thrown inside the try below it would
    // be caught by that block's own catch and swallowed as a transient network
    // failure, so the loop would poll to the full timeoutMs and report a
    // timeout instead of the real cause. It is carried out here and rethrown
    // past the catch; transient network errors keep their retry.
    let permanentError: Error | undefined;
    // The poll loop runs until the agent reaches a terminal state or the
    // configured timeoutMs aborts the request. A fixed 30-poll cap used to end
    // any run past ~30s regardless of timeoutMs, so a 60s-configured agent that
    // legitimately needed 45s died silently. This budget sits *above* the
    // timeout so the timeout, not the poll count, is what ends a long run; it
    // only guards against an abort timer that somehow never fires.
    const safetyMaxPolls =
      Math.ceil(this.timeoutMs / POLL_INTERVAL_MS) + POLL_SAFETY_MARGIN_POLLS;

    while (WORKING.has(current.status.state) && attempts < safetyMaxPolls) {
      if (signal.aborted) {
        if (isTimedOut()) throw this._timeoutError();
        // Not `createAbortError()`: this error's MESSAGE is "AbortError", not
        // the factory's "Aborted", and the message is observable to tests and
        // consumers. Only the `name` matters to the thread hook, so swapping
        // it in would change behaviour for no gain.
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
          permanentError = new Error(
            `[WireAI] A2A poll error ${rpc.error.code}: ${rpc.error.message}`
          );
        } else if (rpc.result) {
          current = rpc.result;
          if (current.contextId && !this.contextId) {
            this.contextId = current.contextId;
          }
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          // A timeout mid-poll surfaces here as an aborted fetch — report it as
          // a timeout, not a bare AbortError.
          if (isTimedOut()) throw this._timeoutError();
          throw e;
        }
        // Swallow transient network errors and retry on next iteration
      }

      // Fail fast: outside the catch, so it is not swallowed with the transient ones.
      if (permanentError) throw permanentError;
    }

    if (WORKING.has(current.status.state)) {
      // Reached only if the safety cap tripped without the timeout aborting
      // first — should not happen in normal operation.
      throw new Error(
        `[WireAI] A2A task still in state "${current.status.state}" after ${this.timeoutMs}ms. ` +
          "The agent may be overloaded."
      );
    }

    return current;
  }

  /** Timeout error shared by the connect and poll phases. */
  private _timeoutError(): Error {
    return new Error(
      `[WireAI] A2A agent did not complete within ${this.timeoutMs}ms. ` +
        "The agent may be overloaded, or raise timeoutMs for longer runs."
    );
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
    const parts = this._collectParts(task);

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

  /**
   * The task's parts in the order the extractors read them: agent messages
   * latest-first, then artifacts latest-first. Shared by _extractContent and
   * _extractExtraDataParts so "the first DataPart" means the same part in both
   * — the string chat() returns and the extras it leaves behind can never
   * disagree about where the boundary is.
   */
  private _collectParts(task: A2ATask): A2APart[] {
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

    return parts;
  }

  /**
   * Every DataPart past the first, uninterpreted. The first DataPart is the
   * component envelope that _extractContent stringifies and chat() returns;
   * anything after it (the server's `onboarding_plan`, for example) used to be
   * dropped here with no way for a consumer to recover it.
   *
   * Deliberately unvalidated: an unknown or malformed `kind` is carried through
   * exactly as received. Interpreting payloads is the consumer's job, and a
   * transport that throws on an unrecognised part would break every host the
   * moment the server learns a new one.
   */
  private _extractExtraDataParts(task: A2ATask): unknown[] | undefined {
    const dataParts: unknown[] = [];
    for (const p of this._collectParts(task)) {
      if (p.data !== undefined) dataParts.push(p.data);
    }

    return dataParts.length > 1 ? dataParts.slice(1) : undefined;
  }

  private _authHeaders(): Record<string, string> {
    return this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {};
  }
}
