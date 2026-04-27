import type { WireAIResponse } from "../types";
import type { ComponentRegistry } from "../registry/component-registry";
import { extractJson } from "../utils/extract-json";
import { WireAIResponseSchema } from "./wireai-response.schema";

export const validateLLMResponse = (
  raw: string,
  registry?: ComponentRegistry
): WireAIResponse => {
  let jsonStr = extractJson(raw);
  // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping invalid control chars
  jsonStr = jsonStr.replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F]/g, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`LLM_PARSE_ERROR: Could not parse JSON from LLM output`);
  }

  // LLMs sometimes place component props at the top level instead of inside "props".
  // e.g. { action, component, props: {...}, ctaLabel: "..." }
  // Rescue those keys by merging them into props before schema validation.
  if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = { ...(parsed as Record<string, unknown>) };
    const knownTopLevel = new Set(["action", "component", "props", "message"]);
    const spilledProps: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      if (!knownTopLevel.has(key)) {
        spilledProps[key] = obj[key];
        delete obj[key];
      }
    }
    if (Object.keys(spilledProps).length > 0) {
      obj.props = { ...(obj.props as Record<string, unknown> ?? {}), ...spilledProps };
    }
    parsed = obj;
  }

  const result = WireAIResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`LLM_SCHEMA_ERROR: ${result.error.message}`);
  }

  const response = result.data;

  if (response.action === "render" && registry && !registry.has(response.component)) {
    throw new Error(`COMPONENT_NOT_FOUND: ${response.component}`);
  }

  return response as WireAIResponse;
};
