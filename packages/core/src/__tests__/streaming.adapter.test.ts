import { LMStudioAdapter } from '../llm/lmstudio.adapter';
import { OllamaAdapter } from '../llm/ollama.adapter';
import { OpenAIAdapter } from '../llm/openai.adapter';
import { WebhookAdapter } from '../llm/webhook.adapter';

/**
 * Minimal XMLHttpRequest stand-in for streaming adapter tests.
 * Lets the test script-drive chunks via `feed()` and complete via `finish()`.
 */
class MockXHR {
  static instances: MockXHR[] = [];
  responseText = '';
  status = 200;
  onprogress: (() => void) | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  headers: Record<string, string> = {};
  url = '';
  method = '';
  body: string | null = null;

  constructor() {
    MockXHR.instances.push(this);
  }
  open(method: string, url: string, _async?: boolean) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(k: string, v: string) {
    this.headers[k] = v;
  }
  send(body: string | null = null) {
    this.body = body;
  }
  abort() {
    this.onabort?.();
  }
  feed(chunk: string) {
    this.responseText += chunk;
    this.onprogress?.();
  }
  finish(status = 200) {
    this.status = status;
    this.onload?.();
  }
}

const installMockXHR = () => {
  MockXHR.instances = [];
  (global as any).XMLHttpRequest = MockXHR;
};

describe('OpenAIAdapter.chatStream', () => {
  beforeEach(installMockXHR);

  it('emits accumulated text per SSE frame and signals done at end', async () => {
    const adapter = new OpenAIAdapter({
      provider: 'openai',
      baseUrl: 'https://api.openai.com',
      model: 'gpt-4o-mini',
      apiKey: 'sk-test',
    });
    const seen: { text: string; done: boolean }[] = [];
    const promise = adapter.chatStream!(
      [{ role: 'user', content: 'hi' }],
      (text, done) => seen.push({ text, done })
    );
    // Let the XHR get constructed and `send`-ed.
    await new Promise((r) => setImmediate(r));
    const xhr = MockXHR.instances[0]!;
    xhr.feed('data: {"choices":[{"delta":{"content":"{\\"a\\":1"}}]}\n\n');
    xhr.feed('data: {"choices":[{"delta":{"content":"}"}}]}\n\n');
    xhr.feed('data: [DONE]\n\n');
    xhr.finish(200);
    await promise;

    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen[seen.length - 1]!.done).toBe(true);
    expect(seen[seen.length - 1]!.text).toBe('{"a":1}');
  });

  it('rejects on non-2xx status', async () => {
    const adapter = new OpenAIAdapter({
      provider: 'openai',
      baseUrl: 'https://api.openai.com',
      model: 'gpt-4o-mini',
      apiKey: 'sk-test',
    });
    const promise = adapter.chatStream!(
      [{ role: 'user', content: 'hi' }],
      () => undefined
    );
    await new Promise((r) => setImmediate(r));
    const xhr = MockXHR.instances[0]!;
    xhr.responseText = 'bad request';
    xhr.finish(400);
    await expect(promise).rejects.toThrow(/OpenAI error 400/);
  });
});

describe('WebhookAdapter.chatStream', () => {
  beforeEach(installMockXHR);

  it('forwards raw chunks and finishes with isDone=true', async () => {
    const adapter = new WebhookAdapter({
      provider: 'webhook',
      baseUrl: 'https://example.com/chat',
      model: 'my-agent',
    });
    const seen: { text: string; done: boolean }[] = [];
    const promise = adapter.chatStream!(
      [{ role: 'user', content: 'hi' }],
      (text, done) => seen.push({ text, done })
    );
    await new Promise((r) => setImmediate(r));
    const xhr = MockXHR.instances[0]!;
    xhr.feed('{"action":"render","component":"Card","props":{');
    xhr.feed('"title":"Hi"}}');
    xhr.finish(200);
    await promise;

    expect(seen[seen.length - 1]!.done).toBe(true);
    expect(seen[seen.length - 1]!.text).toBe(
      '{"action":"render","component":"Card","props":{"title":"Hi"}}'
    );
  });
});

// ─── Local streaming adapters: chunk-boundary losslessness (H1) ───────────────

const ollamaConfig = {
  provider: 'ollama' as const,
  baseUrl: 'http://localhost:11434',
  model: 'llama3',
};

const lmStudioConfig = {
  provider: 'lmstudio' as const,
  baseUrl: 'http://localhost:1234',
  model: 'local-model',
};

/** Collects every onChunk call so the last one can be asserted. */
const collector = () => {
  const seen: { text: string; done: boolean }[] = [];
  return {
    seen,
    onChunk: (text: string, done: boolean) => {
      seen.push({ text, done });
    },
    last: () => seen[seen.length - 1]!,
  };
};

