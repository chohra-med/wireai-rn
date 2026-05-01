import type { WireAIComponent } from "../types";

export type RegistryEntry = WireAIComponent;
export type ComponentRegistry = Map<string, RegistryEntry>;

export const createComponentRegistry = (
  components: WireAIComponent[]
): ComponentRegistry => {
  const registry = new Map<string, RegistryEntry>();
  for (const comp of components) {
    registry.set(comp.name, comp);
  }
  return registry;
};
