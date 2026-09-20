import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { RequestExceptionFilter } from './request-exception.filter';
import { RequestException } from '../exception/core/ExceptionBase';
import { Exceptions } from '../exception/exceptions';

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

  beforeEach(() => {
    filter = new RequestExceptionFilter();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
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
    const logged = jest.spyOn(Logger.prototype, 'error');

    filter.catch(
      new TypeError('connect ECONNREFUSED 10.0.0.7:5432 as user app_rw'),
      host,
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      statusCode: 500,
      message: 'Internal server error',
    });
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('10.0.0.7');
    expect(logged).toHaveBeenCalledWith(
      'Unhandled TypeError on POST /orders',
      expect.stringContaining('TypeError'),
    );
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
