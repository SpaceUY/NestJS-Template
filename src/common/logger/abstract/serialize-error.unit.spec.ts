import { serializeError, serializeErrorToString } from './serialize-error';

describe('serializeError', () => {
  it('serializes an Error into name, message and stack', () => {
    const err = new Error('kaboom');
    const result = serializeError(err);
    expect(result).toMatchObject({
      name: 'Error',
      message: 'kaboom',
      stack: err.stack,
    });
  });

  it('omits stack when the Error has none', () => {
    const err = new Error('kaboom');
    err.stack = undefined;
    expect(serializeError(err)).toEqual({ name: 'Error', message: 'kaboom' });
  });

  it('serializes a nested cause recursively', () => {
    const cause = new Error('root');
    const err = new Error('wrapper');
    (err as { cause?: unknown }).cause = cause;
    const result = serializeError(err) as Record<string, unknown>;
    expect(result.cause).toMatchObject({ name: 'Error', message: 'root' });
  });

  it('coerces primitives with String', () => {
    expect(serializeError('plain string')).toBe('plain string');
    expect(serializeError(42)).toBe('42');
    expect(serializeError(null)).toBe('null');
    expect(serializeError(undefined)).toBe('undefined');
  });

  it('preserves plain object fields instead of "[object Object]"', () => {
    expect(serializeError({ code: 'E_FOO', detail: 'bar' })).toEqual({
      code: 'E_FOO',
      detail: 'bar',
    });
  });

  it('replaces circular references with [Circular] and preserves other fields', () => {
    const circular: Record<string, unknown> = { code: 'E_CIRC' };
    circular.self = circular;
    expect(serializeError(circular)).toEqual({ code: 'E_CIRC', self: '[Circular]' });
  });

  it('does not invoke a hostile toString on objects', () => {
    const hostile = {
      value: 1,
      toString() {
        throw new Error('should never be called');
      },
    };
    expect(() => serializeError(hostile)).not.toThrow();
    expect(serializeError(hostile)).toEqual({ value: 1 });
  });
});

describe('serializeErrorToString', () => {
  it('returns the string form for primitives', () => {
    expect(serializeErrorToString('boom')).toBe('boom');
  });

  it('JSON-stringifies structured results', () => {
    expect(serializeErrorToString({ code: 'E_FOO' })).toBe('{"code":"E_FOO"}');
  });
});
