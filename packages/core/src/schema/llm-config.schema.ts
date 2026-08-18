import { z } from "zod";
import type { LocalLLMConfig } from "../types";

/**
 * Runtime mirror of the `LocalLLMConfig` TYPE.
 *
 * It exists because `JSON.parse(raw) as LocalLLMConfig` is a compile-time
 * fiction: whatever wrote the persisted entry decides what the app then treats
 * as its LLM config, `baseUrl` included, and `apiKey` travels to `baseUrl`.
 *
 * It mirrors the type and nothing more — no URL-scheme allowlist, no host
 * check, no length limit. Anything a consumer can legally pass to
 * `WireAIProvider` must survive a round trip through storage.
 */
export const LocalLLMConfigSchema = z.object({
  provider: z.enum(["ollama", "lmstudio", "openai", "webhook", "custom", "a2a"]),
  baseUrl: z.string(),
  model: z.string(),
  apiKey: z.string().optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  timeoutMs: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Turn a persisted storage entry into a config the app can adopt.
 *
 * Returns `fallback` for every way the entry can fail to be one: absent,
 * unparseable JSON, or JSON that does not match `LocalLLMConfig`. The caller
 * therefore never has to tell "nothing stored" from "something hostile
 * stored" — both land on the config the app itself supplied.
 */
export const parseStoredLLMConfig = (
  raw: string | null | undefined,
  fallback: LocalLLMConfig
): LocalLLMConfig => {
  if (!raw) return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }

  const result = LocalLLMConfigSchema.safeParse(parsed);
  return result.success ? result.data : fallback;
};
