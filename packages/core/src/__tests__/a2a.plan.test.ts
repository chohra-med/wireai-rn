import { A2AAdapter, extractOnboardingPlan } from "../llm/a2a.adapter";
import type { A2ATask, LocalLLMConfig } from "../types";

// The transport contract this file pins: the Wire AI onboarding backend appends the
// structured plan as a SECOND DataPart on a completed task
// (`app/a2a.py::build_task` → `{"data": {"kind": "onboarding_plan", "plan": plan}}`).
// `_extractContent` returns the FIRST DataPart and drops the rest, so the plan needs
// its own read — without changing a single byte of what `chat()` returns.

const config: LocalLLMConfig = {
  provider: "a2a",
  baseUrl: "https://agent.example.com/a2a",
  model: "test-agent",
  timeoutMs: 5000,
};

/** The render envelope the device actually draws — always the first DataPart. */
const ENVELOPE = {
  action: "render",
  component: "StatusCard",
  props: { status: "success", title: "you're all set" },
};

/** A plan in the shape the server really emits (app/plan.py::Plan). */
const PLAN = {
  summary: "Two areas, three starter wins.",
  items: [
    { title: "Morning walk", description: "Ten minutes before work", category: "physical" },
    { title: "Read a page", description: "Any book", category: "learning" },
  ],
  next_action_label: "Get started",
  next_action: "start",
  showcase: [],
  coachmarks: [],
};

function completedTask(parts: { data?: unknown; text?: string }[]): A2ATask {
  return {
    id: "task-1",
    contextId: "ctx-1",
    status: { state: "COMPLETED" },
    messages: [
      { role: "user", parts: [{ text: "hi" }] },
      { role: "agent", parts },
    ],
  } as unknown as A2ATask;
}

function mockFetchTask(task: A2ATask) {
  const body = { jsonrpc: "2.0", id: 1, result: task };
  (global as unknown as { fetch: unknown }).fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    })
  );
}

describe("extractOnboardingPlan", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns the plan from the second DataPart of a completed task", () => {
    const task = completedTask([
      { data: ENVELOPE },
      { data: { kind: "onboarding_plan", plan: PLAN } },
    ]);
    expect(extractOnboardingPlan(task)).toEqual(PLAN);
  });

  it("returns undefined when the task carries no plan part", () => {
    expect(extractOnboardingPlan(completedTask([{ data: ENVELOPE }]))).toBeUndefined();
  });

  it("returns undefined for a DataPart with an unknown kind", () => {
    const task = completedTask([
      { data: ENVELOPE },
      { data: { kind: "something_else", plan: PLAN } },
    ]);
    expect(extractOnboardingPlan(task)).toBeUndefined();
  });

  it("returns undefined when the plan part has the right kind but no plan key", () => {
    const task = completedTask([{ data: ENVELOPE }, { data: { kind: "onboarding_plan" } }]);
    expect(extractOnboardingPlan(task)).toBeUndefined();
  });

  it("carries a plan of any shape — the SDK transports it, the host validates it", () => {
    const task = completedTask([
      { data: ENVELOPE },
      { data: { kind: "onboarding_plan", plan: "not-an-object" } },
    ]);
    expect(extractOnboardingPlan(task)).toBe("not-an-object");
  });

  it("reads a plan carried on an artifact", () => {
    const task = {
      id: "task-1",
      contextId: "ctx-1",
      status: { state: "COMPLETED" },
      messages: [{ role: "agent", parts: [{ data: ENVELOPE }] }],
      artifacts: [{ parts: [{ data: { kind: "onboarding_plan", plan: PLAN } }] }],
    } as unknown as A2ATask;
    expect(extractOnboardingPlan(task)).toEqual(PLAN);
  });
});

describe("A2AAdapter.readLastPlan", () => {
  afterEach(() => jest.clearAllMocks());

  it("exposes the plan after a chat() that carried one, without changing chat()'s return", async () => {
    mockFetchTask(
      completedTask([{ data: ENVELOPE }, { data: { kind: "onboarding_plan", plan: PLAN } }])
    );
    const adapter = new A2AAdapter(config);
    const content = await adapter.chat([{ role: "user", content: "hi" }]);
    // The card the device renders is still the FIRST DataPart, byte for byte.
    expect(JSON.parse(content)).toEqual(ENVELOPE);
    expect(adapter.readLastPlan()).toEqual(PLAN);
  });

  it("is undefined before any chat()", () => {
    expect(new A2AAdapter(config).readLastPlan()).toBeUndefined();
  });

  it("is undefined after a chat() whose task carried no plan", async () => {
    mockFetchTask(completedTask([{ data: ENVELOPE }]));
    const adapter = new A2AAdapter(config);
    await adapter.chat([{ role: "user", content: "hi" }]);
    expect(adapter.readLastPlan()).toBeUndefined();
  });

  it("does not leak the previous turn's plan into a later planless turn", async () => {
    const adapter = new A2AAdapter(config);
    mockFetchTask(
      completedTask([{ data: ENVELOPE }, { data: { kind: "onboarding_plan", plan: PLAN } }])
    );
    await adapter.chat([{ role: "user", content: "hi" }]);
    expect(adapter.readLastPlan()).toEqual(PLAN);

    mockFetchTask(completedTask([{ data: ENVELOPE }]));
    await adapter.chat([{ role: "user", content: "next" }]);
    expect(adapter.readLastPlan()).toBeUndefined();
  });

  it("does not leave the previous turn's plan readable after a failed turn", async () => {
    const adapter = new A2AAdapter(config);
    mockFetchTask(
      completedTask([{ data: ENVELOPE }, { data: { kind: "onboarding_plan", plan: PLAN } }])
    );
    await adapter.chat([{ role: "user", content: "hi" }]);
    expect(adapter.readLastPlan()).toEqual(PLAN);

    (global as unknown as { fetch: unknown }).fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve("boom") })
    );
    await expect(adapter.chat([{ role: "user", content: "next" }])).rejects.toThrow();
    expect(adapter.readLastPlan()).toBeUndefined();
  });

  it("is cleared by resetContext()", async () => {
    mockFetchTask(
      completedTask([{ data: ENVELOPE }, { data: { kind: "onboarding_plan", plan: PLAN } }])
    );
    const adapter = new A2AAdapter(config);
    await adapter.chat([{ role: "user", content: "hi" }]);
    adapter.resetContext();
    expect(adapter.readLastPlan()).toBeUndefined();
  });
});
