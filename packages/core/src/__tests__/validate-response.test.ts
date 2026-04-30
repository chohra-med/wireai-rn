import { validateLLMResponse } from '../schema/validate-response';

describe('validateLLMResponse', () => {
  it('should parse valid render response', () => {
    const input = JSON.stringify({
      action: 'render',
      component: 'ActionCard',
      props: {
        title: 'Hello',
        primaryLabel: 'Go'
      }
    });

    const result = validateLLMResponse(input);
    expect(result.action).toBe('render');
    expect(result.component).toBe('ActionCard');
    expect(result.props?.title).toBe('Hello');
  });

  it('should rescue spilled props (Gemini pattern)', () => {
    // Some models put props at the root level instead of inside props: {}
    const input = JSON.stringify({
      action: 'render',
      component: 'StatusCard',
      status: 'success',
      title: 'Done'
    });

    const result = validateLLMResponse(input);
    expect(result.action).toBe('render');
    expect(result.props?.status).toBe('success');
    expect(result.props?.title).toBe('Done');
  });

  it('should parse ask response', () => {
    const input = JSON.stringify({
      action: 'ask',
      message: 'How are you?'
    });

    const result = validateLLMResponse(input) as any;
    expect(result.action).toBe('ask');
    expect(result.message).toBe('How are you?');
  });

  it('should handle markdown code blocks', () => {
    const input = 'Here is the UI: \n```json\n{"action": "ask", "message": "test"}\n```';
    const result = validateLLMResponse(input) as any;
    expect(result.action).toBe('ask');
    expect(result.message).toBe('test');
  });

  it('should throw error for invalid JSON', () => {
    const input = 'not json';
    expect(() => validateLLMResponse(input)).toThrow('LLM_PARSE_ERROR');
  });
});
