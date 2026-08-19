/**
 * Behaviour: backgrounding the app mid-turn strands the thread rather than
 * failing it, and `retry()` re-runs the stranded turn exactly once.
 *
 * Concretely, `useWireAIThread` must:
 *   - abort the in-flight request when AppState goes to "background",
 *   - report `errorKind: "interrupted"` with `error` still null, because
 *     nothing failed,
 *   - keep the user's unanswered message in the thread,
 *   - send NOTHING by itself afterwards,
 *   - and let a later `retry()` re-run that same message without appending a
 *     second copy of it.
 *
 * The transport is a stub adapter whose `chat()` hangs until this test resolves
 * or aborts it, so every turn boundary is one the test placed. Call counts come
 * off that stub, which is the only thing that can tell "the SDK resent" apart
 * from "the test resent".
 */
jest.mock("react-native", () => require("./harness/react-native-mock"));
jest.mock("../llm/llm-factory", () => ({
  createAdapter: () => require("./harness/stub-adapter").stubAdapter,
}));

import { useWireAIThread } from "../hooks/useWireAIThread";
import { act, flush, mountHook, stubFetch } from "./harness/mount";
import { __emitAppState, __resetAppState } from "./harness/react-native-mock";
import { resetStubAdapter, stubCalls } from "./harness/stub-adapter";

const USER_TEXT = "plan my week";
const ASSISTANT_RAW = JSON.stringify({ action: "ask", message: "Which days are free?" });

const userContents = (messages: { role: string; content: string }[]): string[] =>
  messages.filter((m) => m.role === "user").map((m) => m.content);

describe("background interruption and retry", () => {
  let restoreFetch: () => void;

  beforeEach(() => {
    restoreFetch = stubFetch();
    resetStubAdapter();
    __resetAppState();
  });

  afterEach(() => {
    restoreFetch();
  });

  it("backgrounding mid-turn interrupts the turn, and retry re-runs it exactly once", async () => {
    const thread = mountHook(() => useWireAIThread());

    act(() => {
      thread.current().sendMessage(USER_TEXT);
    });
    await flush();

    // The turn is genuinely in flight. Without this the interruption below
    // would have nothing to interrupt and every later assertion would pass for
    // the wrong reason.
    expect(stubCalls()).toHaveLength(1);
    expect(thread.current().isLoading).toBe(true);
    expect(userContents(thread.current().messages)).toEqual([USER_TEXT]);

    await act(async () => {
      __emitAppState("background");
    });
    await flush();

    const interrupted = thread.current();
    expect(interrupted.errorKind).toBe("interrupted");
    expect(interrupted.error).toBeNull();
    expect(interrupted.isLoading).toBe(false);
    // The user's message survives the abort, unanswered.
    expect(userContents(interrupted.messages)).toEqual([USER_TEXT]);
    expect(interrupted.messages).toHaveLength(1);
    // Nothing auto-resends: the SDK never sends on its own.
    expect(stubCalls()).toHaveLength(1);

    act(() => {
      thread.current().retry();
    });
    await flush();

    expect(stubCalls()).toHaveLength(2);

    // The retried turn carries the SAME single user message, not a second copy.
    const retriedCall = stubCalls()[1];
    if (!retriedCall) throw new Error("retry did not reach the adapter");
    expect(userContents([...retriedCall.messages])).toEqual([USER_TEXT]);

    await act(async () => {
      retriedCall.resolve(ASSISTANT_RAW);
    });
    await flush();

    const answered = thread.current();
    expect(answered.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(userContents(answered.messages)).toEqual([USER_TEXT]);
    expect(answered.errorKind).toBeNull();
    expect(answered.error).toBeNull();
    expect(answered.isLoading).toBe(false);

    thread.unmount();
  });

  it("retry works in the window before the aborted request has settled", async () => {
    // The narrow case the AppState handler's `isLoadingRef` reset exists for.
    // `retry()` reads that ref, and the `.finally` that would otherwise clear
    // it does not run until the aborted request settles — so if the handler
    // does not lower the ref itself, a retry fired inside that window is a
    // silent no-op and the interruption the SDK just surfaced cannot be acted
    // on. Nothing is flushed between the two calls below on purpose: that IS
    // the window.
    const thread = mountHook(() => useWireAIThread());

    act(() => {
      thread.current().sendMessage(USER_TEXT);
    });
    await flush();
    expect(stubCalls()).toHaveLength(1);

    act(() => {
      __emitAppState("background");
      thread.current().retry();
    });

    expect(stubCalls()).toHaveLength(2);

    await flush();
    const retriedCall = stubCalls()[1];
    if (!retriedCall) throw new Error("retry did not reach the adapter");
    expect(userContents([...retriedCall.messages])).toEqual([USER_TEXT]);

    thread.unmount();
  });

  it("leaves a healthy turn alone: a turn that completes normally is not interrupted", async () => {
    // Positive control for the assertions above. If `errorKind` were somehow
    // stuck on "interrupted", or the stub never resolved, the first test could
    // pass while measuring nothing.
    const thread = mountHook(() => useWireAIThread());

    act(() => {
      thread.current().sendMessage(USER_TEXT);
    });
    await flush();

    const call = stubCalls()[0];
    if (!call) throw new Error("sendMessage did not reach the adapter");
    await act(async () => {
      call.resolve(ASSISTANT_RAW);
    });
    await flush();

    const done = thread.current();
    expect(done.errorKind).toBeNull();
    expect(done.error).toBeNull();
    expect(done.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(stubCalls()).toHaveLength(1);

    thread.unmount();
  });

  it("retry is a no-op when the newest message is not an unanswered user message", async () => {
    const thread = mountHook(() => useWireAIThread());

    act(() => {
      thread.current().sendMessage(USER_TEXT);
    });
    await flush();
    const call = stubCalls()[0];
    if (!call) throw new Error("sendMessage did not reach the adapter");
    await act(async () => {
      call.resolve(ASSISTANT_RAW);
    });
    await flush();

    act(() => {
      thread.current().retry();
    });
    await flush();

    expect(stubCalls()).toHaveLength(1);
    expect(thread.current().messages).toHaveLength(2);

    thread.unmount();
  });
});
