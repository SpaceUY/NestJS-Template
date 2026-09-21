import { redisScope, RedisScopeConfig } from './redis.scope';

const validate = (raw: Record<string, unknown>): RedisScopeConfig => {
  if (!redisScope.validate) throw new Error('redis scope has no validator');
  return redisScope.validate(raw);
};

describe('redisScope', () => {
  it('falls back to a local, password-less Redis', () => {
    expect(validate({})).toEqual({
      host: 'localhost',
      port: 6379,
      password: '',
    });
  });

  // Every source hands values over as strings; the scope is the only place
  // that turns REDIS_PORT into the number ioredis and BullMQ expect.
  it('coerces the port a source hands it as a string', () => {
    expect(
      validate({ host: 'redis.internal', port: '6380', password: 's3cret' }),
    ).toEqual({ host: 'redis.internal', port: 6380, password: 's3cret' });
  });

  it('keeps an explicitly empty password rather than rejecting it', () => {
    expect(validate({ password: '' }).password).toBe('');
  });

  it('refuses a port that is not a number', () => {
    expect(() => validate({ port: 'not-a-port' })).toThrow(/port/);
  });

  it('refuses a fractional port', () => {
    expect(() => validate({ port: 6379.5 })).toThrow(/integer/);
  });

  // A mistyped field name would otherwise resolve to the default and the
  // service would quietly talk to localhost instead of the real instance.
  it('refuses a key the scope does not declare', () => {
    expect(() => validate({ hostname: 'redis.internal' })).toThrow(/hostname/);
  });
});
