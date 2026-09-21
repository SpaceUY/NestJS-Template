import { Logger } from '@nestjs/common';
import { Auth0Module } from './auth0.module';
import { Auth0ScopeConfig } from './config/auth0.scope';

const config = (enabled: boolean): Auth0ScopeConfig => ({
  enabled,
  domain: 'example.auth0.com',
  audience: 'an-audience',
  issuer: 'https://example.auth0.com/',
});

describe('Auth0Module', () => {
  let error: jest.SpyInstance;

  beforeEach(() => {
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => error.mockRestore());

  // AUTH0_ENABLED=false does not unregister the module — only editing
  // AuthModule does. The constructor log is the only thing that says so.
  it('complains when the module is registered with the provider disabled', () => {
    new Auth0Module(config(false));

    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toMatch(/remove it from AuthModule/i);
  });

  it('stays quiet when the provider is enabled', () => {
    new Auth0Module(config(true));

    expect(error).not.toHaveBeenCalled();
  });
});
