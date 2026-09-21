import { Controller, Get, INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RequestException } from '../exception/core/ExceptionBase';
import { Exceptions } from '../exception/exceptions';
import { MiddlewareModule } from './middleware.module';
import { LoggerAbstractModule } from '../observability/logger/abstract/logger-abstract.module';
import { LoggerService } from '../observability/logger/abstract/logger.service';
import { LogInput } from '../observability/logger/abstract/logger.interfaces';

const written: LogInput[] = [];

class RecordingLogger extends LoggerService {
  setContext(): void {}
  log(input: LogInput): void {
    written.push(input);
  }

  warn(): void {}
  error(input: LogInput): void {
    written.push(input);
  }

  debug(): void {}
}

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
//
// It also boots with no LoggerAbstractModule registered, which is the case a
// project copying src/common/middleware/ on its own lands in: the @Optional()
// injection in both classes has to resolve to nothing without failing the
// container. The block at the bottom covers the other half.
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

// The other half of rule 6: when the container does have a LoggerService, the
// interceptor and the filter must get *that* one — it is what carries the
// trace id and the telemetry hook — not their own fallback adapter.
describe('MiddlewareModule with a registered LoggerService', () => {
  let app: INestApplication;

  beforeAll(async () => {
    written.length = 0;

    const moduleRef = await Test.createTestingModule({
      imports: [
        LoggerAbstractModule.forRoot({
          adapter: RecordingLogger,
          isGlobal: true,
        }),
        MiddlewareModule,
      ],
      controllers: [ThingsController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('routes the access log through the container logger', async () => {
    await request(app.getHttpServer()).get('/things/ok');

    expect(
      written.find((line) => line.message === 'request handled')?.data,
    ).toMatchObject({ method: 'GET', url: '/things/ok', statusCode: 200 });
  });

  it('routes the unhandled-exception log through the container logger', async () => {
    await request(app.getHttpServer()).get('/things/unknown-failure');

    const entry = written.find(
      (line) => line.message === 'unhandled exception',
    );
    expect(entry?.data).toMatchObject({ kind: 'Error', method: 'GET' });
  });
});
