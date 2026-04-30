import { trimToContextBudget } from "../context-budget";
import type { Message } from "../../types";

const makeMsg = (id: string, role: "user" | "assistant", content: string): Message => ({
  id,
  role,
  content,
  timestamp: Date.now(),
});

describe("trimToContextBudget", () => {
  it("returns all messages when under both limits", () => {
    const msgs = [makeMsg("1", "user", "hi"), makeMsg("2", "assistant", "hello")];
    expect(trimToContextBudget(msgs, 20, 9999)).toHaveLength(2);
  });

  it("trims to maxMessages keeping the most recent", () => {
    const msgs = Array.from({ length: 25 }, (_, i) => makeMsg(`${i}`, "user", "x"));
    const result = trimToContextBudget(msgs, 20, 9999);
    expect(result).toHaveLength(20);
    expect(result[0]!.id).toBe("5"); // first 5 dropped
  });

  it("trims by char budget keeping the most recent", () => {
    const msgs = Array.from({ length: 5 }, (_, i) => makeMsg(`${i}`, "user", "x".repeat(500)));
    const result = trimToContextBudget(msgs, 20, 1000);
    expect(result.reduce((s, m) => s + m.content.length, 0)).toBeLessThanOrEqual(1000);
    expect(result).toHaveLength(2); // last two (500 + 500 = 1000)
  });

  it("never drops the last message even when it exceeds maxChars", () => {
    const msgs = [makeMsg("1", "user", "x".repeat(50000))];
    expect(trimToContextBudget(msgs, 20, 1000)).toHaveLength(1);
  });

  it("does NOT treat index 0 as a system message", () => {
    // FIX-A1 regression guard
    const msgs = [
      makeMsg("1", "user", "first"),
      makeMsg("2", "user", "second"),
      makeMsg("3", "user", "third"),
    ];
    const result = trimToContextBudget(msgs, 2, 9999);
    expect(result.map((m) => m.id)).toEqual(["2", "3"]);
    // Before the fix, result[0] would be "1" (the falsely-kept "system" message)
  });
});