describe('OllamaAdapter.chatStream', () => {
  beforeEach(installMockXHR);

  it('does not drop tokens when an NDJSON line is split across two chunks', async () => {
    // One logical NDJSON line, delivered in two pieces that break mid-token.
    const firstHalf = '{"message":{"content":"Hel';
    const secondHalf = 'lo world"},"done":false}\n';
    // The expectation is derived from what the mock SENT, by parsing the two
    // halves joined — not from a literal typed independently into the test.
    const expected = (
      JSON.parse((firstHalf + secondHalf).trim()) as { message: { content: string } }
    ).message.content;

    const adapter = new OllamaAdapter(ollamaConfig);
    const sink = collector();
    const promise = adapter.chatStream!([{ role: 'user', content: 'hi' }], sink.onChunk);
    await new Promise((r) => setImmediate(r));
    const xhr = MockXHR.instances[0]!;
    xhr.feed(firstHalf);
    xhr.feed(secondHalf);
    xhr.finish(200);
    await promise;

    expect(sink.last().done).toBe(true);
    expect(sink.last().text).toBe(expected);
  });

  it('flushes a final line that only arrives with onload (no trailing newline)', async () => {
    const head = '{"message":{"content":"Par';
    const tail = 'tial tail"},"done":true}';
    const expected = (JSON.parse(head + tail) as { message: { content: string } }).message.content;

    const adapter = new OllamaAdapter(ollamaConfig);
    const sink = collector();
    const promise = adapter.chatStream!([{ role: 'user', content: 'hi' }], sink.onChunk);
    await new Promise((r) => setImmediate(r));
    const xhr = MockXHR.instances[0]!;
    xhr.feed(head);
    // The rest of the body lands without another onprogress, the way a stream
    // whose last bytes arrive with completion does.
    xhr.responseText += tail;
    xhr.finish(200);
    await promise;

    expect(sink.last().done).toBe(true);
    expect(sink.last().text).toBe(expected);
  });

  it('rejects a caller abort with name "AbortError", not a bare Error', async () => {
    const adapter = new OllamaAdapter(ollamaConfig);
    const controller = new AbortController();
    const promise = adapter.chatStream!(
      [{ role: 'user', content: 'hi' }],
      () => undefined,
      controller.signal
    );
    await new Promise((r) => setImmediate(r));
    MockXHR.instances[0]!.feed('{"message":{"content":"partial"},"done":false}\n');
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('reports a timed-out stream as a timeout, not as a plain abort', async () => {
    jest.useFakeTimers();
    try {
      const adapter = new OllamaAdapter({ ...ollamaConfig, timeoutMs: 5_000 });
      const promise = adapter.chatStream!([{ role: 'user', content: 'hi' }], () => undefined);
      promise.catch(() => undefined);
      await jest.advanceTimersByTimeAsync(6_000);
      await expect(promise).rejects.toThrow(/Ollama request timed out/);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('LMStudioAdapter.chatStream', () => {
  beforeEach(installMockXHR);

  it('does not drop tokens when an SSE data line is split across two chunks', async () => {
    const firstHalf = 'data: {"choices":[{"delta":{"content":"Hel';
    const secondHalf = 'lo world"}}]}\n';
    const payload = (firstHalf + secondHalf).trim().slice('data:'.length);
    const expected = (
      JSON.parse(payload) as { choices: { delta: { content: string } }[] }
    ).choices[0]!.delta.content;

    const adapter = new LMStudioAdapter(lmStudioConfig);
    const sink = collector();
    const promise = adapter.chatStream!([{ role: 'user', content: 'hi' }], sink.onChunk);
    await new Promise((r) => setImmediate(r));
    const xhr = MockXHR.instances[0]!;
    xhr.feed(firstHalf);
    xhr.feed(secondHalf);
    xhr.feed('data: [DONE]\n');
    xhr.finish(200);
    await promise;

    expect(sink.last().done).toBe(true);
    expect(sink.last().text).toBe(expected);
  });

  it('flushes a final data line that only arrives with onload (no trailing newline)', async () => {
    const head = 'data: {"choices":[{"delta":{"content":"Par';
    const tail = 'tial tail"}}]}';
    const expected = (
      JSON.parse((head + tail).slice('data:'.length)) as {
        choices: { delta: { content: string } }[];
      }
    ).choices[0]!.delta.content;

    const adapter = new LMStudioAdapter(lmStudioConfig);
    const sink = collector();
    const promise = adapter.chatStream!([{ role: 'user', content: 'hi' }], sink.onChunk);
    await new Promise((r) => setImmediate(r));
    const xhr = MockXHR.instances[0]!;
    xhr.feed(head);
    xhr.responseText += tail;
    xhr.finish(200);
    await promise;

    expect(sink.last().done).toBe(true);
    expect(sink.last().text).toBe(expected);
  });

  it('rejects a caller abort with name "AbortError", not a bare Error', async () => {
    const adapter = new LMStudioAdapter(lmStudioConfig);
    const controller = new AbortController();
    const promise = adapter.chatStream!(
      [{ role: 'user', content: 'hi' }],
      () => undefined,
      controller.signal
    );
    await new Promise((r) => setImmediate(r));
    MockXHR.instances[0]!.feed('data: {"choices":[{"delta":{"content":"partial"}}]}\n');
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('reports a timed-out stream as a timeout, not as a plain abort', async () => {
    jest.useFakeTimers();
    try {
      const adapter = new LMStudioAdapter({ ...lmStudioConfig, timeoutMs: 5_000 });
      const promise = adapter.chatStream!([{ role: 'user', content: 'hi' }], () => undefined);
      promise.catch(() => undefined);
      await jest.advanceTimersByTimeAsync(6_000);
      await expect(promise).rejects.toThrow(/LM Studio request timed out/);
    } finally {
      jest.useRealTimers();
    }
  });
});

// ─── Already-aborted AbortSignal (L11) ───────────────────────────────────────

/** Mocks a healthy fetch and hands back the mock so its call count is readable. */
const mockFetchOk = (payload: object): jest.Mock => {
  const fn = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(payload),
      text: () => Promise.resolve(JSON.stringify(payload)),
    })
  );
  (global as unknown as { fetch: unknown }).fetch = fn;
  return fn;
};

const abortedSignal = (): AbortSignal => {
  const controller = new AbortController();
  controller.abort();
  return controller.signal;
};

describe('already-aborted AbortSignal', () => {
  beforeEach(installMockXHR);
  afterEach(() => jest.clearAllMocks());

  it('OllamaAdapter.chat issues no request', async () => {
    const fetchMock = mockFetchOk({ message: { content: 'should never be read' } });
    const adapter = new OllamaAdapter(ollamaConfig);
    await expect(
      adapter.chat([{ role: 'user', content: 'hi' }], abortedSignal())
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('LMStudioAdapter.chat issues no request', async () => {
    const fetchMock = mockFetchOk({
      choices: [{ message: { content: 'should never be read' } }],
    });
    const adapter = new LMStudioAdapter(lmStudioConfig);
    await expect(
      adapter.chat([{ role: 'user', content: 'hi' }], abortedSignal())
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('OpenAIAdapter.chat issues no request', async () => {
    const fetchMock = mockFetchOk({
      choices: [{ message: { content: 'should never be read' } }],
    });
    const adapter = new OpenAIAdapter({
      provider: 'openai',
      baseUrl: 'https://api.openai.com',
      model: 'gpt-4o-mini',
      apiKey: 'sk-test',
    });
    await expect(
      adapter.chat([{ role: 'user', content: 'hi' }], abortedSignal())
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('OllamaAdapter.chatStream opens no XHR', async () => {
    const adapter = new OllamaAdapter({ ...ollamaConfig, timeoutMs: 50 });
    const promise = adapter.chatStream!(
      [{ role: 'user', content: 'hi' }],
      () => undefined,
      abortedSignal()
    );
    promise.catch(() => undefined);
    expect(MockXHR.instances.length).toBe(0);
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('LMStudioAdapter.chatStream opens no XHR', async () => {
    const adapter = new LMStudioAdapter({ ...lmStudioConfig, timeoutMs: 50 });
    const promise = adapter.chatStream!(
      [{ role: 'user', content: 'hi' }],
      () => undefined,
      abortedSignal()
    );
    promise.catch(() => undefined);
    expect(MockXHR.instances.length).toBe(0);
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('OpenAIAdapter.chatStream opens no XHR', async () => {
    const adapter = new OpenAIAdapter({
      provider: 'openai',
      baseUrl: 'https://api.openai.com',
      model: 'gpt-4o-mini',
      apiKey: 'sk-test',
      timeoutMs: 50,
    });
    const promise = adapter.chatStream!(
      [{ role: 'user', content: 'hi' }],
      () => undefined,
      abortedSignal()
    );
    promise.catch(() => undefined);
    expect(MockXHR.instances.length).toBe(0);
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('WebhookAdapter.chatStream opens no XHR', async () => {
    const adapter = new WebhookAdapter({
      provider: 'webhook',
      baseUrl: 'https://example.com/chat',
      model: 'my-agent',
      timeoutMs: 50,
    });
    const promise = adapter.chatStream!(
      [{ role: 'user', content: 'hi' }],
      () => undefined,
      abortedSignal()
    );
    promise.catch(() => undefined);
    expect(MockXHR.instances.length).toBe(0);
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });
});
