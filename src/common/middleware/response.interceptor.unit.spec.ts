import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';
import { LoggerService } from '../observability/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../observability/logger/nest-adapter/nest-logger.adapter';
import { LogInput } from '../observability/logger/abstract/logger.interfaces';

class RecordingLogger extends LoggerService {
  readonly lines: LogInput[] = [];
  context = '';
  setContext(context: string): void {
    this.context = context;
  }

  log(input: LogInput): void {
    this.lines.push(input);
  }

  warn(): void {}
  error(): void {}
  debug(): void {}
}

type HostParts = {
  ctx: ExecutionContext;
  getHeader: jest.Mock;
};

const makeCtx = (
  overrides: {
    contentType?: string;
    request?: Record<string, unknown>;
    statusCode?: number;
  } = {},
): HostParts => {
  const getHeader = jest.fn(() => overrides.contentType);
  const ctx = {
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'GET',
        url: '/things',
        ip: '10.0.0.1',
        ...overrides.request,
      }),
      getResponse: () => ({
        getHeader,
        statusCode: overrides.statusCode ?? 200,
      }),
    }),
  } as unknown as ExecutionContext;
  return { ctx, getHeader };
};

const handlerOf = (value: unknown): CallHandler =>
  ({ handle: () => of(value) }) as CallHandler;

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor;
  let logger: RecordingLogger;

  beforeEach(() => {
    logger = new RecordingLogger();
    interceptor = new ResponseInterceptor(logger);
  });

  afterEach(() => jest.restoreAllMocks());

  const run = (value: unknown, ctx: ExecutionContext): Promise<unknown> =>
    lastValueFrom(interceptor.intercept(ctx, handlerOf(value)));

  it('wraps a plain payload in the success envelope', async () => {
    const { ctx } = makeCtx();

    await expect(run({ id: 1 }, ctx)).resolves.toEqual({
      success: true,
      data: { id: 1 },
    });
  });

  it('turns an empty handler return into an empty envelope', async () => {
    const { ctx } = makeCtx();

    await expect(run(undefined, ctx)).resolves.toEqual({
      success: true,
      data: {},
    });
  });

  it('leaves a payload that already carries `data` untouched', async () => {
    const { ctx } = makeCtx();
    const alreadyWrapped = { data: { id: 1 }, meta: { page: 1 } };

    await expect(run(alreadyWrapped, ctx)).resolves.toBe(alreadyWrapped);
  });

  // `@Html()` sets the header; wrapping that body would send JSON to a client
  // that was promised HTML.
  it('leaves an HTML response unwrapped', async () => {
    const { ctx } = makeCtx({ contentType: 'text/html; charset=utf-8' });

    await expect(run('<p>hi</p>', ctx)).resolves.toBe('<p>hi</p>');
  });

  it('wraps when the content type is not HTML', async () => {
    const { ctx } = makeCtx({ contentType: 'application/json' });

    await expect(run({ id: 1 }, ctx)).resolves.toEqual({
      success: true,
      data: { id: 1 },
    });
  });

  describe('access log', () => {
    it('writes one line per response, with the values in data', async () => {
      const { ctx } = makeCtx({ statusCode: 201 });

      await run({ id: 1 }, ctx);

      expect(logger.lines).toHaveLength(1);
      // Rule 2: the values are fields, not text interpolated into the message.
      expect(logger.lines[0].data).toEqual({
        method: 'GET',
        url: '/things',
        statusCode: 201,
        ip: '10.0.0.1',
        userId: null,
      });
    });

    it('records a null user id for an anonymous request', async () => {
      const { ctx } = makeCtx();

      await run({ id: 1 }, ctx);

      expect(logger.lines[0].data?.userId).toBeNull();
    });

    it('logs the user id when the request carries one', async () => {
      const { ctx } = makeCtx({ request: { user: { id: 'user-uuid' } } });

      await run({ id: 1 }, ctx);

      expect(logger.lines[0].data?.userId).toBe('user-uuid');
    });
  });

  describe('logger wiring', () => {
    it('tags its lines with its own context', () => {
      expect(logger.context).toBe('ResponseInterceptor');
    });

    // The @Optional() injection is what keeps src/common/middleware/ liftable:
    // a project that copies it without LoggerAbstractModule still boots.
    it('falls back to a NestLoggerAdapter when no logger is injected', () => {
      expect(
        (new ResponseInterceptor() as unknown as { logger: LoggerService })
          .logger,
      ).toBeInstanceOf(NestLoggerAdapter);
    });
  });
});
