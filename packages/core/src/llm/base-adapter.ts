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
   * Optional. Structured data the transport carried ALONGSIDE the rendered card on
   * the last completed `chat()` — today, the A2A `onboarding_plan` DataPart. `chat()`
   * returns a string, so an adapter that receives more than a card has nowhere else to
   * put it; `useWireAIThread` reads this after each non-streaming turn and hangs the
   * value off the assistant `Message` as `plan`. (The streaming path is not wired to
   * it: no adapter implements both `chatStream` and this today.)
   *
   * `undefined` (or an adapter that does not implement this at all) means the turn
   * carried no plan, which is the normal case for every turn but a terminal one.
   */
  readLastPlan?(): unknown;
}
