import type { WireAIResponse } from "../types";

/**
 * Pub/sub store for in-flight streaming responses, keyed by `messageId`.
 *
 * Lives outside the React tree so a fast token stream doesn't churn the
 * `messages` array. Subscribers (`useWireAIStream`) batch re-renders via rAF.
 */

export type StreamContent = {
  /** Latest best-effort partial response, or undefined while the buffer hasn't parsed yet. */
  response?: WireAIResponse;
  /** True until the final chunk arrives. */
  isStreaming: boolean;
};

const store = new Map<string, StreamContent>();
const listeners = new Map<string, Set<() => void>>();

export const pushStream = (id: string, content: StreamContent): void => {
  store.set(id, content);
  const set = listeners.get(id);
  if (set) {
    for (const fn of set) fn();
  }
};

export const clearStream = (id: string): void => {
  store.delete(id);
  // Notify any listeners so they re-render once (they'll see `undefined`).
  const set = listeners.get(id);
  if (set) {
    for (const fn of set) fn();
  }
};

export const getStream = (id: string): StreamContent | undefined => store.get(id);

export const subscribeStream = (id: string, fn: () => void): (() => void) => {
  let set = listeners.get(id);
  if (!set) {
    set = new Set();
    listeners.set(id, set);
  }
  set.add(fn);
  return () => {
    set?.delete(fn);
    if (set && set.size === 0) listeners.delete(id);
  };
};
