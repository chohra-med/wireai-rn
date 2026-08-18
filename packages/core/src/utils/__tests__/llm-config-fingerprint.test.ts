import { llmConfigFingerprint } from "../llm-config-fingerprint";
import type { LocalLLMConfig } from "../../types";

const base: LocalLLMConfig = {
  provider: "a2a",
  baseUrl: "https://agent.example.com",
  model: "wire-agent",
  apiKey: "k-123",
  temperature: 0.4,
  maxTokens: 512,
  timeoutMs: 30_000,
  metadata: { attribution: { provider: "appsflyer", payload: { campaign: "x" } } },
};

/**
 * Every field of LocalLLMConfig with a value DIFFERENT from `base`, so each
 * case below is a real change and not a re-statement.
 *
 * COMPLETE enumeration: `Record<keyof LocalLLMConfig, ...>` makes a missing
 * field a compile error, so this map cannot silently drift from the type.
 */
const changes: Record<keyof LocalLLMConfig, LocalLLMConfig[keyof LocalLLMConfig]> = {
  provider: "ollama",
  baseUrl: "https://evil.example.com",
  model: "other-model",
  apiKey: "k-456",
  temperature: 0.9,
  maxTokens: 1024,
  timeoutMs: 60_000,
  metadata: { attribution: { provider: "appsflyer", payload: { campaign: "y" } } },
};

describe("llmConfigFingerprint", () => {
  it("gives two distinct objects with equal contents an equal fingerprint", () => {
    const a: LocalLLMConfig = { ...base, metadata: { ...base.metadata } };
    const b: LocalLLMConfig = { ...base, metadata: { ...base.metadata } };
    expect(a).not.toBe(b);
    expect(llmConfigFingerprint(a)).toBe(llmConfigFingerprint(b));
  });

  it("is stable across repeated calls on the same object", () => {
    expect(llmConfigFingerprint(base)).toBe(llmConfigFingerprint(base));
  });

  // Enumerates ALL 8 fields of LocalLLMConfig. Each case mutates a COPY of the
  // base config and compares two fingerprints the function itself produced —
  // no expected string is ever handed to the assertion.
  describe.each(Object.keys(changes) as (keyof LocalLLMConfig)[])(
    "field %s",
    (field) => {
      it("changes the fingerprint when it changes", () => {
        const changed = { ...base, [field]: changes[field] } as LocalLLMConfig;
        expect(changed[field]).not.toEqual(base[field]);
        expect(llmConfigFingerprint(changed)).not.toBe(llmConfigFingerprint(base));
      });
    }
  );

  it("changes the fingerprint when an optional field is removed", () => {
    const withoutApiKey: LocalLLMConfig = { ...base };
    delete withoutApiKey.apiKey;
    expect(llmConfigFingerprint(withoutApiKey)).not.toBe(llmConfigFingerprint(base));
  });

  it("changes the fingerprint when a NESTED metadata value changes", () => {
    const changed: LocalLLMConfig = {
      ...base,
      metadata: { attribution: { provider: "branch", payload: { campaign: "x" } } },
    };
    expect(llmConfigFingerprint(changed)).not.toBe(llmConfigFingerprint(base));
  });

  it("ignores metadata key order", () => {
    const oneOrder: LocalLLMConfig = { ...base, metadata: { a: 1, b: 2, c: { d: 3, e: 4 } } };
    const otherOrder: LocalLLMConfig = { ...base, metadata: { c: { e: 4, d: 3 }, b: 2, a: 1 } };
    expect(Object.keys(oneOrder.metadata!)).not.toEqual(Object.keys(otherOrder.metadata!));
    expect(llmConfigFingerprint(oneOrder)).toBe(llmConfigFingerprint(otherOrder));
  });

  it("preserves metadata ARRAY order (an array is not a key bag)", () => {
    const one: LocalLLMConfig = { ...base, metadata: { tags: ["a", "b"] } };
    const other: LocalLLMConfig = { ...base, metadata: { tags: ["b", "a"] } };
    expect(llmConfigFingerprint(one)).not.toBe(llmConfigFingerprint(other));
  });

  it("does not throw on circular metadata, and forces recreation instead", () => {
    const circular: Record<string, unknown> = { name: "loop" };
    circular.self = circular;
    const config: LocalLLMConfig = { ...base, metadata: circular };

    let first = "";
    let second = "";
    expect(() => {
      first = llmConfigFingerprint(config);
      second = llmConfigFingerprint(config);
    }).not.toThrow();

    // Degrades to today's behaviour (a new adapter every render) rather than
    // silently pinning a stale one.
    expect(first).not.toBe(second);
  });

  it("does not throw on non-serializable metadata values (BigInt)", () => {
    const config: LocalLLMConfig = { ...base, metadata: { big: BigInt(1) } };
    expect(() => llmConfigFingerprint(config)).not.toThrow();
  });
});
