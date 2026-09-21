import { ConsoleAdapterService } from './console-adapter.service';
import { LoggerService } from '../../common/observability/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../common/observability/logger/nest-adapter/nest-logger.adapter';
import { LogInput } from '../../common/observability/logger/abstract/logger.interfaces';

const mockLogger = (): jest.Mocked<LoggerService> =>
  ({
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }) as unknown as jest.Mocked<LoggerService>;

describe('ConsoleAdapterService', () => {
  let logger: jest.Mocked<LoggerService>;
  let service: ConsoleAdapterService;

  beforeEach(() => {
    logger = mockLogger();
    service = new ConsoleAdapterService(logger);
  });

  // Rule 4: an adapter takes an optional logger and falls back to its own.
  it('falls back to a NestLoggerAdapter when no logger is injected', () => {
    expect(
      (new ConsoleAdapterService() as unknown as { logger: LoggerService })
        .logger,
    ).toBeInstanceOf(NestLoggerAdapter);
  });

  describe('capture', () => {
    it('logs the event instead of sending it anywhere', () => {
      service.capture({
        distinctId: 'user-1',
        event: 'signed_up',
        properties: { plan: 'free' },
      });

      const [input] = logger.log.mock.calls[0] as [LogInput];
      expect(input.data).toEqual({
        distinctId: 'user-1',
        event: 'signed_up',
        properties: { plan: 'free' },
      });
      // The message has to say the event went nowhere: a console adapter that
      // reads like a real one in the log is how a project ships with analytics
      // silently disabled.
      expect(input.message).toMatch(/not sent/i);
    });

    // Rule 2: capture() is fire-and-forget and never throws at the caller.
    it('returns undefined rather than a promise', () => {
      expect(
        service.capture({ distinctId: 'user-1', event: 'signed_up' }),
      ).toBeUndefined();
    });
  });

  describe('feature flags', () => {
    it('always resolves isFeatureEnabled to false', async () => {
      await expect(service.isFeatureEnabled('new-ui', 'user-1')).resolves.toBe(
        false,
      );

      const [input] = logger.debug.mock.calls[0] as [LogInput];
      expect(input.data).toEqual({ key: 'new-ui', distinctId: 'user-1' });
    });

    it('always resolves getFeatureFlag to undefined', async () => {
      await expect(
        service.getFeatureFlag('new-ui', 'user-1'),
      ).resolves.toBeUndefined();

      expect(logger.debug).toHaveBeenCalled();
    });
  });
});
