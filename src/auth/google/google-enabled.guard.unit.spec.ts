import { NotFoundException } from '@nestjs/common';
import { GoogleEnabledGuard } from './google-enabled.guard';
import { GoogleScopeConfig } from './config/google.scope';

const config = (enabled: boolean): GoogleScopeConfig => ({
  enabled,
  clientId: 'a-client-id',
  clientSecret: 'a-client-secret',
  audience: 'an-audience',
  callbackUrl: 'http://localhost:3000/auth/google/callback',
  selfUrl: 'http://localhost:3000',
});

describe('GoogleEnabledGuard', () => {
  it('lets the request through when the provider is enabled', () => {
    expect(new GoogleEnabledGuard(config(true)).canActivate()).toBe(true);
  });

  // 404, not 401/403: with the provider off the endpoint is not part of this
  // deployment's API. Before the guard existed, the same request reached
  // `AuthGuard('google')` and blew up on a strategy that was never
  // registered — a 500 on a deliberate configuration.
  it('answers 404 when the provider is disabled', () => {
    const guard = new GoogleEnabledGuard(config(false));

    expect(() => guard.canActivate()).toThrow(NotFoundException);
  });

  // Nothing about the provider's configuration belongs in the response.
  it('does not name the provider in the response body', () => {
    const guard = new GoogleEnabledGuard(config(false));

    try {
      guard.canActivate();
      throw new Error('expected canActivate to throw');
    } catch (e) {
      expect(
        JSON.stringify((e as NotFoundException).getResponse()),
      ).not.toMatch(/google/i);
    }
  });
});
