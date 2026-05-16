import { buildAgentCard } from "../schema/agent-card.builder";
import { z } from "zod";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const info = {
  name: "Test Client",
  url: "https://bff.example.com/a2a/client",
};

// biome-ignore lint/suspicious/noExplicitAny: test registry uses any for component
function makeRegistry(entries: [string, { description: string; schema: z.ZodTypeAny }][]) {
  return new Map(
    entries.map(([name, { description, schema }]) => [
      name,
      // biome-ignore lint/suspicious/noExplicitAny: test stub
      { name, description, propsSchema: schema, component: () => null as any },
    ])
  );
}

const singleCompRegistry = makeRegistry([
  [
    "ActionCard",
    {
      description: "Offer 1–3 next-step options",
      schema: z.object({
        title: z.string().describe("Card heading"),
        body: z.string().optional().describe("Card description"),
        primaryLabel: z.string().describe("Primary button label"),
      }),
    },
  ],
]);

const multiCompRegistry = makeRegistry([
  ["ZComp", { description: "Z desc", schema: z.object({ z: z.string() }) }],
  ["AComp", { description: "A desc", schema: z.object({ a: z.number() }) }],
  ["MComp", { description: "M desc", schema: z.object({ m: z.boolean() }) }],
]);

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("buildAgentCard", () => {
  // ── Shape & identity ────────────────────────────────────────────────────────

  it("returns correct top-level fields", () => {
    const card = buildAgentCard(singleCompRegistry, info);
    expect(card.name).toBe("Test Client");
    expect(card.url).toBe("https://bff.example.com/a2a/client");
    expect(card.version).toBe("1.0.0");
    expect(card.capabilities.streaming).toBe(false);
    expect(card.capabilities.pushNotifications).toBe(false);
    expect(card.supportedInputModes).toEqual(["text"]);
    expect(card.supportedOutputModes).toEqual(["text", "data"]);
  });

  it("uses provided version and description when given", () => {
    const card = buildAgentCard(singleCompRegistry, {
      ...info,
      version: "2.1.0",
      description: "My custom description",
    });
    expect(card.version).toBe("2.1.0");
    expect(card.description).toBe("My custom description");
  });

  it("generates default description from name when not provided", () => {
    const card = buildAgentCard(singleCompRegistry, info);
    expect(card.description).toContain("Test Client");
  });

  // ── Extension ────────────────────────────────────────────────────────────────

  it("includes exactly one extension with the wireai URI", () => {
    const card = buildAgentCard(singleCompRegistry, info);
    expect(card.extensions).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(card.extensions[0]!.uri).toBe("https://wireai.dev/extensions/components/v1");
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(card.extensions[0]!.required).toBe(false);
  });

  it("extension params contains components array", () => {
    const card = buildAgentCard(singleCompRegistry, info);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { components } = card.extensions[0]!.params;
    expect(Array.isArray(components)).toBe(true);
    expect(components).toHaveLength(1);
  });

  // ── Component serialization ─────────────────────────────────────────────────

  it("serializes component name and description", () => {
    const card = buildAgentCard(singleCompRegistry, info);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const comp = card.extensions[0]!.params.components[0]!;
    expect(comp.name).toBe("ActionCard");
    expect(comp.description).toBe("Offer 1–3 next-step options");
  });

  it("serializes string prop type with description", () => {
    const card = buildAgentCard(singleCompRegistry, info);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const props = card.extensions[0]!.params.components[0]!.propsSchema.properties;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(props["title"]!.type).toBe("string");
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(props["title"]!.description).toBe("Card heading");
  });

  it("serializes optional string prop", () => {
    const card = buildAgentCard(singleCompRegistry, info);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const props = card.extensions[0]!.params.components[0]!.propsSchema.properties;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(props["body"]!.type).toBe("string");
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(props["body"]!.description).toBe("Card description");
  });

  it("serializes number prop type", () => {
    const registry = makeRegistry([
      ["NumComp", { description: "num", schema: z.object({ count: z.number().describe("A count") }) }],
    ]);
    const card = buildAgentCard(registry, info);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const props = card.extensions[0]!.params.components[0]!.propsSchema.properties;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(props["count"]!.type).toBe("number");
  });

  it("serializes boolean prop type", () => {
    const registry = makeRegistry([
      ["BoolComp", { description: "bool", schema: z.object({ enabled: z.boolean().describe("Toggle") }) }],
    ]);
    const card = buildAgentCard(registry, info);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const props = card.extensions[0]!.params.components[0]!.propsSchema.properties;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(props["enabled"]!.type).toBe("boolean");
  });

  it("serializes array prop type", () => {
    const registry = makeRegistry([
      ["ArrComp", { description: "arr", schema: z.object({ items: z.array(z.string()).describe("Items list") }) }],
    ]);
    const card = buildAgentCard(registry, info);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const props = card.extensions[0]!.params.components[0]!.propsSchema.properties;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(props["items"]!.type).toBe("array");
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(props["items"]!.description).toBe("Items list");
  });

  it("omits description field when prop has none", () => {
    const registry = makeRegistry([
      ["NoDescComp", { description: "no desc", schema: z.object({ val: z.string() }) }],
    ]);
    const card = buildAgentCard(registry, info);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const props = card.extensions[0]!.params.components[0]!.propsSchema.properties;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(props["val"]!.type).toBe("string");
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(props["val"]!.description).toBeUndefined();
  });

  it("propsSchema root has type 'object'", () => {
    const card = buildAgentCard(singleCompRegistry, info);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(card.extensions[0]!.params.components[0]!.propsSchema.type).toBe("object");
  });

  // ── Sorting ──────────────────────────────────────────────────────────────────

  it("sorts components alphabetically regardless of insertion order", () => {
    const card = buildAgentCard(multiCompRegistry, info);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const names = card.extensions[0]!.params.components.map((c) => c.name);
    expect(names).toEqual(["AComp", "MComp", "ZComp"]);
  });

  // ── Empty registry ────────────────────────────────────────────────────────────

  it("handles empty registry gracefully", () => {
    const card = buildAgentCard(new Map(), info);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(card.extensions[0]!.params.components).toEqual([]);
  });

  // ── Multiple components ───────────────────────────────────────────────────────

  it("serializes multiple components correctly", () => {
    const card = buildAgentCard(multiCompRegistry, info);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(card.extensions[0]!.params.components).toHaveLength(3);
  });
});
