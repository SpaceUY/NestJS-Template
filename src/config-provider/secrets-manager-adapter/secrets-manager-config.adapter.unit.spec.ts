import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { SecretsManagerConfigAdapter } from './secrets-manager-config.adapter';
import { ConfigProviderError, CONFIG_PROVIDER_ERRORS } from '../abstract/config-provider.error';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: jest
    .fn()
    .mockImplementation(() => ({ send: mockSend })),
  GetSecretValueCommand: jest.fn().mockImplementation((input) => input),
}));

function makeAdapter(
  overrides: Partial<
    ConstructorParameters<typeof SecretsManagerConfigAdapter>[0]
  > = {},
): SecretsManagerConfigAdapter {
  return new SecretsManagerConfigAdapter({
    secretName: 'test/secret',
    region: 'us-east-1',
    ...overrides,
  });
}

function mockSecret(values: Record<string, string>): void {
  mockSend.mockResolvedValue({ SecretString: JSON.stringify(values) });
}

describe('SecretsManagerConfigAdapter', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('loading', () => {
    it('fetches and parses the secret on first read', async () => {
      mockSecret({ DB_URL: 'postgres://localhost' });
      const adapter = makeAdapter();

      expect(await adapter.get('DB_URL')).toBe('postgres://localhost');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('uses cached secret on subsequent reads by default', async () => {
      mockSecret({ DB_URL: 'postgres://localhost' });
      const adapter = makeAdapter();

      await adapter.get('DB_URL');
      await adapter.get('DB_URL');

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('re-fetches on every read when cacheSecret is false', async () => {
      mockSecret({ DB_URL: 'postgres://localhost' });
      const adapter = makeAdapter({ cacheSecret: false });

      await adapter.get('DB_URL');
      await adapter.get('DB_URL');

      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('falls back to empty object when SecretString is absent', async () => {
      mockSend.mockResolvedValue({ SecretString: undefined });
      const adapter = makeAdapter();

      expect(await adapter.get('ANYTHING')).toBeUndefined();
    });

    it('passes explicit credentials to the SDK client', () => {
      makeAdapter({ accessKeyId: 'key-id', secretAccessKey: 'key-secret' });

      expect(SecretsManagerClient).toHaveBeenCalledWith(
        expect.objectContaining({
          credentials: { accessKeyId: 'key-id', secretAccessKey: 'key-secret' },
        }),
      );
    });

    it('omits credentials when not provided', () => {
      makeAdapter();

      expect(SecretsManagerClient).toHaveBeenCalledWith(
        expect.not.objectContaining({ credentials: expect.anything() }),
      );
    });
  });

  describe('get', () => {
    it('returns the value for a key present in the secret', async () => {
      mockSecret({ API_KEY: 'abc123' });
      const adapter = makeAdapter();

      expect(await adapter.get('API_KEY')).toBe('abc123');
    });

    it('returns undefined for a key absent from the secret', async () => {
      mockSecret({ API_KEY: 'abc123' });
      const adapter = makeAdapter();

      expect(await adapter.get('MISSING')).toBeUndefined();
    });
  });

  describe('getOrThrow', () => {
    it('returns the value when the key exists', async () => {
      mockSecret({ API_KEY: 'abc123' });
      const adapter = makeAdapter();

      expect(await adapter.getOrThrow('API_KEY')).toBe('abc123');
    });

    it('throws ConfigProviderError with KEY_NOT_FOUND for a missing key', async () => {
      mockSecret({});
      const adapter = makeAdapter();

      await expect(adapter.getOrThrow('MISSING')).rejects.toBeInstanceOf(
        ConfigProviderError,
      );
      await expect(adapter.getOrThrow('MISSING')).rejects.toMatchObject({
        code: CONFIG_PROVIDER_ERRORS.KEY_NOT_FOUND,
        data: { key: 'MISSING', secretName: 'test/secret' },
      });
    });
  });

  describe('error handling', () => {
    it('throws ConfigProviderError with SECRET_FETCH_FAILED on network error', async () => {
      mockSend.mockRejectedValue(new Error('network failure'));
      const adapter = makeAdapter();

      await expect(adapter.get('ANY')).rejects.toBeInstanceOf(
        ConfigProviderError,
      );
      await expect(adapter.get('ANY')).rejects.toMatchObject({
        code: CONFIG_PROVIDER_ERRORS.SECRET_FETCH_FAILED,
        data: { secretName: 'test/secret', cause: 'network failure' },
      });
    });

    it('throws ConfigProviderError with SECRET_FETCH_FAILED when secret is not valid JSON', async () => {
      mockSend.mockResolvedValue({ SecretString: 'not-json' });
      const adapter = makeAdapter();

      await expect(adapter.get('ANY')).rejects.toBeInstanceOf(
        ConfigProviderError,
      );
      await expect(adapter.get('ANY')).rejects.toMatchObject({
        code: CONFIG_PROVIDER_ERRORS.SECRET_FETCH_FAILED,
        data: { secretName: 'test/secret' },
      });
    });
  });

  describe('reload', () => {
    it('clears the cache and re-fetches the secret', async () => {
      mockSecret({ TOKEN: 'v1' });
      const adapter = makeAdapter();

      await adapter.get('TOKEN');
      expect(mockSend).toHaveBeenCalledTimes(1);

      mockSecret({ TOKEN: 'v2' });
      await adapter.reload();

      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(await adapter.get('TOKEN')).toBe('v2');
      expect(mockSend).toHaveBeenCalledTimes(2); // still cached after reload
    });

    it('notifies registered reload listeners', async () => {
      mockSecret({ TOKEN: 'v1' });
      const adapter = makeAdapter();
      const listener = jest.fn().mockResolvedValue(undefined);
      adapter.onReload(listener);

      await adapter.reload();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies all listeners and throws if any fail', async () => {
      mockSecret({ TOKEN: 'v1' });
      const adapter = makeAdapter();

      const good = jest.fn().mockResolvedValue(undefined);
      const bad = jest.fn().mockRejectedValue(new Error('listener boom'));
      adapter.onReload(good);
      adapter.onReload(bad);

      await expect(adapter.reload()).rejects.toMatchObject({
        code: CONFIG_PROVIDER_ERRORS.RELOAD_FAILED,
      });
      expect(good).toHaveBeenCalled();
      expect(bad).toHaveBeenCalled();
    });

    it('reflects updated secret values in live scope after reload', async () => {
      mockSecret({ TOKEN: 'v1' });
      const adapter = makeAdapter();

      // Simulate a live scope: register an onReload listener that reads the new value
      let capturedToken: string | undefined;
      adapter.onReload(async () => {
        capturedToken = await adapter.get('TOKEN');
      });

      mockSecret({ TOKEN: 'v2' });
      await adapter.reload();

      expect(capturedToken).toBe('v2');
    });
  });
});
