import { Logger } from '@nestjs/common';
import { NestLoggerAdapter } from './nest-logger.adapter';

jest.mock('@nestjs/common', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    context: 'App',
  })),
}));

describe('NestLoggerAdapter', () => {
  let adapter: NestLoggerAdapter;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new NestLoggerAdapter('TestContext');
    mockLogger = (adapter as any).logger;
  });

  describe('log', () => {
    it('should call logger.log with the message when data is empty', () => {
      adapter.log({ message: 'hello' });
      expect(mockLogger.log).toHaveBeenCalledWith('hello');
    });

    it('should call logger.log with message and serialized data', () => {
      adapter.log({ message: 'hello', data: { key: 'value' } });
      expect(mockLogger.log).toHaveBeenCalledWith('hello - {"key":"value"}');
    });

    it('should fire the telemetry hook with level "log"', () => {
      const hook = jest.fn();
      adapter.withTelemetry(hook);
      const input = { message: 'hello', data: { x: 1 } };
      adapter.log(input);
      expect(hook).toHaveBeenCalledWith('log', input, expect.any(String));
    });
  });

  describe('warn', () => {
    it('should call logger.warn', () => {
      adapter.warn({ message: 'careful' });
      expect(mockLogger.warn).toHaveBeenCalledWith('careful');
    });

    it('should fire the telemetry hook with level "warn"', () => {
      const hook = jest.fn();
      adapter.withTelemetry(hook);
      const input = { message: 'careful' };
      adapter.warn(input);
      expect(hook).toHaveBeenCalledWith('warn', input, expect.any(String));
    });
  });

  describe('error', () => {
    it('should call logger.error', () => {
      adapter.error({ message: 'boom' });
      expect(mockLogger.error).toHaveBeenCalledWith('boom');
    });

    it('should fire the telemetry hook with level "error"', () => {
      const hook = jest.fn();
      adapter.withTelemetry(hook);
      const input = { message: 'boom' };
      adapter.error(input);
      expect(hook).toHaveBeenCalledWith('error', input, expect.any(String));
    });
  });

  describe('debug', () => {
    it('should call logger.debug', () => {
      adapter.debug({ message: 'verbose' });
      expect(mockLogger.debug).toHaveBeenCalledWith('verbose');
    });

    it('should fire the telemetry hook with level "debug"', () => {
      const hook = jest.fn();
      adapter.withTelemetry(hook);
      const input = { message: 'verbose' };
      adapter.debug(input);
      expect(hook).toHaveBeenCalledWith('debug', input, expect.any(String));
    });
  });

  describe('setContext', () => {
    it('should update the underlying logger context', () => {
      adapter.setContext('NewContext');
      expect((adapter as any).logger.context).toBe('NewContext');
    });
  });

  describe('withTelemetry', () => {
    it('should return the same instance', () => {
      const returned = adapter.withTelemetry(jest.fn());
      expect(returned).toBe(adapter);
    });

    it('should not call the hook when not wired', () => {
      const hook = jest.fn();
      adapter.log({ message: 'no hook' });
      expect(hook).not.toHaveBeenCalled();
    });
  });
});
