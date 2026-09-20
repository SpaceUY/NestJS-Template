import { jwtScope, JwtScopeConfig } from './jwt.scope';

const validate = (raw: Record<string, unknown>): JwtScopeConfig => {
  if (!jwtScope.validate) throw new Error('jwt scope has no validator');
  return jwtScope.validate(raw);
};

describe('jwtScope', () => {
  it('refuses to start without JWT_SECRET', () => {
    expect(() => validate({})).toThrow(/secret.*required/);
  });

  it('has no built-in secret to fall back on', () => {
    expect(() => validate({ expiresIn: '1d' })).toThrow(/secret.*required/);
  });

  it('keeps the documented defaults once a secret is supplied', () => {
    expect(validate({ secret: 'a-real-secret' })).toEqual({
      secret: 'a-real-secret',
      expiresIn: '7d',
      ignoreExpiration: false,
    });
  });
});
