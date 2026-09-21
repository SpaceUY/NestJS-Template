import { Logger } from '@nestjs/common';
import { adaptLogger } from './logger';

describe('adaptLogger', () => {
  const nestLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const adapted = (): ReturnType<typeof adaptLogger> =>
    adaptLogger(nestLogger as unknown as Logger);

  afterEach(() => jest.clearAllMocks());

  it('maps info onto the Nest log level', () => {
    adapted().info({ message: 'started' });

    expect(nestLogger.log).toHaveBeenCalledWith('started');
  });

  it.each([
    ['error', 'error'],
    ['warn', 'warn'],
    ['debug', 'debug'],
  ] as const)('maps %s onto the matching Nest level', (level, nestLevel) => {
    adapted()[level]({ message: 'something' });

    expect(nestLogger[nestLevel]).toHaveBeenCalledWith('something');
  });

  it('appends the data payload as JSON', () => {
    adapted().info({ message: 'connected', data: { responseTimeMs: 12 } });

    expect(nestLogger.log).toHaveBeenCalledWith(
      'connected - {"responseTimeMs":12}',
    );
  });

  it('leaves the message alone when data is empty or absent', () => {
    const logger = adapted();

    logger.info({ message: 'plain' });
    logger.info({ message: 'also plain', data: {} });

    expect(nestLogger.log).toHaveBeenNthCalledWith(1, 'plain');
    expect(nestLogger.log).toHaveBeenNthCalledWith(2, 'also plain');
  });

  it('falls back to a no-op setContext when the logger has none', () => {
    expect(() => adapted().setContext('CacheService')).not.toThrow();
  });

  it('uses the logger own setContext when it has one', () => {
    const setContext = jest.fn();

    adaptLogger({ ...nestLogger, setContext } as unknown as Logger).setContext(
      'CacheService',
    );

    expect(setContext).toHaveBeenCalledWith('CacheService');
  });
});
