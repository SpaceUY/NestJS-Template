import { Logger } from '@nestjs/common';
import { GoogleModule } from './google.module';
import { GoogleScopeConfig } from './config/google.scope';

const config = (enabled: boolean): GoogleScopeConfig => ({
  enabled,
  clientId: 'a-client-id',
  clientSecret: 'a-client-secret',
  audience: 'an-audience',
  callbackUrl: 'http://localhost:3000/auth/google/callback',
  selfUrl: 'http://localhost:3000',
});

describe('GoogleModule', () => {
  let error: jest.SpyInstance;

  beforeEach(() => {
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => error.mockRestore());

  // GOOGLE_OAUTH_ENABLED=false does not unregister the module — only editing
  // AuthModule does. The constructor log is the only thing that says so, and a
  // silent one leaves the provider live while the config claims it is off.
  it('complains when the module is registered with the provider disabled', () => {
    new GoogleModule(config(false));

    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toMatch(/remove it from AuthModule/i);
  });

  it('stays quiet when the provider is enabled', () => {
    new GoogleModule(config(true));

    expect(error).not.toHaveBeenCalled();
  });

  // Root rule 4: the client secret is a credential and never reaches a log.
  it('never writes the client secret into the warning', () => {
    new GoogleModule(config(false));

    expect(JSON.stringify(error.mock.calls)).not.toContain('a-client-secret');
  });
});
