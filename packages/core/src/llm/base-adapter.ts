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
}
