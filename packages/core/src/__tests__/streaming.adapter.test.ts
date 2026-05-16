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
