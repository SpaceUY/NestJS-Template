import { LoggerService } from '../../common/observability/logger/abstract/logger.service';
import { CardResolver, UnconfiguredCardResolver } from './card-resolver';

const logger = (): jest.Mocked<LoggerService> =>
  ({
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }) as unknown as jest.Mocked<LoggerService>;

describe('UnconfiguredCardResolver', () => {
  it('returns null for both lookups', async () => {
    const resolver: CardResolver = new UnconfiguredCardResolver(logger());
    await expect(resolver.findForUser('user-uuid')).resolves.toBeNull();
    await expect(resolver.findByExternalId('crd-1')).resolves.toBeNull();
  });

  it('warns once that no resolver is configured', async () => {
    const log = logger();
    const resolver: CardResolver = new UnconfiguredCardResolver(log);
    await resolver.findForUser('user-uuid');
    await resolver.findByExternalId('crd-1');
    expect(log.warn).toHaveBeenCalledTimes(1);
  });
});
