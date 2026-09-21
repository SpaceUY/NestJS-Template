import { Auth0Module } from './auth0.module';
import { Auth0ScopeConfig } from './config/auth0.scope';
import { NestLoggerAdapter } from '../../common/observability/logger/nest-adapter/nest-logger.adapter';
import { LoggerService } from '../../common/observability/logger/abstract/logger.service';
import { LogInput } from '../../common/observability/logger/abstract/logger.interfaces';

class RecordingLogger extends LoggerService {
  readonly errors: LogInput[] = [];
  context = '';
  setContext(context: string): void {
    this.context = context;
  }

  log(): void {}
  warn(): void {}
  error(input: LogInput): void {
    this.errors.push(input);
  }

  debug(): void {}
}

const config = (enabled: boolean): Auth0ScopeConfig => ({
  enabled,
  domain: 'example.auth0.com',
  audience: 'an-audience',
  issuer: 'https://example.auth0.com/',
});

describe('Auth0Module', () => {
  let logger: RecordingLogger;

  beforeEach(() => {
    logger = new RecordingLogger();
  });

  // AUTH0_ENABLED=false does not unregister the module — only editing
  // AuthModule does. The constructor log is the only thing that says so.
  it('complains when the module is registered with the provider disabled', () => {
    new Auth0Module(config(false), logger);

    expect(logger.errors).toHaveLength(1);
    expect(logger.errors[0].message).toMatch(/remove it from AuthModule/i);
    expect(logger.context).toBe('Auth0Module');
  });

  it('stays quiet when the provider is enabled', () => {
    new Auth0Module(config(true), logger);

    expect(logger.errors).toHaveLength(0);
  });

  // The logger is @Optional() so `src/auth/` lifts into a project that has not
  // registered LoggerAbstractModule; the warning still has to come out.
  it('still warns when no logger is injected', () => {
    const fallback = jest
      .spyOn(NestLoggerAdapter.prototype, 'error')
      .mockImplementation();

    new Auth0Module(config(false));

    expect(fallback).toHaveBeenCalledTimes(1);
    fallback.mockRestore();
  });
});
