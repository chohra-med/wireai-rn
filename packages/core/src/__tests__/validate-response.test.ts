import { z } from 'zod';
import { validateLLMResponse } from '../schema/validate-response';
import { NodeRefSchema } from '../schema/node-ref.schema';
import type { ComponentRegistry } from '../registry/component-registry';
import type { WireAIAskResponse } from '../types';

const makeRegistry = (): ComponentRegistry => {
  const registry: ComponentRegistry = new Map();
  registry.set('Text', {
    name: 'Text',
    description: 'A text line.',
    propsSchema: z.object({ content: z.string() }),
    component: () => null,
  });
  registry.set('BarChart', {
    name: 'BarChart',
    description: 'A bar chart.',
    propsSchema: z.object({
      data: z.array(z.object({ label: z.string(), value: z.number() })),
    }),
    component: () => null,
  });
  registry.set('Card', {
    name: 'Card',
    description: 'A container card.',
    propsSchema: z.object({
      title: z.string(),
      children: z.array(NodeRefSchema).optional(),
    }),
    component: () => null,
  });
  return registry;
};

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

    const result = validateLLMResponse(input) as WireAIAskResponse;
    expect(result.action).toBe('ask');
    expect(result.message).toBe('How are you?');
  });

  it('should handle markdown code blocks', () => {
    const input = 'Here is the UI: \n```json\n{"action": "ask", "message": "test"}\n```';
    const result = validateLLMResponse(input) as WireAIAskResponse;
    expect(result.action).toBe('ask');
    expect(result.message).toBe('test');
  });

  it('should throw error for invalid JSON', () => {
    const input = 'not json';
    expect(() => validateLLMResponse(input)).toThrow('LLM_PARSE_ERROR');
  });

  it('should accept a valid nested tree', () => {
    const registry = makeRegistry();
    const input = JSON.stringify({
      action: 'render',
      component: 'Card',
      props: {
        title: 'Summary',
        children: [
          { component: 'Text', props: { content: 'hello' } },
          { component: 'BarChart', props: { data: [{ label: 'A', value: 1 }] } },
        ],
      },
    });
    const result = validateLLMResponse(input, registry);
    expect(result.action).toBe('render');
    expect(result.component).toBe('Card');
    expect((result.props as any).children).toHaveLength(2);
  });

  it('should surface a path when a nested child has bad props', () => {
    const registry = makeRegistry();
    const input = JSON.stringify({
      action: 'render',
      component: 'Card',
      props: {
        title: 'Summary',
        children: [
          { component: 'Text', props: { content: 'ok' } },
          { component: 'BarChart', props: { data: 'not-an-array' } },
        ],
      },
    });
    expect(() => validateLLMResponse(input, registry)).toThrow(/LLM_SCHEMA_ERROR/);
    expect(() => validateLLMResponse(input, registry)).toThrow(/children\[1\]/);
  });

  it('should reject an unknown nested component with a path', () => {
    const registry = makeRegistry();
    const input = JSON.stringify({
      action: 'render',
      component: 'Card',
      props: {
        title: 'Summary',
        children: [{ component: 'Mystery', props: {} }],
      },
    });
    expect(() => validateLLMResponse(input, registry)).toThrow(/COMPONENT_NOT_FOUND/);
    expect(() => validateLLMResponse(input, registry)).toThrow(/children\[0\]/);
  });
});
