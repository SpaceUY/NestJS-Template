import { googleScope, GoogleScopeConfig } from './google.scope';

const validate = (raw: Record<string, unknown>): GoogleScopeConfig => {
  if (!googleScope.validate) throw new Error('google scope has no validator');
  return googleScope.validate(raw);
};

const enabled = {
  enabled: true,
  clientId: 'a-client-id.apps.googleusercontent.com',
  clientSecret: 'a-client-secret',
  audience: 'a-mobile-client-id.apps.googleusercontent.com',
};

describe('googleScope', () => {
  it('is off by default and demands no credentials while it is off', () => {
    expect(validate({})).toEqual({
      enabled: false,
      selfUrl: 'http://localhost:5000',
      callbackUrl: 'http://localhost:5000/auth/google/callback',
    });
  });

  it('reads the flag a source hands it as a string', () => {
    expect(validate({ ...enabled, enabled: 'true' }).enabled).toBe(true);
  });

  // `GoogleStrategy` passes these straight to passport and `GoogleService`
  // checks the audience on every id token. Missing any of them fails at the
  // first sign-in attempt rather than at boot, which is why the scope refuses.
  it.each(['clientId', 'clientSecret', 'audience'] as const)(
    'refuses to enable Google OAuth without %s',
    (field) => {
      const incomplete: Record<string, unknown> = { ...enabled };
      delete incomplete[field];

      expect(() => validate(incomplete)).toThrow(
        new RegExp(`${field}.*required`),
      );
    },
  );

  it('has no built-in client secret to fall back on', () => {
    expect(() => validate({ ...enabled, clientSecret: undefined })).toThrow(
      /clientSecret.*required/,
    );
  });

  it('derives the callback URL from SELF_URL', () => {
    expect(
      validate({ ...enabled, selfUrl: 'https://api.example.com' }).callbackUrl,
    ).toBe('https://api.example.com/auth/google/callback');
  });

  it('keeps a configured callback URL instead of deriving one', () => {
    expect(
      validate({
        ...enabled,
        selfUrl: 'https://api.example.com',
        callbackUrl: 'https://api.example.com/oauth/return',
      }).callbackUrl,
    ).toBe('https://api.example.com/oauth/return');
  });

  it('refuses a flag that is not a boolean', () => {
    expect(() => validate({ enabled: 'maybe' })).toThrow(/enabled/);
  });

  it('refuses a key the scope does not declare', () => {
    expect(() => validate({ googleClientId: 'a-client-id' })).toThrow(
      /googleClientId/,
    );
  });
});
