import { z } from "zod";

/**
 * Loose Zod schema for a nested component reference inside another component's
 * props. Each node carries a `component` name (looked up in the registry) and a
 * loose `props` bag; per-component prop schemas validate the real shape during
 * the recursive walk in `validateLLMResponse`.
 *
 * Container components opt into composition by declaring a field of type
 * `z.array(NodeRefSchema)` in their `propsSchema`.
 *
 * No explicit `z.ZodType<...>` annotation here — Zod's inferred type carries
 * the correct shape, and avoiding the annotation keeps this importable from
 * apps using either Zod v3 or v4 without cross-version generic mismatch.
 */
export const NodeRefSchema = z.object({
  component: z.string().min(1),
  props: z.record(z.string(), z.unknown()).optional(),
});

export type NodeRef = { component: string; props?: Record<string, unknown> };

/** Heuristic: is this value an array of NodeRef-shaped objects? */
export const isNodeRefArray = (value: unknown): value is NodeRef[] => {
  if (!Array.isArray(value) || value.length === 0) return false;
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const c = (item as { component?: unknown }).component;
    if (typeof c !== "string" || c.length === 0) return false;
  }
  return true;
};
