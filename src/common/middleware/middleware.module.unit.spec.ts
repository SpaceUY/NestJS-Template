import { Controller, Get, INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RequestException } from '../exception/core/ExceptionBase';
import { Exceptions } from '../exception/exceptions';
import { MiddlewareModule } from './middleware.module';

@Controller('things')
class ThingsController {
  @Get('ok')
  ok(): { id: number } {
    return { id: 1 };
  }

  @Get('known-failure')
  knownFailure(): never {
    throw new RequestException(Exceptions.auth.invalidCredentials);
  }

  @Get('unknown-failure')
  unknownFailure(): never {
    throw new Error('connection to the widget factory lost');
  }
}

// MiddlewareModule is the only thing that registers the interceptor and the
// filter globally. Both units have their own specs; this one proves the module
// actually binds them, which no unit test can.
describe('MiddlewareModule', () => {
  let app: INestApplication;

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    const moduleRef = await Test.createTestingModule({
      imports: [MiddlewareModule],
      controllers: [ThingsController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app.close();
  });

  it('envelopes a successful response', async () => {
    const res = await request(app.getHttpServer()).get('/things/ok');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { id: 1 } });
  });

  it('answers a RequestException with its own status and message', async () => {
    const res = await request(app.getHttpServer()).get('/things/known-failure');

    expect(res.status).toBe(Exceptions.auth.invalidCredentials.httpStatus);
    expect(res.body).toEqual({
      success: false,
      statusCode: Exceptions.auth.invalidCredentials.httpStatus,
      message: Exceptions.auth.invalidCredentials.errorMsg,
    });
  });

  it('answers an unexpected failure with 500 and no internal detail', async () => {
    const res = await request(app.getHttpServer()).get(
      '/things/unknown-failure',
    );

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain('widget factory');
  });
});
