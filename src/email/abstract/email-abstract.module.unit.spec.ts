import { Test } from '@nestjs/testing';
import { EmailAbstractModule } from './email-abstract.module';
import { EmailService } from './email.service';
import { MailingResponse } from './email.interface';
import { LoggerService } from '../../common/observability/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../common/observability/logger/nest-adapter/nest-logger.adapter';
import { LoggerAbstractModule } from '../../common/observability/logger/abstract/logger-abstract.module';

class MockEmailAdapter extends EmailService {
  async sendEmail(): Promise<MailingResponse> {
    return { statusCode: 200, body: {}, headers: {} };
  }

  async sendEmailBatch(): Promise<MailingResponse> {
    return { statusCode: 200, body: {}, headers: {} };
  }

  // `logger` is protected on EmailService; this keeps the assertions honest
  // without casting the instance to `any`.
  exposeLogger(): LoggerService {
    return this.logger;
  }
}

/** Captures the context `setLogger` assigns, so tests can assert on it. */
class RecordingLogger extends LoggerService {
  context = '';

  setContext(context: string): void {
    this.context = context;
  }

  log(): void {}
  warn(): void {}
  error(): void {}
  debug(): void {}
}

type SyncProvider = {
  provide: unknown;
  inject: unknown[];
  useFactory: (logger?: LoggerService) => EmailService;
};

type AsyncProvider = {
  provide: unknown;
  inject: unknown[];
  useFactory: (...args: unknown[]) => Promise<EmailService>;
};

describe('EmailAbstractModule', () => {
  describe('forRoot', () => {
    it('instantiates the adapter and exposes it under the EmailService token', () => {
      const moduleRef = EmailAbstractModule.forRoot({
        adapter: MockEmailAdapter,
        isGlobal: true,
      });

      const provider = (moduleRef.providers as SyncProvider[]).find(
        (p) => p.provide === EmailService,
      );

      expect(moduleRef.module).toBe(EmailAbstractModule);
      expect(moduleRef.global).toBe(true);
      expect(moduleRef.exports).toContain(EmailService);
      expect(provider?.inject).toEqual([
        { token: LoggerService, optional: true },
      ]);
      expect(provider?.useFactory()).toBeInstanceOf(MockEmailAdapter);
    });

    it('hands the injected logger to the adapter, re-tagged with the adapter class name', () => {
      const moduleRef = EmailAbstractModule.forRoot({
        adapter: MockEmailAdapter,
      });

      const provider = (moduleRef.providers as SyncProvider[]).find(
        (p) => p.provide === EmailService,
      );

      const injected = new RecordingLogger();
      const instance = provider?.useFactory(injected) as MockEmailAdapter;

      expect(instance.exposeLogger()).toBe(injected);
      expect(injected.context).toBe('MockEmailAdapter');
    });

    it('falls back to the adapter default logger when LoggerService is unavailable', () => {
      const moduleRef = EmailAbstractModule.forRoot({
        adapter: MockEmailAdapter,
      });

      const provider = (moduleRef.providers as SyncProvider[]).find(
        (p) => p.provide === EmailService,
      );

      const instance = provider?.useFactory(undefined) as MockEmailAdapter;

      expect(instance.exposeLogger()).toBeInstanceOf(NestLoggerAdapter);
    });
  });

  describe('forRootAsync', () => {
    it('prepends the optional logger to inject without disturbing the caller tokens', () => {
      const moduleRef = EmailAbstractModule.forRootAsync({
        inject: ['TOKEN_A', 'TOKEN_B'],
        useFactory: () => new MockEmailAdapter(),
      });

      const provider = (moduleRef.providers as AsyncProvider[]).find(
        (p) => p.provide === EmailService,
      );

      expect(provider?.inject).toEqual([
        { token: LoggerService, optional: true },
        'TOKEN_A',
        'TOKEN_B',
      ]);
    });

    it('passes the caller tokens to the user factory shifted past the logger', async () => {
      const seen: unknown[] = [];

      const moduleRef = EmailAbstractModule.forRootAsync({
        inject: ['TOKEN_A', 'TOKEN_B'],
        useFactory: (a: unknown, b: unknown) => {
          seen.push(a, b);
          return new MockEmailAdapter();
        },
      });

      const provider = (moduleRef.providers as AsyncProvider[]).find(
        (p) => p.provide === EmailService,
      );

      const injected = new RecordingLogger();
      const instance = (await provider?.useFactory(
        injected,
        'value-a',
        'value-b',
      )) as MockEmailAdapter;

      expect(seen).toEqual(['value-a', 'value-b']);
      expect(instance.exposeLogger()).toBe(injected);
      expect(injected.context).toBe('MockEmailAdapter');
    });

    it('awaits an async user factory before wiring the logger', async () => {
      const moduleRef = EmailAbstractModule.forRootAsync({
        useFactory: async () => {
          await Promise.resolve();
          return new MockEmailAdapter();
        },
      });

      const provider = (moduleRef.providers as AsyncProvider[]).find(
        (p) => p.provide === EmailService,
      );

      const injected = new RecordingLogger();
      const instance = (await provider?.useFactory(
        injected,
      )) as MockEmailAdapter;

      expect(instance).toBeInstanceOf(MockEmailAdapter);
      expect(instance.exposeLogger()).toBe(injected);
    });

    it('leaves the adapter default logger in place when LoggerService is unavailable', async () => {
      const moduleRef = EmailAbstractModule.forRootAsync({
        useFactory: () => new MockEmailAdapter(),
      });

      const provider = (moduleRef.providers as AsyncProvider[]).find(
        (p) => p.provide === EmailService,
      );

      const instance = (await provider?.useFactory(
        undefined,
      )) as MockEmailAdapter;

      expect(instance.exposeLogger()).toBeInstanceOf(NestLoggerAdapter);
    });
  });

  // The blocks above call useFactory by hand, which cannot prove that Nest
  // actually resolves the optional token or that the inject-to-parameter
  // mapping survives the container. These two boot a real container.
  describe('resolved through a real Nest container', () => {
    it('receives the container LoggerService when one is registered', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          LoggerAbstractModule.forRoot({
            adapter: NestLoggerAdapter,
            isGlobal: true,
          }),
          EmailAbstractModule.forRootAsync({
            useFactory: () => new MockEmailAdapter(),
          }),
        ],
      }).compile();

      const email = moduleRef.get<MockEmailAdapter>(EmailService);
      const logger = email.exposeLogger() as NestLoggerAdapter;

      expect(logger).toBeInstanceOf(NestLoggerAdapter);
      // Proves setLogger ran against the container instance rather than the
      // field default: only setLogger re-tags the context.
      expect((logger as unknown as { context: string }).context).toBe(
        'MockEmailAdapter',
      );

      await moduleRef.close();
    });

    it('still resolves when no LoggerService is registered at all', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          EmailAbstractModule.forRootAsync({
            useFactory: () => new MockEmailAdapter(),
          }),
        ],
      }).compile();

      const email = moduleRef.get<MockEmailAdapter>(EmailService);

      expect(email).toBeInstanceOf(MockEmailAdapter);
      expect(email.exposeLogger()).toBeInstanceOf(NestLoggerAdapter);

      await moduleRef.close();
    });
  });
});
