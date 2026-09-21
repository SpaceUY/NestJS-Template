import { GoogleModule } from './google.module';
import { GoogleScopeConfig } from './config/google.scope';
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

const config = (enabled: boolean): GoogleScopeConfig => ({
  enabled,
  clientId: 'a-client-id',
  clientSecret: 'a-client-secret',
  audience: 'an-audience',
  callbackUrl: 'http://localhost:3000/auth/google/callback',
  selfUrl: 'http://localhost:3000',
});

describe('GoogleModule', () => {
  let logger: RecordingLogger;

  beforeEach(() => {
    logger = new RecordingLogger();
  });

  // GOOGLE_OAUTH_ENABLED=false does not unregister the module — only editing
  // AuthModule does. The constructor log is the only thing that says so, and a
  // silent one leaves the provider live while the config claims it is off.
  it('complains when the module is registered with the provider disabled', () => {
    new GoogleModule(config(false), logger);

    expect(logger.errors).toHaveLength(1);
    expect(logger.errors[0].message).toMatch(/remove it from AuthModule/i);
    expect(logger.context).toBe('GoogleModule');
  });

  it('stays quiet when the provider is enabled', () => {
    new GoogleModule(config(true), logger);

    expect(logger.errors).toHaveLength(0);
  });

  // Root rule 4: the client secret is a credential and never reaches a log.
  it('never writes the client secret into the warning', () => {
    new GoogleModule(config(false), logger);

    expect(JSON.stringify(logger.errors)).not.toContain('a-client-secret');
  });

  // The logger is @Optional() so `src/auth/` lifts into a project that has not
  // registered LoggerAbstractModule; the warning still has to come out.
  it('still warns when no logger is injected', () => {
    const fallback = jest
      .spyOn(NestLoggerAdapter.prototype, 'error')
      .mockImplementation();

    new GoogleModule(config(false));

    expect(fallback).toHaveBeenCalledTimes(1);
    fallback.mockRestore();
  });
});
