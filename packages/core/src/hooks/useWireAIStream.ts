import { useEffect, useRef, useState } from "react";
import {
  type StreamContent,
  getStream,
  subscribeStream,
} from "../streaming/streamStore";

/**
 * Subscribe to the partial / final response for a streaming assistant message.
 *
 * Re-renders are coalesced via `requestAnimationFrame` so a fast token stream
 * (e.g. OpenAI SSE) doesn't dispatch one state update per chunk.
 *
 * Returns `undefined` if no stream is active for that id (e.g. after the
 * final message has been written back to the thread).
 */
export const useWireAIStream = (messageId: string): StreamContent | undefined => {
  const [, forceRender] = useState(0);
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  useEffect(() => {
    const schedule = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        forceRender((n) => n + 1);
      });
    };
    const unsubscribe = subscribeStream(messageId, schedule);
    // Initial pull, in case content already exists when the hook mounts.
    if (getStream(messageId) !== undefined) schedule();
    return () => {
      unsubscribe();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [messageId]);

  return getStream(messageId);
};
