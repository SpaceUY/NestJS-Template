import { WALLET_PROVISIONING_ERRORS } from '../abstract/wallet-provisioning.error';
import { PomeloAuthClient } from './pomelo-auth.client';
import { postJson } from './pomelo-http';

jest.mock('./pomelo-http', () => ({
  ...jest.requireActual<typeof import('./pomelo-http')>('./pomelo-http'),
  postJson: jest.fn(),
}));

const mockedPost = postJson as jest.MockedFunction<typeof postJson>;
const config = {
  baseUrl: 'https://api.pomelo.example',
  clientId: 'client',
  clientSecret: 'secret',
  audience: 'aud',
  requestTimeoutMs: 6500,
};

describe('PomeloAuthClient', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-18T12:00:00Z'));
    mockedPost.mockReset();
  });

  afterEach(() => jest.useRealTimers());

  it('asks for a client-credentials token', async () => {
    mockedPost.mockResolvedValue({
      status: 200,
      body: { access_token: 'tok', expires_in: 3600 },
    });
    await expect(
      new PomeloAuthClient(config as never).getToken(),
    ).resolves.toBe('tok');
    expect(mockedPost).toHaveBeenCalledWith(
      'https://api.pomelo.example/oauth/token',
      {
        client_id: 'client',
        client_secret: 'secret',
        audience: 'aud',
        grant_type: 'client_credentials',
      },
      {},
      6500,
    );
  });

  it('reuses a cached token until shortly before expiry', async () => {
    mockedPost
      .mockResolvedValueOnce({
        status: 200,
        body: { access_token: 'first', expires_in: 3600 },
      })
      .mockResolvedValueOnce({
        status: 200,
        body: { access_token: 'second', expires_in: 3600 },
      });
    const client = new PomeloAuthClient(config as never);
    await client.getToken();
    jest.advanceTimersByTime(3600_000 - 61_000);
    await expect(client.getToken()).resolves.toBe('first');
    jest.advanceTimersByTime(2_000);
    await expect(client.getToken()).resolves.toBe('second');
  });

  it('forgets the token when invalidated', async () => {
    mockedPost.mockResolvedValue({
      status: 200,
      body: { access_token: 'tok', expires_in: 3600 },
    });
    const client = new PomeloAuthClient(config as never);
    await client.getToken();
    client.invalidate();
    await client.getToken();
    expect(mockedPost).toHaveBeenCalledTimes(2);
  });

  it('throws PROVIDER_AUTH_FAILED when the token call fails', async () => {
    mockedPost.mockResolvedValue({
      status: 401,
      body: { error: 'access_denied' },
    });
    await expect(
      new PomeloAuthClient(config as never).getToken(),
    ).rejects.toEqual(
      expect.objectContaining({
        code: WALLET_PROVISIONING_ERRORS.PROVIDER_AUTH_FAILED,
        data: { status: 401 },
      }),
    );
  });

  it('uses the time budget it is given for the token call', async () => {
    mockedPost.mockResolvedValue({
      status: 200,
      body: { access_token: 'tok', expires_in: 3600 },
    });
    await new PomeloAuthClient(config as never).getToken(1200);
    expect(mockedPost.mock.calls[0]?.[3]).toBe(1200);
  });
});
