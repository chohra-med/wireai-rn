/**
 * A `BaseAdapter` whose every call hangs until the test says otherwise.
 *
 * `useWireAIThread` builds its adapter through `llm/llm-factory`, so a test
 * that needs to control a turn mocks that module to hand back this stub:
 *
 *   jest.mock("../../llm/llm-factory", () => ({
 *     createAdapter: () => require("./harness/stub-adapter").stubAdapter,
 *   }));
 *
 * It implements `chat` and NOT `chatStream`, which puts the hook on its
 * non-streaming path regardless of the provider's `streaming` prop, so a test
 * about turn lifecycle is not also a test about token streaming.
 *
 * Aborting the signal rejects the pending call with the shape the SDK's own
 * adapters reject with (`createAbortError`), because `classifyTurnFailure`
 * keys off `err.name === "AbortError"` and a bare Error would be classified as
 * a hard failure instead.
 *
 * That rejection is deliberately deferred by one macrotask, because no real
 * adapter here rejects synchronously either: `WebhookAdapter` waits for
 * `xhr.onabort` to fire before it rejects, and `A2AAdapter` waits for the
 * aborted `fetch` to reject inside its own catch. The delay is load-bearing
 * rather than cosmetic. There is a window between "the app went to background"
 * and "the aborted request settled", and the `isLoadingRef` reset in the
 * hook's AppState handler exists only to make `retry()` work INSIDE that
 * window. A stub that rejected synchronously would close the window before any
 * test could look at it, and the test would report green whether or not the
 * reset was there.
 *
 * This file lives under `src/__tests__/` and is excluded from the npm tarball
 * by the `files` field in package.json.
 */
import { createAbortError } from "../../llm/abort-error";
import type { BaseAdapter, ChatMessages } from "../../llm/base-adapter";

export type StubCall = {
  /** The message list the hook sent for this turn, system prompt included. */
  messages: ChatMessages;
  signal?: AbortSignal;
  /** Finish this turn with a raw assistant payload. */
  resolve: (raw: string) => void;
  /** Finish this turn with a failure. */
  reject: (err: unknown) => void;
};

const calls: StubCall[] = [];

export const stubAdapter: BaseAdapter = {
  ping: async () => true,
  chat: (messages: ChatMessages, signal?: AbortSignal): Promise<string> =>
    new Promise<string>((resolve, reject) => {
      calls.push({ messages, signal, resolve, reject });
      signal?.addEventListener("abort", () => {
        setTimeout(() => reject(createAbortError()), 0);
      });
    }),
};

/** Every `chat()` the hook has made since the last reset, oldest first. */
export const stubCalls = (): readonly StubCall[] => calls;

export const resetStubAdapter = (): void => {
  calls.length = 0;
};
