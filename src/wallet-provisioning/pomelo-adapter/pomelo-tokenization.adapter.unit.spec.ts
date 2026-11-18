import { WALLET_PROVISIONING_ERRORS } from '../abstract/wallet-provisioning.error';
import { ResolvedCard } from '../abstract/wallet-provisioning.types';
import { PomeloAuthClient } from './pomelo-auth.client';
import { postJson } from './pomelo-http';
import { PomeloTokenizationAdapter } from './pomelo-tokenization.adapter';

jest.mock('./pomelo-http', () => ({
  ...jest.requireActual<typeof import('./pomelo-http')>('./pomelo-http'),
  postJson: jest.fn(),
}));

const mockedPost = postJson as jest.MockedFunction<typeof postJson>;
const config = {
  baseUrl: 'https://api.pomelo.example',
  requestTimeoutMs: 6500,
  mastercardApplePayPath: '/token-provisioning/mastercard/apple-pay',
  mastercardGooglePayPath: '/token-provisioning/v2/mastercard/google-pay',
  visaApplePayPath: '/token-provisioning/v2/visa/apple-pay',
};
const mastercard: ResolvedCard = {
  uuid: 'u',
  externalId: 'crd-1',
  lastFour: '1234',
  network: 'MASTERCARD',
  isActive: true,
};
const visa: ResolvedCard = { ...mastercard, network: 'VISA' };
const apple = {
  certificates: ['Q0VSVA=='],
  nonce: 'Tk9OQ0U=',
  nonceSignature: 'U0lH',
};

describe('PomeloTokenizationAdapter', () => {
  let auth: jest.Mocked<Pick<PomeloAuthClient, 'getToken' | 'invalidate'>>;
  let adapter: PomeloTokenizationAdapter;

  beforeEach(() => {
    mockedPost.mockReset();
    auth = {
      getToken: jest.fn().mockResolvedValue('tok'),
      invalidate: jest.fn(),
    };
    adapter = new PomeloTokenizationAdapter(
      config as never,
      auth as unknown as PomeloAuthClient,
    );
  });

  it('posts to the Mastercard Apple Pay route with the card external id and request', async () => {
    mockedPost.mockResolvedValue({
      status: 200,
      body: {
        data: {
          activation_data: 'A',
          encrypted_pass_data: 'E',
          ephemeral_public_key: 'K',
        },
      },
    });
    await expect(adapter.getApplePayData(mastercard, apple)).resolves.toEqual({
      activationData: 'A',
      encryptedPassData: 'E',
      ephemeralPublicKey: 'K',
    });
    expect(mockedPost).toHaveBeenCalledWith(
      'https://api.pomelo.example/token-provisioning/mastercard/apple-pay',
      {
        card_id: 'crd-1',
        certificates: ['Q0VSVA=='],
        nonce: 'Tk9OQ0U=',
        nonce_signature: 'U0lH',
      },
      { Authorization: 'Bearer tok' },
      6500,
    );
  });

  it('uses the Visa Apple Pay route for a Visa card', async () => {
    mockedPost.mockResolvedValue({
      status: 200,
      body: {
        data: {
          activation_data: 'A',
          encrypted_pass_data: 'E',
          ephemeral_public_key: 'K',
        },
      },
    });
    await adapter.getApplePayData(visa, apple);
    expect(mockedPost.mock.calls[0]?.[0]).toBe(
      'https://api.pomelo.example/token-provisioning/v2/visa/apple-pay',
    );
  });

  it('posts the server session id to the Mastercard Google Pay route and returns the OPCs unchanged', async () => {
    mockedPost.mockResolvedValue({
      status: 200,
      body: { data: { opc: 'OPC', google_opc: 'GOPC' } },
    });
    await expect(
      adapter.getGooglePayData(mastercard, { serverSessionId: 'SID' }),
    ).resolves.toEqual({
      opc: 'OPC',
      googleOpc: 'GOPC',
    });
    expect(mockedPost).toHaveBeenCalledWith(
      'https://api.pomelo.example/token-provisioning/v2/mastercard/google-pay',
      { card_id: 'crd-1', server_session_id: 'SID' },
      { Authorization: 'Bearer tok' },
      6500,
    );
  });

  it('throws UNSUPPORTED_NETWORK for Visa on Google Pay while no route is configured', async () => {
    await expect(
      adapter.getGooglePayData(visa, { serverSessionId: 'SID' }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: WALLET_PROVISIONING_ERRORS.UNSUPPORTED_NETWORK,
      }),
    );
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('throws PROVIDER_REQUEST_FAILED on a non-2xx without copying the response body into the error', async () => {
    mockedPost.mockResolvedValue({
      status: 400,
      body: { error: { details: 'nonce Tk9OQ0U= is invalid' } },
    });
    const error = (await adapter
      .getApplePayData(mastercard, apple)
      .catch((caught: unknown) => caught)) as Error;
    expect(error).toEqual(
      expect.objectContaining({
        code: WALLET_PROVISIONING_ERRORS.PROVIDER_REQUEST_FAILED,
        data: { cardExternalId: 'crd-1', status: 400 },
      }),
    );
    expect(JSON.stringify({ ...error, message: error.message })).not.toContain(
      'Tk9OQ0U=',
    );
  });

  it('drops the cached token when Pomelo answers 401', async () => {
    mockedPost.mockResolvedValue({ status: 401, body: null });
    await adapter
      .getGooglePayData(mastercard, { serverSessionId: 'SID' })
      .catch(() => undefined);
    expect(auth.invalidate).toHaveBeenCalled();
  });

  it('throws PROVIDER_REQUEST_FAILED when a 2xx has no data', async () => {
    mockedPost.mockResolvedValue({ status: 200, body: {} });
    await expect(
      adapter.getGooglePayData(mastercard, { serverSessionId: 'SID' }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: WALLET_PROVISIONING_ERRORS.PROVIDER_REQUEST_FAILED,
      }),
    );
  });
});
