import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { RequestExceptionFilter } from './request-exception.filter';
import { RequestException } from '../exception/core/ExceptionBase';
import { Exceptions } from '../exception/exceptions';
import { LoggerService } from '../observability/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../observability/logger/nest-adapter/nest-logger.adapter';
import { LogInput } from '../observability/logger/abstract/logger.interfaces';

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

type Captured = { status: jest.Mock; json: jest.Mock; host: ArgumentsHost };

const makeHost = (): Captured => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/orders' }),
    }),
  } as unknown as ArgumentsHost;
  return { status, json, host };
};

describe('RequestExceptionFilter', () => {
  let filter: RequestExceptionFilter;
  let logger: RecordingLogger;

  beforeEach(() => {
    logger = new RecordingLogger();
    filter = new RequestExceptionFilter(logger);
  });

  afterEach(() => jest.restoreAllMocks());

  it('never copies keys out of the exception payload into the body', () => {
    const { status, json, host } = makeHost();
    const leaky = new HttpException(
      {
        message: 'Something failed',
        query: 'SELECT * FROM users WHERE token = $1',
        stack: 'at PaymentService.charge (/srv/app/payment.ts:42)',
        upstreamApiKey: 'sk-live-should-never-ship',
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );

    filter.catch(leaky, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      statusCode: 500,
      message: 'Something failed',
    });
    expect(Object.keys(json.mock.calls[0][0])).toEqual([
      'success',
      'statusCode',
      'message',
    ]);
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('sk-live');
  });

  it('keeps the validation message array clients depend on', () => {
    const { status, json, host } = makeHost();

    filter.catch(
      new BadRequestException([
        'email must be an email',
        'name should not be empty',
      ]),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      statusCode: 400,
      message: ['email must be an email', 'name should not be empty'],
    });
  });

  it('preserves a RequestException status and message', () => {
    const { status, json, host } = makeHost();
    const exception = new RequestException(Exceptions.auth.invalidCredentials);

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(
      Exceptions.auth.invalidCredentials.httpStatus,
    );
    expect(json).toHaveBeenCalledWith({
      success: false,
      statusCode: Exceptions.auth.invalidCredentials.httpStatus,
      message: Exceptions.auth.invalidCredentials.errorMsg,
    });
  });

  it('answers a non-HttpException with a generic 500 and logs the detail', () => {
    const { status, json, host } = makeHost();
    const thrown = new TypeError(
      'connect ECONNREFUSED 10.0.0.7:5432 as user app_rw',
    );

    filter.catch(thrown, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
    });
    // Rule 5: the detail goes to the log, never to the client.
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('10.0.0.7');
    expect(logger.errors).toEqual([
      {
        message: 'unhandled exception',
        data: { kind: 'TypeError', method: 'POST', url: '/orders' },
        error: thrown,
      },
    ]);
  });

  describe('logger wiring', () => {
    it('tags its lines with its own context', () => {
      expect(logger.context).toBe('RequestExceptionFilter');
    });

    // The @Optional() injection is what keeps src/common/middleware/ liftable:
    // a project that copies it without LoggerAbstractModule still boots.
    it('falls back to a NestLoggerAdapter when no logger is injected', () => {
      expect(
        (new RequestExceptionFilter() as unknown as { logger: LoggerService })
          .logger,
      ).toBeInstanceOf(NestLoggerAdapter);
    });
  });

  it('answers a thrown non-Error without crashing the filter', () => {
    const { status, json, host } = makeHost();

    filter.catch('boom', host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
    });
  });
});
