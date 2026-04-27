import type { z } from "zod";
import type { WireAIComponent } from "../types";

export type RegistryEntry = WireAIComponent<z.ZodObject<z.ZodRawShape>>;
export type ComponentRegistry = Map<string, RegistryEntry>;

export const createComponentRegistry = (
  components: WireAIComponent<z.ZodObject<z.ZodRawShape>>[]
): ComponentRegistry => {
  const registry = new Map<string, RegistryEntry>();
  for (const comp of components) {
    registry.set(comp.name, comp);
  }
  return registry;
};
