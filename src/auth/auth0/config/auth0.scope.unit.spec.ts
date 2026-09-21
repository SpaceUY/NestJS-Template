import { auth0Scope, Auth0ScopeConfig } from './auth0.scope';

const validate = (raw: Record<string, unknown>): Auth0ScopeConfig => {
  if (!auth0Scope.validate) throw new Error('auth0 scope has no validator');
  return auth0Scope.validate(raw);
};

const enabled = {
  enabled: true,
  domain: 'tenant.eu.auth0.com',
  audience: 'https://api.example.com',
};

describe('auth0Scope', () => {
  it('is off by default and demands nothing while it is off', () => {
    expect(validate({})).toEqual({ enabled: false });
  });

  it('reads the flag a source hands it as a string', () => {
    expect(validate({ ...enabled, enabled: 'true' }).enabled).toBe(true);
  });

  // `Auth0Service` verifies the audience and issuer of every incoming token.
  // Missing either one turns that check into a comparison against `undefined`,
  // so the scope refuses to start instead.
  it.each(['domain', 'audience'] as const)(
    'refuses to enable Auth0 without %s',
    (field) => {
      const incomplete: Record<string, unknown> = { ...enabled };
      delete incomplete[field];

      expect(() => validate(incomplete)).toThrow(
        new RegExp(`${field}.*required`),
      );
    },
  );

  it('derives the issuer from the domain when none is configured', () => {
    expect(validate(enabled)).toEqual({
      ...enabled,
      issuer: 'https://tenant.eu.auth0.com/',
    });
  });

  it('keeps a configured issuer instead of deriving one', () => {
    expect(
      validate({ ...enabled, issuer: 'https://login.example.com/' }).issuer,
    ).toBe('https://login.example.com/');
  });

  // Turning the flag off does not unregister the module (see
  // `Auth0Module`'s constructor), so the derived issuer still has to be right
  // for the routes that are still live.
  it('derives the issuer even while the provider is disabled', () => {
    expect(
      validate({ enabled: false, domain: 'tenant.eu.auth0.com' }).issuer,
    ).toBe('https://tenant.eu.auth0.com/');
  });

  it('leaves the issuer unset when there is no domain to derive it from', () => {
    expect(validate({ enabled: false }).issuer).toBeUndefined();
  });

  it('refuses a flag that is not a boolean', () => {
    expect(() => validate({ enabled: 'maybe' })).toThrow(/enabled/);
  });

  it('refuses a key the scope does not declare', () => {
    expect(() => validate({ clientSecret: 'a-secret' })).toThrow(
      /clientSecret/,
    );
  });
});
