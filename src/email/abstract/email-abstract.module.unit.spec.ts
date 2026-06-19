import { EmailAbstractModule } from './email-abstract.module';
import { EmailService } from './email.service';
import { LoggerService } from '../../common/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../common/logger/nest-adapter/nest-logger.adapter';
import {
  MailingResponse,
  SendRenderedEmailMultipleParams,
  SendRenderedEmailParams,
} from './email.interface';

class MockEmailAdapter extends EmailService {
  async sendEmail(_: SendRenderedEmailParams): Promise<MailingResponse> {
    return { statusCode: 200, body: {}, headers: {} };
  }

  async sendEmailBatch(
    _: SendRenderedEmailMultipleParams,
  ): Promise<MailingResponse> {
    return { statusCode: 200, body: {}, headers: {} };
  }
}

const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
  withTelemetry: jest.fn(),
} as unknown as LoggerService;

type ForRootProvider = {
  provide: unknown;
  inject: unknown[];
  useFactory: (...args: unknown[]) => EmailService;
};

type ForRootAsyncProvider = {
  provide: unknown;
  inject: unknown[];
  useFactory: (...args: unknown[]) => Promise<EmailService>;
};

describe('EmailAbstractModule', () => {
  describe('forRoot', () => {
    it('should create an adapter instance via factory', () => {
      const moduleRef = EmailAbstractModule.forRoot({
        adapter: MockEmailAdapter,
        isGlobal: true,
      });

      const provider = (moduleRef.providers as ForRootProvider[]).find(
        (p) => p.provide === EmailService,
      );

      const instance = provider?.useFactory(undefined);

      expect(moduleRef.module).toBe(EmailAbstractModule);
      expect(moduleRef.global).toBe(true);
      expect(instance).toBeInstanceOf(MockEmailAdapter);
      expect(provider?.inject).toEqual([
        { token: LoggerService, optional: true },
      ]);
      expect(moduleRef.exports).toContain(EmailService);
    });

    it('should call setLogger when a logger is provided', () => {
      const moduleRef = EmailAbstractModule.forRoot({
        adapter: MockEmailAdapter,
      });

      const provider = (moduleRef.providers as ForRootProvider[]).find(
        (p) => p.provide === EmailService,
      );

      const instance = provider?.useFactory(mockLogger) as MockEmailAdapter;

      expect((instance as any).logger).toBe(mockLogger);
    });

    it('should use NestLoggerAdapter as fallback when no logger is provided', () => {
      const moduleRef = EmailAbstractModule.forRoot({
        adapter: MockEmailAdapter,
      });

      const provider = (moduleRef.providers as ForRootProvider[]).find(
        (p) => p.provide === EmailService,
      );

      const instance = provider?.useFactory(undefined) as MockEmailAdapter;

      expect((instance as any).logger).toBeInstanceOf(NestLoggerAdapter);
    });
  });

  describe('forRootAsync', () => {
    it('should bind a factory-returned instance to EmailService', async () => {
      const emailInstance = new MockEmailAdapter();
      const dependencyToken = 'TEST_DEP';
      const dependencyValue = 'dep-value';

      const moduleRef = EmailAbstractModule.forRootAsync({
        inject: [dependencyToken],
        useFactory: async (val: string) => {
          expect(val).toBe(dependencyValue);
          return emailInstance;
        },
        isGlobal: true,
      });

      const provider = (moduleRef.providers as ForRootAsyncProvider[]).find(
        (p) => p.provide === EmailService,
      );

      const resolved = await provider?.useFactory(undefined, dependencyValue);

      expect(moduleRef.global).toBe(true);
      expect(provider?.inject).toEqual([
        { token: LoggerService, optional: true },
        dependencyToken,
      ]);
      expect(resolved).toBe(emailInstance);
      expect(moduleRef.exports).toContain(EmailService);
    });

    it('should call setLogger when a logger is provided', async () => {
      const emailInstance = new MockEmailAdapter();

      const moduleRef = EmailAbstractModule.forRootAsync({
        useFactory: async () => emailInstance,
      });

      const provider = (moduleRef.providers as ForRootAsyncProvider[]).find(
        (p) => p.provide === EmailService,
      );

      await provider?.useFactory(mockLogger);

      expect((emailInstance as any).logger).toBe(mockLogger);
    });

    it('should use NestLoggerAdapter as fallback when no logger is provided', async () => {
      const emailInstance = new MockEmailAdapter();

      const moduleRef = EmailAbstractModule.forRootAsync({
        useFactory: async () => emailInstance,
      });

      const provider = (moduleRef.providers as ForRootAsyncProvider[]).find(
        (p) => p.provide === EmailService,
      );

      await provider?.useFactory(undefined);

      expect((emailInstance as any).logger).toBeInstanceOf(NestLoggerAdapter);
    });
  });
});
