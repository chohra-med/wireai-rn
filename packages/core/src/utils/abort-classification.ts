/**
 * What a failed turn means for the thread's state machine.
 *
 * - `failed`      — a real failure. Surface an error message.
 * - `interrupted` — the turn was cut short by something the user did not ask
 *                   for (the app went to background). Nothing is broken, but
 *                   the thread is stranded: surface it so the UI can offer a
 *                   retry. Never auto-resend.
 * - `silent`      — the turn was aborted on purpose (`abort()`, `reset()`, or a
 *                   superseding `sendMessage`). The caller already knows;
 *                   surfacing anything here would be noise.
 */
export type TurnFailureKind = "failed" | "interrupted" | "silent";

/**
 * The predicate the thread has always used to spot a cancellation: an `Error`
 * whose `name` is `"AbortError"` (the DOM-standard shape every adapter rejects
 * with, see `llm/abort-error.ts`).
 */
export const isAbortError = (err: unknown): boolean =>
  err instanceof Error && err.name === "AbortError";

/**
 * Classify the rejection of a turn.
 *
 * `abortedByBackground` is the caller's record of WHY the in-flight request was
 * aborted, because the error itself cannot carry that: an abort triggered by
 * backgrounding the app and an abort triggered by `abort()` reject with the
 * exact same `AbortError`.
 */
export const classifyTurnFailure = (
  err: unknown,
  abortedByBackground: boolean
): TurnFailureKind => {
  if (!isAbortError(err)) return "failed";
  return abortedByBackground ? "interrupted" : "silent";
};
