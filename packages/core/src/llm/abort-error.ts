/**
 * The DOM-standard shape for "this request was aborted": an `Error` whose
 * `name` is `"AbortError"`.
 *
 * Callers tell a user or background cancellation apart from a real failure by
 * that name (`useWireAIThread` does exactly this), so every abort path in an
 * adapter must reject with this rather than a bare `Error`, which arrives with
 * `name === "Error"` and is reported to the user as a hard failure.
 */
export function createAbortError(message = "Aborted"): Error {
  const err = new Error(message);
  err.name = "AbortError";
  return err;
}
