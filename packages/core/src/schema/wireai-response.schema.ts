import { z } from "zod";

export const WireAIRenderResponseSchema = z.object({
  action: z.literal("render"),
  component: z.string().min(1),
  props: z.record(z.string(), z.unknown()),
  message: z.string().optional(),
});

export const WireAIAskResponseSchema = z.object({
  action: z.literal("ask"),
  message: z.string().min(1),
});

export const WireAIResponseSchema = z.discriminatedUnion("action", [
  WireAIRenderResponseSchema,
  WireAIAskResponseSchema,
]);

export const WIREAI_JSON_SCHEMA = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["render", "ask"] },
    component: { type: "string" },
    props: { type: "object", additionalProperties: true },
    message: { type: "string" },
  },
  required: ["action"],
  additionalProperties: false,
} as const;
