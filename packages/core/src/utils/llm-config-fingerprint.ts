import type { LocalLLMConfig } from "../types";

/**
 * Every field of `LocalLLMConfig`, in a fixed order. The list is exhaustive on
 * purpose: adapters capture their WHOLE config at construction
 * (see `llm-factory.ts`), so a field left out here would become a field a
 * consumer can change with no effect at runtime.
 *
 * Typing it as `Record<keyof LocalLLMConfig, true>` makes that exhaustiveness a
 * compile error rather than a code-review promise — add a field to the type and
 * this file stops building until the field is fingerprinted.
 */
const FIELD_PRESENCE: Record<keyof LocalLLMConfig, true> = {
  provider: true,
  baseUrl: true,
  model: true,
  apiKey: true,
  temperature: true,
  maxTokens: true,
  timeoutMs: true,
  metadata: true,
};

const FIELDS = Object.keys(FIELD_PRESENCE) as (keyof LocalLLMConfig)[];

/** NUL can never appear unescaped inside JSON output, so it cannot collide. */
const SEPARATOR = "\u0000";

/** Counter for the non-serializable fallback — see `llmConfigFingerprint`. */
let unserializableCounter = 0;

/**
 * `JSON.stringify` replacer that rewrites every plain object with its keys in
 * sorted order, so `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` serialize identically.
 */
const sortKeys = (_key: string, value: unknown): unknown => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  const source = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    sorted[key] = source[key];
  }
  return sorted;
};

/**
 * A stable string identity for an LLM config's CONTENTS.
 *
 * Consumers commonly write `<WireAIProvider llm={{ provider: "a2a", ... }}>`
 * inline, which hands React a brand-new object on every render. Keying adapter
 * creation on object identity therefore rebuilds the adapter every render and
 * throws away its per-session state (the A2A `contextId` above all), so the
 * agent loses the conversation. Keying on this fingerprint instead rebuilds the
 * adapter when the config genuinely changes, and only then.
 *
 * Two configs with equal contents produce an equal fingerprint; a change to any
 * field produces a different one.
 *
 * If a field cannot be serialized (a circular `metadata`, a BigInt, ...) the
 * fingerprint degrades to a value that differs on every call, which reproduces
 * today's recreate-every-render behaviour. That direction is deliberate:
 * failing toward a redundant rebuild is cheap, failing toward a silently pinned
 * stale adapter is not.
 */
export const llmConfigFingerprint = (config: LocalLLMConfig): string => {
  try {
    return FIELDS.map((field) => JSON.stringify(config[field], sortKeys) ?? "undefined").join(
      SEPARATOR
    );
  } catch {
    unserializableCounter += 1;
    return `unserializable:${unserializableCounter}`;
  }
};
