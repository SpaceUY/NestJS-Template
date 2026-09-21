import { NotFoundException } from '@nestjs/common';
import { Auth0EnabledGuard } from './auth0-enabled.guard';
import { Auth0ScopeConfig } from './config/auth0.scope';

const config = (enabled: boolean): Auth0ScopeConfig => ({
  enabled,
  domain: 'example.auth0.com',
  audience: 'an-audience',
  issuer: 'https://example.auth0.com/',
});

describe('Auth0EnabledGuard', () => {
  it('lets the request through when the provider is enabled', () => {
    expect(new Auth0EnabledGuard(config(true)).canActivate()).toBe(true);
  });

  // 404, not 401: with the provider off the endpoint is not part of this
  // deployment's API. Before the guard existed, the request reached
  // `Auth0Service`, which called `/userinfo` on an unconfigured domain and
  // answered `invalidCredentials` — blaming the caller for a switch that is
  // off on the server.
  it('answers 404 when the provider is disabled', () => {
    const guard = new Auth0EnabledGuard(config(false));

    expect(() => guard.canActivate()).toThrow(NotFoundException);
  });

  it('does not name the provider in the response body', () => {
    const guard = new Auth0EnabledGuard(config(false));

    try {
      guard.canActivate();
      throw new Error('expected canActivate to throw');
    } catch (e) {
      expect(
        JSON.stringify((e as NotFoundException).getResponse()),
      ).not.toMatch(/auth0/i);
    }
  });
});
