import { appScope, AppScopeConfig } from './app.scope';

const validate = (raw: Record<string, unknown>): AppScopeConfig => {
  if (!appScope.validate) throw new Error('app scope has no validator');
  return appScope.validate(raw);
};

describe('appScope', () => {
  it('allows a wildcard outside production', () => {
    expect(validate({}).corsOrigins).toEqual(['*']);
  });

  it('splits CORS_ORIGINS on commas and trims each entry', () => {
    expect(
      validate({ corsOrigins: 'http://a.com ,  https://b.com' }).corsOrigins,
    ).toEqual(['http://a.com', 'https://b.com']);
  });

  it('requires CORS_ORIGINS in production', () => {
    expect(() => validate({ nodeEnv: 'PROD' })).toThrow(
      /corsOrigins.*required/,
    );
  });

  it('refuses a wildcard in production, alone or inside a list', () => {
    expect(() => validate({ nodeEnv: 'PROD', corsOrigins: '*' })).toThrow();
    expect(() =>
      validate({ nodeEnv: 'PROD', corsOrigins: 'https://app.io,*' }),
    ).toThrow();
  });

  it('accepts a real production allowlist', () => {
    expect(
      validate({ nodeEnv: 'PROD', corsOrigins: 'https://app.io' }).corsOrigins,
    ).toEqual(['https://app.io']);
  });

  it('refuses a CORS_ORIGINS that parses to nothing', () => {
    expect(() => validate({ nodeEnv: 'PROD', corsOrigins: ' , ' })).toThrow();
  });

  it('publishes Swagger by default outside production', () => {
    expect(validate({}).swaggerEnabled).toBe(true);
    expect(validate({ nodeEnv: 'TEST' }).swaggerEnabled).toBe(true);
  });

  // The whole point: an environment that says nothing about Swagger must not
  // expose the API surface in production.
  it('hides Swagger by default in production', () => {
    expect(
      validate({ nodeEnv: 'PROD', corsOrigins: 'https://app.io' })
        .swaggerEnabled,
    ).toBe(false);
  });

  // The escape hatch the flag exists for: docs on a prod-like environment
  // without having to lie about NODE_ENV and lose the CORS rule above.
  it('lets production opt back in explicitly', () => {
    expect(
      validate({
        nodeEnv: 'PROD',
        corsOrigins: 'https://app.io',
        swaggerEnabled: 'true',
      }).swaggerEnabled,
    ).toBe(true);
  });

  it('lets any environment opt out explicitly', () => {
    expect(validate({ swaggerEnabled: 'false' }).swaggerEnabled).toBe(false);
  });

  it('refuses a SWAGGER_ENABLED that is not a boolean', () => {
    expect(() => validate({ swaggerEnabled: 'sometimes' })).toThrow(
      /swaggerEnabled/,
    );
  });
});
