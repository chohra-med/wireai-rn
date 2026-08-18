import { LocalLLMConfigSchema, parseStoredLLMConfig } from "../llm-config.schema";
import type { LocalLLMConfig } from "../../types";

const valid: LocalLLMConfig = {
  provider: "ollama",
  baseUrl: "http://localhost:11434",
  model: "llama3",
};

const fallback: LocalLLMConfig = {
  provider: "a2a",
  baseUrl: "https://agent.example.com",
  model: "wire-agent",
};

describe("LocalLLMConfigSchema", () => {
  it("accepts a minimal valid config", () => {
    const result = LocalLLMConfigSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("accepts every optional field", () => {
    const result = LocalLLMConfigSchema.safeParse({
      ...valid,
      apiKey: "k",
      temperature: 0.2,
      maxTokens: 256,
      timeoutMs: 1000,
      metadata: { attribution: { provider: "branch" } },
    });
    expect(result.success).toBe(true);
  });

  it("accepts all six providers and only those", () => {
    for (const provider of ["ollama", "lmstudio", "openai", "webhook", "custom", "a2a"]) {
      expect(LocalLLMConfigSchema.safeParse({ ...valid, provider }).success).toBe(true);
    }
    expect(LocalLLMConfigSchema.safeParse({ ...valid, provider: "anthropic" }).success).toBe(false);
  });

  it("rejects an unknown provider", () => {
    expect(LocalLLMConfigSchema.safeParse({ ...valid, provider: "evil" }).success).toBe(false);
  });

  it("rejects a missing baseUrl", () => {
    const { baseUrl: _dropped, ...withoutBaseUrl } = valid;
    expect(LocalLLMConfigSchema.safeParse(withoutBaseUrl).success).toBe(false);
  });

  it("rejects a non-string baseUrl", () => {
    expect(LocalLLMConfigSchema.safeParse({ ...valid, baseUrl: 42 }).success).toBe(false);
  });

  it("rejects a missing model and a non-string model", () => {
    const { model: _dropped, ...withoutModel } = valid;
    expect(LocalLLMConfigSchema.safeParse(withoutModel).success).toBe(false);
    expect(LocalLLMConfigSchema.safeParse({ ...valid, model: null }).success).toBe(false);
  });

  it("rejects a non-object", () => {
    expect(LocalLLMConfigSchema.safeParse("not a config").success).toBe(false);
    expect(LocalLLMConfigSchema.safeParse(null).success).toBe(false);
  });

  // The schema mirrors the type and does NOT tighten past it: anything a
  // consumer may legally hand to WireAIProvider has to survive storage.
  it("does not tighten past the type (any string baseUrl is legal)", () => {
    expect(LocalLLMConfigSchema.safeParse({ ...valid, baseUrl: "not-a-url" }).success).toBe(true);
    expect(LocalLLMConfigSchema.safeParse({ ...valid, baseUrl: "" }).success).toBe(true);
  });
});

describe("parseStoredLLMConfig", () => {
  it("adopts a valid stored config", () => {
    expect(parseStoredLLMConfig(JSON.stringify(valid), fallback)).toEqual(valid);
  });

  it("round-trips a config the SDK itself wrote", () => {
    const written = JSON.stringify({ ...valid, apiKey: "k", metadata: { a: 1 } });
    const readBack = parseStoredLLMConfig(written, fallback);
    expect(readBack).toEqual(JSON.parse(written));
  });

  it("falls back when nothing is stored", () => {
    expect(parseStoredLLMConfig(null, fallback)).toBe(fallback);
    expect(parseStoredLLMConfig(undefined, fallback)).toBe(fallback);
    expect(parseStoredLLMConfig("", fallback)).toBe(fallback);
  });

  it("falls back on corrupt JSON", () => {
    expect(parseStoredLLMConfig("{not json", fallback)).toBe(fallback);
  });

  it("falls back on a hostile entry with an unknown provider", () => {
    const hostile = JSON.stringify({
      provider: "exfil",
      baseUrl: "https://attacker.example.com",
      model: "llama3",
    });
    expect(parseStoredLLMConfig(hostile, fallback)).toBe(fallback);
  });

  it("falls back when baseUrl is missing, so no apiKey can be redirected", () => {
    const partial = JSON.stringify({ provider: "openai", model: "gpt-4o", apiKey: "k" });
    expect(parseStoredLLMConfig(partial, fallback)).toBe(fallback);
  });

  it("falls back on JSON that is not an object at all", () => {
    expect(parseStoredLLMConfig('"just a string"', fallback)).toBe(fallback);
    expect(parseStoredLLMConfig("null", fallback)).toBe(fallback);
    expect(parseStoredLLMConfig("[]", fallback)).toBe(fallback);
  });
});
