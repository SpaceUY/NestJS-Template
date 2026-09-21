import { PostHog } from 'posthog-node';
import { PosthogAdapterService } from './posthog-adapter.service';
import { LoggerService } from '../../common/observability/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../common/observability/logger/nest-adapter/nest-logger.adapter';
import { LogInput } from '../../common/observability/logger/abstract/logger.interfaces';

const client = {
  capture: jest.fn(),
  isFeatureEnabled: jest.fn(),
  getFeatureFlag: jest.fn(),
  shutdown: jest.fn(),
};

jest.mock('posthog-node', () => ({
  PostHog: jest.fn().mockImplementation(() => client),
}));

const MockedPostHog = PostHog as unknown as jest.Mock;

const mockLogger = (): jest.Mocked<LoggerService> =>
  ({
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }) as unknown as jest.Mocked<LoggerService>;

const config = { apiKey: 'phc_test_key', host: 'https://posthog.local' };

describe('PosthogAdapterService', () => {
  let logger: jest.Mocked<LoggerService>;
  let service: PosthogAdapterService;

  beforeEach(() => {
    jest.clearAllMocks();
    client.isFeatureEnabled.mockResolvedValue(true);
    client.getFeatureFlag.mockResolvedValue('variant-a');
    client.shutdown.mockResolvedValue(undefined);
    logger = mockLogger();
    service = new PosthogAdapterService(config, logger);
  });

  it('builds its client from the adapter config', () => {
    expect(MockedPostHog).toHaveBeenCalledWith('phc_test_key', {
      host: 'https://posthog.local',
    });
  });

  // Rule 4: an adapter takes an optional logger and falls back to its own.
  it('falls back to a NestLoggerAdapter when no logger is injected', () => {
    expect(
      (
        new PosthogAdapterService(config) as unknown as {
          logger: LoggerService;
        }
      ).logger,
    ).toBeInstanceOf(NestLoggerAdapter);
  });

  describe('capture', () => {
    it('forwards the event to the client', () => {
      service.capture({
        distinctId: 'user-1',
        event: 'signed_up',
        properties: { plan: 'pro' },
      });

      expect(client.capture).toHaveBeenCalledWith({
        distinctId: 'user-1',
        event: 'signed_up',
        properties: { plan: 'pro' },
      });
    });

    // Rule 2: capture() is fire-and-forget — a provider outage must not
    // surface in the caller's code path.
    it('swallows a client failure and logs it', () => {
      client.capture.mockImplementation(() => {
        throw new Error('posthog is down');
      });

      expect(() =>
        service.capture({ distinctId: 'user-1', event: 'signed_up' }),
      ).not.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });

    // Rule 4 of the root guide: no secret in a log line. The API key is one.
    it('never writes the API key into the failure log', () => {
      client.capture.mockImplementation(() => {
        throw new Error('posthog is down');
      });

      service.capture({ distinctId: 'user-1', event: 'signed_up' });

      const [input] = logger.error.mock.calls[0] as [LogInput];
      expect(JSON.stringify(input)).not.toContain('phc_test_key');
    });
  });

  describe('isFeatureEnabled', () => {
    it('returns what the client answers', async () => {
      await expect(service.isFeatureEnabled('new-ui', 'user-1')).resolves.toBe(
        true,
      );
      expect(client.isFeatureEnabled).toHaveBeenCalledWith('new-ui', 'user-1');
    });

    // An unknown flag is false, not undefined: callers branch on a boolean.
    it('falls back to false and notes it when the flag is unknown', async () => {
      client.isFeatureEnabled.mockResolvedValue(undefined);

      await expect(service.isFeatureEnabled('new-ui', 'user-1')).resolves.toBe(
        false,
      );
      expect(logger.debug).toHaveBeenCalled();
    });

    it('falls back to false when the client throws', async () => {
      client.isFeatureEnabled.mockRejectedValue(new Error('timeout'));

      await expect(service.isFeatureEnabled('new-ui', 'user-1')).resolves.toBe(
        false,
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getFeatureFlag', () => {
    it('returns the variant the client answers', async () => {
      await expect(service.getFeatureFlag('new-ui', 'user-1')).resolves.toBe(
        'variant-a',
      );
    });

    it('resolves undefined and notes it when the flag is unknown', async () => {
      client.getFeatureFlag.mockResolvedValue(undefined);

      await expect(
        service.getFeatureFlag('new-ui', 'user-1'),
      ).resolves.toBeUndefined();
      expect(logger.debug).toHaveBeenCalled();
    });

    it('resolves undefined when the client throws', async () => {
      client.getFeatureFlag.mockRejectedValue(new Error('timeout'));

      await expect(
        service.getFeatureFlag('new-ui', 'user-1'),
      ).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // Rule 5: the buffer has to flush before the process goes away, so the hook
  // must await shutdown rather than fire it off.
  describe('onModuleDestroy', () => {
    it('awaits the client shutdown', async () => {
      let flushed = false;
      client.shutdown.mockImplementation(
        () =>
          new Promise<void>((resolve) =>
            setImmediate(() => {
              flushed = true;
              resolve();
            }),
          ),
      );

      await service.onModuleDestroy();

      expect(flushed).toBe(true);
    });
  });
});
