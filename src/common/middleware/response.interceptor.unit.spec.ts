import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

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
  let logged: string[];

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
    logged = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message) => {
      logged.push(String(message));
    });
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
    it('writes one line per response with method, url and status', async () => {
      const { ctx } = makeCtx({ statusCode: 201 });

      await run({ id: 1 }, ctx);

      expect(logged).toHaveLength(1);
      expect(logged[0]).toContain('"GET /things HTTP/1.0" 201');
      expect(logged[0]).toContain('10.0.0.1');
    });

    it('marks an anonymous request with dashes instead of a user id', async () => {
      const { ctx } = makeCtx();

      await run({ id: 1 }, ctx);

      expect(logged[0]).toContain('10.0.0.1 - - [');
    });

    it('logs the user id when the request carries one', async () => {
      const { ctx } = makeCtx({ request: { user: { id: 'user-uuid' } } });

      await run({ id: 1 }, ctx);

      expect(logged[0]).toContain('user user-uuid');
    });
  });
});
