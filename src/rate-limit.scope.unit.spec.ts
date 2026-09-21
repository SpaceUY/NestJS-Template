import { rateLimitScope, RateLimitScopeConfig } from './rate-limit.scope';

const validate = (raw: Record<string, unknown>): RateLimitScopeConfig => {
  if (!rateLimitScope.validate) {
    throw new Error('rate limit scope has no validator');
  }
  return rateLimitScope.validate(raw);
};

describe('rateLimitScope', () => {
  it('falls back to 100 requests a minute when nothing is configured', () => {
    expect(validate({})).toEqual({ ttlMs: 60_000, limit: 100 });
  });

  it('coerces the strings an environment source hands it', () => {
    expect(validate({ ttlMs: '15000', limit: '20' })).toEqual({
      ttlMs: 15_000,
      limit: 20,
    });
  });

  // A limit of 0 answers 429 to every request, including the first. That is
  // an outage, not a strict policy — the guard has to refuse to boot on it.
  it('refuses a limit of zero', () => {
    expect(() => validate({ limit: 0 })).toThrow(/limit/);
  });

  it('refuses a negative limit', () => {
    expect(() => validate({ limit: -1 })).toThrow(/limit/);
  });

  // A sub-second window is the silent off switch: the counter resets before
  // any realistic burst completes, so the guard stays registered and stops
  // limiting anything.
  it('refuses a window shorter than a second', () => {
    expect(() => validate({ ttlMs: 0 })).toThrow(/ttlMs/);
    expect(() => validate({ ttlMs: 999 })).toThrow(/ttlMs/);
  });

  it('refuses a fractional limit', () => {
    expect(() => validate({ limit: 1.5 })).toThrow(/limit/);
  });

  it('refuses a value that is not a number at all', () => {
    expect(() => validate({ limit: 'many' })).toThrow(/limit/);
  });

  it('refuses a key the scope does not declare', () => {
    expect(() => validate({ rateLimitLimit: 10 })).toThrow(/rateLimitLimit/);
  });
});
