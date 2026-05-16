/**
 * buildAgentCard — serializes a wireai-rn component registry into an A2A-compatible
 * client capability card (ClientCard / AgentCard).
 *
 * Mobile apps cannot serve HTTP, so this card is NOT self-hosted by the app.
 * Intended uses:
 *   1. Sent as metadata in the first A2A message to bootstrap the agent's knowledge
 *      of which UI components the client can render
 *   2. Served from a companion BFF (Backend-for-Frontend)
 *   3. Provided to the agent developer during configuration / prompt engineering
 *
 * The extension URI "https://wireai.dev/extensions/components/v1" declares
 * the wireai-rn component catalog as an A2A extension.
 *
 * @example
 * ```ts
 * import { createComponentRegistry } from "wireai-rn";
 * import { defaultComponents } from "wireai-rn/components";
 * import { buildAgentCard } from "wireai-rn";
 *
 * const registry = createComponentRegistry([...defaultComponents, MoodTracker]);
 * const card = buildAgentCard(registry, {
 *   name: "Mental Coach Mobile Client",
 *   url: "https://your-bff.example.com/a2a/client",
 * });
 * // card.extensions[0].params.components → all registered components with schemas
 * ```
 */
import type { ComponentRegistry } from "../registry/component-registry";

export type AgentCardInfo = {
  name: string;
  url: string;
  version?: string;
  description?: string;
};

type FieldSchema = {
  type: "string" | "number" | "boolean" | "array" | "object" | "unknown";
  description?: string;
};

const WIREAI_EXTENSION_URI = "https://wireai.dev/extensions/components/v1";

/**
 * Converts a Zod field schema to a minimal JSON Schema type descriptor.
 * Uses the same ._def.typeName introspection already used in system-prompt.builder.ts.
 */
function zodFieldToSchema(field: unknown): FieldSchema {
  const f = field as {
    _def?: { typeName?: string; innerType?: unknown };
    description?: string;
  };
  const description = f.description;
  const typeName = f._def?.typeName ?? "";

  // Unwrap ZodOptional / ZodNullable
  if (typeName === "ZodOptional" || typeName === "ZodNullable") {
    const inner = zodFieldToSchema(f._def?.innerType);
    return description ? { ...inner, description } : inner;
  }

  let type: FieldSchema["type"] = "unknown";
  if (typeName.includes("String") || typeName === "ZodEnum" || typeName === "ZodLiteral") {
    type = "string";
  } else if (typeName.includes("Number") || typeName.includes("BigInt")) {
    type = "number";
  } else if (typeName.includes("Boolean")) {
    type = "boolean";
  } else if (typeName.includes("Array")) {
    type = "array";
  } else if (typeName.includes("Object")) {
    type = "object";
  }

  return description ? { type, description } : { type };
}

export const buildAgentCard = (registry: ComponentRegistry, info: AgentCardInfo) => {
  const components = Array.from(registry.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, def]) => {
      const shape =
        (def.propsSchema as { shape?: Record<string, unknown> }).shape ?? {};

      const properties: Record<string, FieldSchema> = {};
      for (const [key, field] of Object.entries(shape)) {
        properties[key] = zodFieldToSchema(field);
      }

      return {
        name,
        description: def.description,
        propsSchema: { type: "object" as const, properties },
      };
    });

  return {
    name: info.name,
    url: info.url,
    version: info.version ?? "1.0.0",
    description: info.description ?? `WireAI-RN client: ${info.name}`,
    capabilities: {
      streaming: false as const,
      pushNotifications: false as const,
    },
    supportedInputModes: ["text"] as const,
    supportedOutputModes: ["text", "data"] as const,
    extensions: [
      {
        uri: WIREAI_EXTENSION_URI,
        required: false as const,
        params: { components },
      },
    ],
  };
};
