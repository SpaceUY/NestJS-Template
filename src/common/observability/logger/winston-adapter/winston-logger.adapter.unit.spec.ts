import { WinstonLoggerAdapter } from '../winston-logger.adapter';
import winston from 'winston';

jest.mock('winston', () => ({
  __esModule: true,
  default: {
    createLogger: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    })),
    transports: { Console: jest.fn() },
    format: {
      combine: jest.fn((...args: unknown[]) => ({ combined: args })),
      timestamp: jest.fn(() => 'timestamp-format'),
      json: jest.fn(() => 'json-format'),
    },
  },
}));

const mockedCreateLogger = jest.mocked(winston.createLogger);

function getInternalLogger(adapter: WinstonLoggerAdapter): jest.Mocked<{
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (adapter as any).winston as jest.Mocked<{
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
    debug: jest.Mock;
  }>;
}

describe('WinstonLoggerAdapter', () => {
  let adapter: WinstonLoggerAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new WinstonLoggerAdapter('TestContext');
  });

  it('should construct a winston logger with default transports and format', () => {
    expect(mockedCreateLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        transports: expect.any(Array),
      }),
    );
  });

  it('should spread caller options over the defaults', () => {
    const opts: winston.LoggerOptions = { level: 'debug' };
    const adapter = new WinstonLoggerAdapter('App', opts);
    expect(adapter).toBeInstanceOf(WinstonLoggerAdapter);
    expect(mockedCreateLogger).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'debug' }),
    );
  });

  describe('log', () => {
    it('should call winston.info with context and message', () => {
      adapter.log({ message: 'hello' });
      expect(getInternalLogger(adapter).info).toHaveBeenCalledWith({
        context: 'TestContext',
        message: 'hello',
      });
    });

    it('should merge data into the log object', () => {
      adapter.log({ message: 'hello', data: { userId: 42 } });
      expect(getInternalLogger(adapter).info).toHaveBeenCalledWith({
        context: 'TestContext',
        userId: 42,
        message: 'hello',
      });
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
    it('should call winston.warn', () => {
      adapter.warn({ message: 'careful' });
      expect(getInternalLogger(adapter).warn).toHaveBeenCalledWith({
        context: 'TestContext',
        message: 'careful',
      });
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
    it('should call winston.error', () => {
      adapter.error({ message: 'boom' });
      expect(getInternalLogger(adapter).error).toHaveBeenCalledWith({
        context: 'TestContext',
        message: 'boom',
      });
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
    it('should call winston.debug', () => {
      adapter.debug({ message: 'verbose' });
      expect(getInternalLogger(adapter).debug).toHaveBeenCalledWith({
        context: 'TestContext',
        message: 'verbose',
      });
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
      expect(getInternalLogger(adapter).info).toHaveBeenCalledWith({
        context: 'OtherContext',
        message: 'after set',
      });
    });
  });
});
