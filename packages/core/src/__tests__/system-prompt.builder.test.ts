import { buildSystemPrompt } from '../schema/system-prompt.builder';
import { z } from 'zod';

describe('buildSystemPrompt', () => {
  const mockRegistry = new Map<string, any>();
  mockRegistry.set('TestComp', {
    name: 'TestComp',
    description: 'Use when testing.',
    propsSchema: z.object({
      foo: z.string().describe('A bar')
    }),
    component: () => null
  });

  it('should include component names and descriptions', () => {
    const prompt = buildSystemPrompt(mockRegistry);
    expect(prompt).toContain('TestComp');
    expect(prompt).toContain('Use when testing.');
  });

  it('should include the JSON schema format', () => {
    const prompt = buildSystemPrompt(mockRegistry);
    expect(prompt).toContain('action');
    expect(prompt).toContain('render');
    expect(prompt).toContain('ask');
  });

  it('should append suffix if provided', () => {
    const prompt = buildSystemPrompt(mockRegistry, 'Extra instruction.');
    expect(prompt).toContain('Extra instruction.');
  });
});
