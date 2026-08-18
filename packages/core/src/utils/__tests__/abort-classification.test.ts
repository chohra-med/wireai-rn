import { classifyTurnFailure, isAbortError } from "../abort-classification";
import { createAbortError } from "../../llm/abort-error";

// The real error shape the adapters reject with, not a hand-rolled lookalike.
const abortError = () => createAbortError();

describe("isAbortError", () => {
  it("recognises the error the adapters actually throw", () => {
    expect(isAbortError(abortError())).toBe(true);
  });

  it("rejects a plain Error, a string and null", () => {
    expect(isAbortError(new Error("network down"))).toBe(false);
    expect(isAbortError("AbortError")).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });

  it("rejects a non-Error object that merely claims the name", () => {
    expect(isAbortError({ name: "AbortError", message: "nope" })).toBe(false);
  });
});

describe("classifyTurnFailure", () => {
  it("calls a background abort an interruption", () => {
    expect(classifyTurnFailure(abortError(), true)).toBe("interrupted");
  });

  it("keeps an intentional abort silent", () => {
    expect(classifyTurnFailure(abortError(), false)).toBe("silent");
  });

  it("calls a real error a failure, whichever way the abort flag points", () => {
    expect(classifyTurnFailure(new Error("500"), false)).toBe("failed");
    expect(classifyTurnFailure(new Error("500"), true)).toBe("failed");
  });

  it("calls a non-Error rejection a failure", () => {
    expect(classifyTurnFailure("boom", true)).toBe("failed");
    expect(classifyTurnFailure(undefined, true)).toBe("failed");
  });

  it("never reports interrupted for anything but an abort", () => {
    const notAborts: unknown[] = [new Error("x"), { name: "AbortError" }, "AbortError", 0];
    for (const err of notAborts) {
      expect(classifyTurnFailure(err, true)).toBe("failed");
    }
  });
});
