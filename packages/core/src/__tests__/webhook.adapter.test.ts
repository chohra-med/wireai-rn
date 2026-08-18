import { WebhookAdapter } from '../llm/webhook.adapter';

describe('WebhookAdapter', () => {
  const config = {
    provider: 'webhook' as const,
    baseUrl: 'https://api.example.com/chat',
    model: 'my-agent'
  };

  it('should construct correctly', () => {
    const adapter = new WebhookAdapter(config);
    expect(adapter).toBeDefined();
  });

  // Mocking fetch globally for this test
  it('should handle successful response', async () => {
    const mockText = JSON.stringify({ content: '{"action": "ask", "content": "hello"}' });
    (global as any).fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve(mockText),
      })
    );

    const adapter = new WebhookAdapter(config);
    const result = await adapter.chat([{ role: 'user', content: 'hi' }]);
    
    expect(result).toBe('{"action": "ask", "content": "hello"}');
    expect(global.fetch).toHaveBeenCalledWith(
      config.baseUrl,
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"role":"user"')
      })
    );
  });

  // An already-aborted signal fires no further "abort" event, so the adapter
  // has to read `signal.aborted` up front or the request goes out regardless.
  it('rejects an already-aborted signal before issuing any request', async () => {
    const fetchMock = jest.fn(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve('should never be read'),
      })
    );
    (global as unknown as { fetch: unknown }).fetch = fetchMock;

    const controller = new AbortController();
    controller.abort();
    const adapter = new WebhookAdapter(config);

    await expect(
      adapter.chat([{ role: 'user', content: 'hi' }], controller.signal)
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
