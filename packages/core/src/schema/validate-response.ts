import type { WireAIResponse } from "../types";
import type { ComponentRegistry } from "../registry/component-registry";
import { extractJson } from "../utils/extract-json";
import { isNodeRefArray } from "./node-ref.schema";
import { WireAIResponseSchema } from "./wireai-response.schema";

/** Per-node nesting cap. Mirrors the renderer guard so errors surface uniformly. */
export const MAX_NODE_DEPTH = 8;

const validateNode = (
  node: { component?: unknown; props?: unknown },
  registry: ComponentRegistry,
  path: string,
  depth: number
): void => {
  if (depth > MAX_NODE_DEPTH) {
    throw new Error(
      `LLM_SCHEMA_ERROR: at ${path}: nesting depth exceeds ${MAX_NODE_DEPTH}`
    );
  }

  const name = node.component;
  if (typeof name !== "string" || !name) {
    throw new Error(`LLM_SCHEMA_ERROR: at ${path}: missing "component" name`);
  }

  const def = registry.get(name);
  if (!def) {
    throw new Error(`COMPONENT_NOT_FOUND: at ${path}: ${name}`);
  }

  const rawProps = (node.props ?? {}) as Record<string, unknown>;
  const parsed = def.propsSchema.safeParse(rawProps);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("; ");
    throw new Error(`LLM_SCHEMA_ERROR: at ${path}(${name}): ${issues}`);
  }

  for (const [key, value] of Object.entries(rawProps)) {
    if (isNodeRefArray(value)) {
      value.forEach((child, i) => {
        validateNode(child, registry, `${path}(${name}).${key}[${i}]`, depth + 1);
      });
    }
  }
};

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

  if (response.action === "render") {
    if (registry) {
      validateNode(response, registry, "root", 0);
    } else if (!response.component) {
      throw new Error(`COMPONENT_NOT_FOUND: missing component name`);
    }
  }

  return response as WireAIResponse;
};
