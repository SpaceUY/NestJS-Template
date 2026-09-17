import { PinoLoggerAdapter } from '../pino-logger.adapter';

const mockPinoInstance = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('pino', () => {
  const factory = jest.fn(() => mockPinoInstance);
  return { __esModule: true, default: factory };
});

import pino from 'pino';
const mockedPinoFactory = jest.mocked(pino);

describe('PinoLoggerAdapter', () => {
  let adapter: PinoLoggerAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new PinoLoggerAdapter('TestContext');
  });

  it('should construct a pino instance with the provided options', () => {
    const opts = { level: 'debug' };
    const adapter = new PinoLoggerAdapter('App', opts);
    expect(adapter).toBeInstanceOf(PinoLoggerAdapter);
    expect(mockedPinoFactory).toHaveBeenCalledWith(opts);
  });

  describe('log', () => {
    it('should call pino.info with context and message', () => {
      adapter.log({ message: 'hello' });
      expect(mockPinoInstance.info).toHaveBeenCalledWith(
        { context: 'TestContext' },
        'hello',
      );
    });

    it('should merge data into the pino object', () => {
      adapter.log({ message: 'hello', data: { userId: 42 } });
      expect(mockPinoInstance.info).toHaveBeenCalledWith(
        { context: 'TestContext', userId: 42 },
        'hello',
      );
    });

    it('should fire the telemetry hook with level "log"', () => {
      const hook = jest.fn();
      adapter.withTelemetry(hook);
      const input = { message: 'hello' };
      adapter.log(input);
      expect(hook).toHaveBeenCalledWith('log', input, 'TestContext');
    });
  });

  describe('warn', () => {
    it('should call pino.warn', () => {
      adapter.warn({ message: 'careful' });
      expect(mockPinoInstance.warn).toHaveBeenCalledWith(
        { context: 'TestContext' },
        'careful',
      );
    });

    it('should fire the telemetry hook with level "warn"', () => {
      const hook = jest.fn();
      adapter.withTelemetry(hook);
      const input = { message: 'careful' };
      adapter.warn(input);
      expect(hook).toHaveBeenCalledWith('warn', input, 'TestContext');
    });
  });

  describe('error', () => {
    it('should call pino.error', () => {
      adapter.error({ message: 'boom' });
      expect(mockPinoInstance.error).toHaveBeenCalledWith(
        { context: 'TestContext' },
        'boom',
      );
    });

    it('should fire the telemetry hook with level "error"', () => {
      const hook = jest.fn();
      adapter.withTelemetry(hook);
      const input = { message: 'boom' };
      adapter.error(input);
      expect(hook).toHaveBeenCalledWith('error', input, 'TestContext');
    });
  });

  describe('debug', () => {
    it('should call pino.debug', () => {
      adapter.debug({ message: 'verbose' });
      expect(mockPinoInstance.debug).toHaveBeenCalledWith(
        { context: 'TestContext' },
        'verbose',
      );
    });

    it('should fire the telemetry hook with level "debug"', () => {
      const hook = jest.fn();
      adapter.withTelemetry(hook);
      const input = { message: 'verbose' };
      adapter.debug(input);
      expect(hook).toHaveBeenCalledWith('debug', input, 'TestContext');
    });
  });

  describe('setContext', () => {
    it('should affect the context passed to subsequent calls', () => {
      adapter.setContext('OtherContext');
      adapter.log({ message: 'after set' });
      expect(mockPinoInstance.info).toHaveBeenCalledWith(
        { context: 'OtherContext' },
        'after set',
      );
    });
  });
});
