import { WALLET_PROVISIONING_ERRORS } from '../abstract/wallet-provisioning.error';
import { postJson } from './pomelo-http';

describe('postJson', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    jest.useRealTimers();
  });

  it('posts JSON with the given headers and returns status and body', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }),
    );
    await expect(
      postJson('https://x/y', { a: 1 }, { Authorization: 'Bearer t' }, 6500),
    ).resolves.toEqual({
      status: 200,
      body: { data: { ok: true } },
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://x/y',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ a: 1 }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer t',
        },
      }),
    );
  });

  it('throws PROVIDER_TIMEOUT when the answer takes longer than the timeout', async () => {
    jest.useFakeTimers();
    fetchSpy.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const call = postJson('https://x/y', {}, {}, 6500);
    jest.advanceTimersByTime(6500);
    await expect(call).rejects.toEqual(
      expect.objectContaining({
        code: WALLET_PROVISIONING_ERRORS.PROVIDER_TIMEOUT,
      }),
    );
  });

  it('throws PROVIDER_REQUEST_FAILED on a network error, without its message', async () => {
    fetchSpy.mockRejectedValue(new Error('getaddrinfo ENOTFOUND secret-host'));
    const error = (await postJson('https://x/y', {}, {}, 6500).catch(
      (caught: unknown) => caught,
    )) as Error;
    expect(error).toEqual(
      expect.objectContaining({
        code: WALLET_PROVISIONING_ERRORS.PROVIDER_REQUEST_FAILED,
      }),
    );
    expect(error.message).not.toContain('secret-host');
  });

  it('returns a null body when the response is not JSON', async () => {
    fetchSpy.mockResolvedValue(new Response('<html>', { status: 502 }));
    await expect(postJson('https://x/y', {}, {}, 6500)).resolves.toEqual({
      status: 502,
      body: null,
    });
  });
});
