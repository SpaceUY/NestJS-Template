import {
  spaceshipCacheScope,
  SpaceshipCacheScopeConfig,
} from './spaceship-cache.scope';

const validate = (raw: Record<string, unknown>): SpaceshipCacheScopeConfig => {
  if (!spaceshipCacheScope.validate) {
    throw new Error('spaceshipCache scope has no validator');
  }
  return spaceshipCacheScope.validate(raw);
};

describe('spaceshipCacheScope', () => {
  it('defaults to a one-minute TTL when the variable is unset', () => {
    expect(validate({})).toEqual({ listTtlSeconds: 60 });
  });

  it('carries a configured TTL through', () => {
    expect(validate({ listTtlSeconds: 300 })).toEqual({ listTtlSeconds: 300 });
  });

  // A zero or negative TTL means "cache forever" or "error" depending on the
  // Redis command; neither is what someone typing 0 intends.
  it('refuses a TTL of zero', () => {
    expect(() => validate({ listTtlSeconds: 0 })).toThrow(/listTtlSeconds/);
  });

  it('refuses a negative TTL', () => {
    expect(() => validate({ listTtlSeconds: -1 })).toThrow(/listTtlSeconds/);
  });

  it('refuses a fractional TTL', () => {
    expect(() => validate({ listTtlSeconds: 1.5 })).toThrow(/listTtlSeconds/);
  });

  it('refuses a TTL that is not a number', () => {
    expect(() => validate({ listTtlSeconds: 'a-minute' })).toThrow(
      /listTtlSeconds/,
    );
  });
});
