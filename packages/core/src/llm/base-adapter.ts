import type { Message } from "../types";

export type ChatMessages = Pick<Message, "role" | "content">[];

/**
 * Streaming chunk callback. `accumulatedText` is the cumulative assistant
 * response so far (not the delta). `isDone` is `true` exactly once, on the
 * final invocation, before the returned Promise resolves.
 */
export type StreamOnChunk = (accumulatedText: string, isDone: boolean) => void;

export interface BaseAdapter {
  ping(): Promise<boolean>;
  chat(messages: ChatMessages, signal?: AbortSignal): Promise<string>;
  /**
   * Optional streaming path. When present, `useWireAIThread` prefers it and
   * pushes progressive partial responses to the stream store. Implementations
   * MUST call `onChunk(accumulated, true)` exactly once on success before
   * resolving. Errors should reject the returned Promise.
   */
  chatStream?(
    messages: ChatMessages,
    onChunk: StreamOnChunk,
    signal?: AbortSignal
  ): Promise<void>;
  /**
   * Optional read-back for structured data the transport carried alongside the
   * `chat()` string but could not express inside it — e.g. an A2A task whose
   * agent message holds more than one DataPart. Returns every such part past
   * the first, in wire order, uninterpreted, or `undefined` when the last
   * `chat()` carried none.
   *
   * ⚠️ Invariant: this reads back the MOST RECENT `chat()` call only, and is
   * correct solely when read synchronously after that call's `await` resolves,
   * with no intervening `await`. Every `chat()` overwrites the stored value —
   * including a call that carries no extra data, which clears it — so a later
   * turn can never observe an earlier turn's payload. Adapters that never carry
   * extra data simply omit this member.
   */
  readLastDataParts?(): unknown[] | undefined;
}
