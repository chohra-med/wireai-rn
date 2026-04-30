import { extractJson } from "../extract-json";

describe("extractJson", () => {
  it("returns raw JSON unchanged", () => {
    const input = '{"action":"ask","message":"hi"}';
    expect(extractJson(input)).toBe(input);
  });

  it("strips markdown fences (json-tagged)", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("strips markdown fences (untagged)", () => {
    expect(extractJson('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("strips surrounding prose", () => {
    expect(extractJson('Here you go: {"a":1} — enjoy!')).toBe('{"a":1}');
  });

  it("handles nested braces correctly", () => {
    const input = '{"props":{"title":"hello","count":3}}';
    expect(extractJson(input)).toBe(input);
  });

  it("stops at first balanced closing brace — ignores trailing content", () => {
    // FIX-B4 regression guard
    expect(extractJson('{"a":1} {}')).toBe('{"a":1}');
  });

  it("handles strings containing braces", () => {
    expect(extractJson('{"message":"use {name} here"}')).toBe('{"message":"use {name} here"}');
  });

  it("handles escaped quotes in strings", () => {
    expect(extractJson('{"message":"say \\"hello\\" world"}')).toBe('{"message":"say \\"hello\\" world"}');
  });
});
