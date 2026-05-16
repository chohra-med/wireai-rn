import { parsePartialJson } from '../utils/parse-partial-json';

describe('parsePartialJson', () => {
  it('parses complete JSON as isComplete=true', () => {
    const res = parsePartialJson('{"a":1,"b":"hi"}');
    expect(res).not.toBeNull();
    expect(res!.isComplete).toBe(true);
    expect(res!.parsed).toEqual({ a: 1, b: 'hi' });
  });

  it('closes open braces in a truncated object', () => {
    const res = parsePartialJson('{"a":1');
    expect(res).not.toBeNull();
    expect(res!.isComplete).toBe(false);
    expect(res!.parsed).toEqual({ a: 1 });
  });

  it('closes an open string and trailing braces', () => {
    const res = parsePartialJson('{"a":"hello wo');
    expect(res).not.toBeNull();
    expect(res!.isComplete).toBe(false);
    expect((res!.parsed as any).a).toBe('hello wo');
  });

  it('strips a trailing comma', () => {
    const res = parsePartialJson('{"a":1,"b":2,');
    expect(res).not.toBeNull();
    expect(res!.parsed).toEqual({ a: 1, b: 2 });
  });

  it('backs off on a dangling colon', () => {
    const res = parsePartialJson('{"a":1,"b":');
    expect(res).not.toBeNull();
    // After back-off we should still recover { a: 1 }.
    expect((res!.parsed as any).a).toBe(1);
  });

  it('handles nested objects in a partial buffer', () => {
    const res = parsePartialJson('{"action":"render","props":{"title":"Sum');
    expect(res).not.toBeNull();
    const parsed = res!.parsed as any;
    expect(parsed.action).toBe('render');
    expect(parsed.props.title).toBe('Sum');
  });

  it('handles a partial children array', () => {
    const res = parsePartialJson(
      '{"action":"render","component":"Card","props":{"children":[{"component":"Text","props":{"content":"a"}},'
    );
    expect(res).not.toBeNull();
    const parsed = res!.parsed as any;
    expect(parsed.props.children).toHaveLength(1);
    expect(parsed.props.children[0].component).toBe('Text');
  });

  it('strips a leading markdown fence', () => {
    const res = parsePartialJson('```json\n{"a":1}\n```');
    expect(res).not.toBeNull();
    expect(res!.parsed).toEqual({ a: 1 });
  });

  it('returns null for buffers that have no object yet', () => {
    expect(parsePartialJson('hello')).toBeNull();
    expect(parsePartialJson('')).toBeNull();
  });
});
