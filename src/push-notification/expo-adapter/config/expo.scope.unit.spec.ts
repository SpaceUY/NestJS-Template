import { expoScope, ExpoScopeConfig } from './expo.scope';

const validate = (raw: Record<string, unknown>): ExpoScopeConfig => {
  if (!expoScope.validate) throw new Error('expo scope has no validator');
  return expoScope.validate(raw);
};

describe('expoScope', () => {
  // The access token is a credential. An unset EXPO_ACCESS_TOKEN has to come
  // out empty — a literal default here would be a shipped secret (`T4`).
  it('defaults the access token to empty and never to a literal', () => {
    expect(validate({})).toEqual({ accessToken: '' });
  });

  it('carries a configured access token through untouched', () => {
    expect(validate({ accessToken: 'an-expo-token' })).toEqual({
      accessToken: 'an-expo-token',
    });
  });

  it('refuses a non-string access token', () => {
    expect(() => validate({ accessToken: 42 })).toThrow(/accessToken/);
  });

  it('refuses a key the scope does not declare', () => {
    expect(() => validate({ expoAccessToken: 'an-expo-token' })).toThrow(
      /expoAccessToken/,
    );
  });
});
