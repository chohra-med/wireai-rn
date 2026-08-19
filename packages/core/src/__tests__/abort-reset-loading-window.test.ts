/**
 * Behaviour: `abort()` and `reset()` hand the thread straight back to the
 * consumer. A `sendMessage` or `retry()` fired immediately after either call
 * runs, instead of being silently swallowed.
 *
 * Why there is a window to test at all: both guards in `useWireAIThread` read
 * `isLoadingRef`, not the `isLoading` state, and the `.finally` that lowers
 * that ref does not run until the aborted request settles. Between the abort
 * and that settlement the hook reports `isLoading: false` while the ref is
 * still true, so the next call returns early and the consumer sees nothing
 * happen. Every test below fires its second call inside that window: there is
 * no `flush()` between the two calls on purpose, because the flush IS the
 * settlement that closes the window.
 *
 * The transport is the stub adapter, whose rejection is deferred by a
 * macrotask exactly like the real ones. Call counts come off that stub, so
 * "the SDK sent" cannot be confused with "the test sent".
 */
jest.mock("react-native", () => require("./harness/react-native-mock"));
jest.mock("../llm/llm-factory", () => ({
  createAdapter: () => require("./harness/stub-adapter").stubAdapter,
}));

import { useWireAIThread } from "../hooks/useWireAIThread";
import type { Message } from "../types";
import { act, flush, mountHook, stubFetch } from "./harness/mount";
import { __resetAppState } from "./harness/react-native-mock";
import { resetStubAdapter, stubCalls } from "./harness/stub-adapter";

const FIRST_TEXT = "plan my week";
const SECOND_TEXT = "actually, plan my month";

/** An unanswered user message already in the thread, for the retry cases. */
const SEEDED: Message[] = [
  { id: "seed_user_1", role: "user", content: FIRST_TEXT, timestamp: 1 },
];

const userContents = (messages: readonly { role: string; content: string }[]): string[] =>
  messages.filter((m) => m.role === "user").map((m) => m.content);

/** The message list the adapter was handed on the nth call (1-based). */
const nthCallUserContents = (n: number): string[] => {
  const call = stubCalls()[n - 1];
  if (!call) throw new Error(`only ${stubCalls().length} adapter call(s) were made, wanted ${n}`);
  return userContents([...call.messages]);
};

describe("the loading window after abort() and reset()", () => {
  let restoreFetch: () => void;

  beforeEach(() => {
    restoreFetch = stubFetch();
    resetStubAdapter();
    __resetAppState();
  });

  afterEach(() => {
    restoreFetch();
  });

  it("a send fired right after abort() reaches the adapter", async () => {
    const thread = mountHook(() => useWireAIThread());

    act(() => {
      thread.current().sendMessage(FIRST_TEXT);
    });
    await flush();

    // The turn is genuinely in flight, so the abort below has something to
    // abort and the guard under test is genuinely armed.
    expect(stubCalls()).toHaveLength(1);
    expect(thread.current().isLoading).toBe(true);

    act(() => {
      thread.current().abort();
      thread.current().sendMessage(SECOND_TEXT);
    });

    expect(stubCalls()).toHaveLength(2);
    expect(thread.current().isLoading).toBe(true);

    await flush();
    // Both sides are the hook's own: the history it handed the adapter against
    // the messages it put in state. Neither is a literal from this test.
    expect(nthCallUserContents(2)).toEqual(userContents(thread.current().messages));

    thread.unmount();
  });

  it("a retry fired right after abort() re-runs the unanswered turn", async () => {
    const thread = mountHook(() => useWireAIThread(), { initialMessages: SEEDED });

    act(() => {
      thread.current().retry();
    });
    await flush();

    expect(stubCalls()).toHaveLength(1);
    expect(thread.current().isLoading).toBe(true);

    act(() => {
      thread.current().abort();
      thread.current().retry();
    });

    expect(stubCalls()).toHaveLength(2);
    expect(thread.current().isLoading).toBe(true);

    await flush();
    expect(nthCallUserContents(2)).toEqual(userContents(thread.current().messages));
    // Re-running a turn must not append a second copy of the message.
    expect(thread.current().messages).toHaveLength(1);

    thread.unmount();
  });

  it("a send fired right after reset() reaches the adapter", async () => {
    const thread = mountHook(() => useWireAIThread());

    act(() => {
      thread.current().sendMessage(FIRST_TEXT);
    });
    await flush();

    expect(stubCalls()).toHaveLength(1);
    expect(thread.current().isLoading).toBe(true);

    act(() => {
      thread.current().reset();
      thread.current().sendMessage(SECOND_TEXT);
    });

    expect(stubCalls()).toHaveLength(2);
    expect(thread.current().isLoading).toBe(true);

    await flush();
    expect(nthCallUserContents(2)).toEqual(userContents(thread.current().messages));

    thread.unmount();
  });

  it("a retry fired right after reset() re-runs the unanswered turn", async () => {
    const thread = mountHook(() => useWireAIThread(), { initialMessages: SEEDED });

    act(() => {
      thread.current().retry();
    });
    await flush();

    expect(stubCalls()).toHaveLength(1);
    expect(thread.current().isLoading).toBe(true);

    act(() => {
      thread.current().reset();
      thread.current().retry();
    });

    expect(stubCalls()).toHaveLength(2);
    expect(thread.current().isLoading).toBe(true);

    await flush();
    expect(nthCallUserContents(2)).toEqual(userContents(thread.current().messages));
    expect(thread.current().messages).toHaveLength(1);

    thread.unmount();
  });

  it("control: without an abort or a reset, a second send is still refused mid-turn", async () => {
    // The guard the four tests above walk past is still standing. Without this
    // they could all pass because the guard stopped working at all, which
    // would be a different and worse defect than the one being fixed.
    const thread = mountHook(() => useWireAIThread());

    act(() => {
      thread.current().sendMessage(FIRST_TEXT);
    });
    await flush();
    expect(stubCalls()).toHaveLength(1);

    act(() => {
      thread.current().sendMessage(SECOND_TEXT);
    });

    expect(stubCalls()).toHaveLength(1);
    expect(userContents(thread.current().messages)).toEqual(nthCallUserContents(1));

    thread.unmount();
  });
});
