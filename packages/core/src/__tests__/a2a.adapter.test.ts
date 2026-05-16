import { A2AAdapter } from "../llm/a2a.adapter";
import type { LocalLLMConfig } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const config: LocalLLMConfig = {
  provider: "a2a",
  baseUrl: "https://agent.example.com/a2a",
  model: "test-agent",
  timeoutMs: 5000,
};

const configWithKey: LocalLLMConfig = { ...config, apiKey: "sk-test" };

// Typed handle for inspecting jest.fn() calls on global.fetch
const gFetch = () => (global as unknown as { fetch: jest.Mock }).fetch;

/** Build a completed A2A task with a TextPart agent response */
function makeTextTask(text: string, contextId = "ctx-1"): object {
  return {
    jsonrpc: "2.0",
    id: 1,
    result: {
      id: "task-1",
      contextId,
      status: { state: "COMPLETED" },
      messages: [
        { role: "user", parts: [{ text: "hi" }] },
        { role: "agent", parts: [{ text }] },
      ],
    },
  };
}

/** Build a completed A2A task with a DataPart agent response */
function makeDataTask(data: object, contextId = "ctx-1"): object {
  return {
    jsonrpc: "2.0",
    id: 1,
    result: {
      id: "task-1",
      contextId,
      status: { state: "COMPLETED" },
      messages: [
        { role: "user", parts: [{ text: "hi" }] },
        { role: "agent", parts: [{ data, mimeType: "application/json" }] },
      ],
    },
  };
}

/** Build a task in WORKING state */
function makeWorkingTask(taskId = "task-1"): object {
  return {
    jsonrpc: "2.0",
    id: 1,
    result: {
      id: taskId,
      contextId: "ctx-1",
      status: { state: "WORKING" },
      messages: [],
    },
  };
}

/** Build a tasks/get response with a given state */
function makePollTask(state: string, text?: string): object {
  return {
    jsonrpc: "2.0",
    id: 2,
    result: {
      id: "task-1",
      contextId: "ctx-1",
      status: { state },
      messages: text ? [{ role: "agent", parts: [{ text }] }] : [],
    },
  };
}

/** Parsed body helper */
function callBody(callIndex = 0): Record<string, unknown> {
  const call = gFetch().mock.calls[callIndex] as [string, { body: string }];
  return JSON.parse(call[1].body) as Record<string, unknown>;
}

/** Parsed headers helper */
function callHeaders(callIndex = 0): Record<string, string> {
  const call = gFetch().mock.calls[callIndex] as [string, { headers: Record<string, string> }];
  return call[1].headers;
}

function mockFetch(...responses: object[]) {
  let call = 0;
  (global as unknown as { fetch: unknown }).fetch = jest.fn(() => {
    const body = responses[Math.min(call++, responses.length - 1)];
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  });
}

function mockFetchError(msg: string) {
  (global as unknown as { fetch: unknown }).fetch = jest.fn(() =>
    Promise.reject(new Error(msg))
  );
}

function mockFetchHttpError(status: number) {
  (global as unknown as { fetch: unknown }).fetch = jest.fn(() =>
    Promise.resolve({
      ok: false,
      status,
      text: () => Promise.resolve(`HTTP ${status}`),
    })
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("A2AAdapter", () => {
  afterEach(() => jest.clearAllMocks());

  // ── Construction ────────────────────────────────────────────────────────────

  it("constructs without error", () => {
    expect(new A2AAdapter(config)).toBeDefined();
  });

  it("strips trailing slash from baseUrl", () => {
    const a = new A2AAdapter({ ...config, baseUrl: "https://agent.example.com/a2a/" });
    expect(a).toBeDefined();
  });

  // ── System message filtering ─────────────────────────────────────────────────

  it("filters out system messages before sending", async () => {
    mockFetch(makeTextTask('{"action":"ask","message":"hi"}'));
    const adapter = new A2AAdapter(config);
    await adapter.chat([
      { role: "system", content: "You are a coach." },
      { role: "user", content: "Hello" },
    ]);
    const body = callBody();
    const params = body.params as { message: { role: string; parts: { text: string }[] } };
    expect(params.message.role).toBe("user");
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(params.message.parts[0]!.text).toBe("Hello");
  });

  it("throws when all messages are system messages", async () => {
    const adapter = new A2AAdapter(config);
    await expect(
      adapter.chat([{ role: "system", content: "system only" }])
    ).rejects.toThrow("no non-system messages");
  });

  // ── Role mapping ─────────────────────────────────────────────────────────────

  it("sends only the latest user message per turn", async () => {
    mockFetch(makeTextTask('{"action":"ask","message":"ok"}'));
    const adapter = new A2AAdapter(config);
    await adapter.chat([
      { role: "user", content: "turn 1" },
      { role: "assistant", content: "turn 1 response" },
      { role: "user", content: "turn 2" },
    ]);
    const body = callBody();
    const params = body.params as { message: { role: string; parts: { text: string }[] } };
    expect(params.message.role).toBe("user");
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(params.message.parts[0]!.text).toBe("turn 2");
  });

  // ── TextPart response ────────────────────────────────────────────────────────

  it("returns text from TextPart", async () => {
    const wireaiJson = '{"action":"ask","message":"How do you feel?"}';
    mockFetch(makeTextTask(wireaiJson));
    const adapter = new A2AAdapter(config);
    const result = await adapter.chat([{ role: "user", content: "hi" }]);
    expect(result).toBe(wireaiJson);
  });

  // ── DataPart response ────────────────────────────────────────────────────────

  it("returns JSON string from DataPart", async () => {
    const data = { action: "render", component: "ActionCard", props: { title: "Test" } };
    mockFetch(makeDataTask(data));
    const adapter = new A2AAdapter(config);
    const result = await adapter.chat([{ role: "user", content: "hi" }]);
    expect(JSON.parse(result)).toEqual(data);
  });

  it("prefers DataPart over TextPart when both present", async () => {
    const data = { action: "render", component: "StatusCard", props: { status: "success", title: "Done" } };
    mockFetch({
      jsonrpc: "2.0",
      id: 1,
      result: {
        id: "task-1",
        contextId: "ctx-1",
        status: { state: "COMPLETED" },
        messages: [{
          role: "agent",
          parts: [
            { text: "some plain text" },
            { data, mimeType: "application/json" },
          ],
        }],
      },
    });
    const adapter = new A2AAdapter(config);
    const result = await adapter.chat([{ role: "user", content: "hi" }]);
    expect(JSON.parse(result)).toEqual(data);
  });

  // ── contextId persistence ────────────────────────────────────────────────────

  it("stores contextId from first response and sends it on second call", async () => {
    const wireaiJson = '{"action":"ask","message":"ok"}';
    mockFetch(makeTextTask(wireaiJson, "ctx-abc"), makeTextTask(wireaiJson, "ctx-abc"));
    const adapter = new A2AAdapter(config);

    await adapter.chat([{ role: "user", content: "first" }]);
    await adapter.chat([{ role: "user", content: "second" }]);

    const secondBody = callBody(1);
    const params = secondBody.params as { contextId: string };
    expect(params.contextId).toBe("ctx-abc");
  });

  it("does not send contextId on the very first call", async () => {
    mockFetch(makeTextTask('{"action":"ask","message":"ok"}'));
    const adapter = new A2AAdapter(config);
    await adapter.chat([{ role: "user", content: "hi" }]);
    const body = callBody();
    const params = body.params as { contextId?: string };
    expect(params.contextId).toBeUndefined();
  });

  // ── resetContext ─────────────────────────────────────────────────────────────

  it("resetContext clears contextId so next call sends no contextId", async () => {
    const wireaiJson = '{"action":"ask","message":"ok"}';
    mockFetch(makeTextTask(wireaiJson, "ctx-abc"), makeTextTask(wireaiJson, "ctx-abc"));
    const adapter = new A2AAdapter(config);

    await adapter.chat([{ role: "user", content: "first" }]);
    adapter.resetContext();

    await adapter.chat([{ role: "user", content: "second" }]);
    const secondBody = callBody(1);
    const params = secondBody.params as { contextId?: string };
    expect(params.contextId).toBeUndefined();
  });

  // ── Auth headers ─────────────────────────────────────────────────────────────

  it("adds Authorization header when apiKey is set", async () => {
    mockFetch(makeTextTask('{"action":"ask","message":"ok"}'));
    const adapter = new A2AAdapter(configWithKey);
    await adapter.chat([{ role: "user", content: "hi" }]);
    expect(callHeaders()["Authorization"]).toBe("Bearer sk-test");
  });

  it("does not add Authorization header when apiKey is absent", async () => {
    mockFetch(makeTextTask('{"action":"ask","message":"ok"}'));
    const adapter = new A2AAdapter(config);
    await adapter.chat([{ role: "user", content: "hi" }]);
    expect(callHeaders()["Authorization"]).toBeUndefined();
  });

  // ── JSON-RPC envelope ────────────────────────────────────────────────────────

  it("sends correct JSON-RPC 2.0 envelope", async () => {
    mockFetch(makeTextTask('{"action":"ask","message":"ok"}'));
    const adapter = new A2AAdapter(config);
    await adapter.chat([{ role: "user", content: "test" }]);
    const body = callBody();
    expect(body.jsonrpc).toBe("2.0");
    expect(body.method).toBe("message/send");
    expect(typeof body.id).toBe("number");
    expect((body.params as { message: unknown }).message).toBeDefined();
  });

  // ── Polling ──────────────────────────────────────────────────────────────────

  it("polls tasks/get when initial state is WORKING", async () => {
    const wireaiJson = '{"action":"ask","message":"done"}';
    mockFetch(
      makeWorkingTask(),
      makePollTask("WORKING"),
      makePollTask("COMPLETED", wireaiJson),
    );
    const adapter = new A2AAdapter(config);
    const result = await adapter.chat([{ role: "user", content: "hi" }]);
    expect(result).toBe(wireaiJson);
    expect(gFetch()).toHaveBeenCalledTimes(3);
    const pollBody = callBody(1);
    expect(pollBody.method).toBe("tasks/get");
    expect((pollBody.params as { taskId: string }).taskId).toBe("task-1");
  });

  it("throws when task remains WORKING after max polls", async () => {
    jest.useFakeTimers();
    try {
      const responses = Array.from({ length: 35 }, () => makePollTask("WORKING"));
      mockFetch(makeWorkingTask(), ...responses);
      // Use a long timeoutMs so the adapter timeout does not fire before 30 polls run
      const adapter = new A2AAdapter({ ...config, timeoutMs: 120_000 });

      const chatPromise = adapter.chat([{ role: "user", content: "hi" }]);
      // Attach a no-op handler immediately so Node does not flag this as an
      // unhandled rejection while we advance fake timers below.
      chatPromise.catch(() => {});

      // Advance simulated time by 31s (30 polls × 1s each) flushing microtasks between ticks
      await jest.advanceTimersByTimeAsync(31_000);

      await expect(chatPromise).rejects.toThrow(/still in state "WORKING" after 30 polls/);
    } finally {
      jest.useRealTimers();
    }
  });

  // ── Error states ─────────────────────────────────────────────────────────────

  it("throws on FAILED task state", async () => {
    mockFetch({
      jsonrpc: "2.0", id: 1,
      result: { id: "t1", status: { state: "FAILED", message: "agent crashed" }, messages: [] },
    });
    const adapter = new A2AAdapter(config);
    await expect(
      adapter.chat([{ role: "user", content: "hi" }])
    ).rejects.toThrow(/FAILED.*agent crashed/);
  });

  it("throws on CANCELED task state", async () => {
    mockFetch({
      jsonrpc: "2.0", id: 1,
      result: { id: "t1", status: { state: "CANCELED" }, messages: [] },
    });
    const adapter = new A2AAdapter(config);
    await expect(
      adapter.chat([{ role: "user", content: "hi" }])
    ).rejects.toThrow(/CANCELED/);
  });

  it("throws on JSON-RPC error envelope", async () => {
    (global as unknown as { fetch: unknown }).fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          jsonrpc: "2.0", id: 1,
          error: { code: -32600, message: "Invalid Request" },
        }),
      })
    );
    const adapter = new A2AAdapter(config);
    await expect(
      adapter.chat([{ role: "user", content: "hi" }])
    ).rejects.toThrow(/RPC error -32600: Invalid Request/);
  });

  it("throws on HTTP error response", async () => {
    mockFetchHttpError(503);
    const adapter = new A2AAdapter(config);
    await expect(
      adapter.chat([{ role: "user", content: "hi" }])
    ).rejects.toThrow(/HTTP 503/);
  });

  it("throws on network error", async () => {
    mockFetchError("Network error");
    const adapter = new A2AAdapter(config);
    await expect(
      adapter.chat([{ role: "user", content: "hi" }])
    ).rejects.toThrow(/Cannot connect to A2A agent/);
  });

  it("throws on missing result field", async () => {
    (global as unknown as { fetch: unknown }).fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ jsonrpc: "2.0", id: 1 }),
      })
    );
    const adapter = new A2AAdapter(config);
    await expect(
      adapter.chat([{ role: "user", content: "hi" }])
    ).rejects.toThrow(/missing result/);
  });

  // ── AbortSignal ──────────────────────────────────────────────────────────────

  it("propagates AbortError when signal is aborted", async () => {
    (global as unknown as { fetch: unknown }).fetch = jest.fn(
      (_url: string, opts: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          opts.signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("AbortError"), { name: "AbortError" }))
          );
        })
    );
    const adapter = new A2AAdapter(config);
    const controller = new AbortController();
    const promise = adapter.chat([{ role: "user", content: "hi" }], controller.signal);
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  // ── v0.3 compatibility ───────────────────────────────────────────────────────

  it("handles v0.3 lowercase state 'completed'", async () => {
    const wireaiJson = '{"action":"ask","message":"compat"}';
    mockFetch({
      jsonrpc: "2.0", id: 1,
      result: {
        id: "t1", contextId: "ctx-1",
        status: { state: "completed" },
        messages: [{ role: "agent", parts: [{ text: wireaiJson }] }],
      },
    });
    const adapter = new A2AAdapter(config);
    const result = await adapter.chat([{ role: "user", content: "hi" }]);
    expect(result).toBe(wireaiJson);
  });

  it("handles v0.3 'assistant' role in response", async () => {
    const wireaiJson = '{"action":"ask","message":"compat"}';
    mockFetch({
      jsonrpc: "2.0", id: 1,
      result: {
        id: "t1", contextId: "ctx-1",
        status: { state: "completed" },
        messages: [{ role: "assistant", parts: [{ text: wireaiJson }] }],
      },
    });
    const adapter = new A2AAdapter(config);
    const result = await adapter.chat([{ role: "user", content: "hi" }]);
    expect(result).toBe(wireaiJson);
  });

  it("handles v0.3 'content' field on part", async () => {
    mockFetch({
      jsonrpc: "2.0", id: 1,
      result: {
        id: "t1",
        status: { state: "completed" },
        messages: [{ role: "agent", parts: [{ content: '{"action":"ask","message":"v03"}' }] }],
      },
    });
    const adapter = new A2AAdapter(config);
    const result = await adapter.chat([{ role: "user", content: "hi" }]);
    expect(result).toBe('{"action":"ask","message":"v03"}');
  });

  // ── Artifacts ────────────────────────────────────────────────────────────────

  it("extracts content from artifacts when messages have no agent response", async () => {
    const data = { action: "render", component: "StatusCard", props: { status: "success", title: "Done" } };
    mockFetch({
      jsonrpc: "2.0", id: 1,
      result: {
        id: "t1",
        status: { state: "COMPLETED" },
        messages: [{ role: "user", parts: [{ text: "hi" }] }],
        artifacts: [{ parts: [{ data }] }],
      },
    });
    const adapter = new A2AAdapter(config);
    const result = await adapter.chat([{ role: "user", content: "hi" }]);
    expect(JSON.parse(result)).toEqual(data);
  });

  // ── ping ─────────────────────────────────────────────────────────────────────

  it("ping returns true for a valid AgentCard", async () => {
    (global as unknown as { fetch: unknown }).fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ name: "Test Agent", url: "https://agent.example.com/a2a" }),
      })
    );
    const adapter = new A2AAdapter(config);
    expect(await adapter.ping()).toBe(true);
    const calledUrl = (gFetch().mock.calls[0] as [string])[0];
    expect(calledUrl).toBe("https://agent.example.com/.well-known/agent-card.json");
  });

  it("ping returns false when AgentCard has no url field", async () => {
    (global as unknown as { fetch: unknown }).fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ name: "No URL" }) })
    );
    const adapter = new A2AAdapter(config);
    expect(await adapter.ping()).toBe(false);
  });

  it("ping returns false on HTTP error", async () => {
    (global as unknown as { fetch: unknown }).fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 404 })
    );
    const adapter = new A2AAdapter(config);
    expect(await adapter.ping()).toBe(false);
  });

  it("ping returns false on network error", async () => {
    mockFetchError("ECONNREFUSED");
    const adapter = new A2AAdapter(config);
    expect(await adapter.ping()).toBe(false);
  });

  // ── INPUT_REQUIRED ───────────────────────────────────────────────────────────

  it("returns content from INPUT_REQUIRED state (interactive component rendered)", async () => {
    const wireaiJson = '{"action":"render","component":"SelectionCard","props":{"title":"Pick one","options":["A","B"]}}';
    mockFetch({
      jsonrpc: "2.0", id: 1,
      result: {
        id: "t1", contextId: "ctx-1",
        status: { state: "INPUT_REQUIRED" },
        messages: [{ role: "agent", parts: [{ text: wireaiJson }] }],
      },
    });
    const adapter = new A2AAdapter(config);
    const result = await adapter.chat([{ role: "user", content: "hi" }]);
    expect(result).toBe(wireaiJson);
  });
});
