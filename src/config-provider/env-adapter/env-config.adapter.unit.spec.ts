import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { EnvConfigAdapter } from './env-config.adapter';
import { CONFIG_PROVIDER_ERRORS } from '../abstract/config-provider-error-codes';
import { ConfigProviderError } from '../abstract/config-provider.error';

jest.mock('fs');
jest.mock('dotenv');

const mockExistsSync = fs.existsSync as jest.Mock;
const mockReadFileSync = fs.readFileSync as jest.Mock;
const mockDotenvParse = dotenv.parse as jest.Mock;

describe('EnvConfigAdapter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { PROCESS_VAR: 'from-process' };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('loading', () => {
    it('reads from process.env when no envFilePath is given', async () => {
      const adapter = new EnvConfigAdapter();
      expect(await adapter.get('PROCESS_VAR')).toBe('from-process');
    });

    it('returns undefined for unknown keys', async () => {
      const adapter = new EnvConfigAdapter();
      expect(await adapter.get('UNKNOWN')).toBeUndefined();
    });

    it('loads a single env file and merges it over process.env', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(Buffer.from(''));
      mockDotenvParse.mockReturnValue({ FILE_VAR: 'from-file' });

      const adapter = new EnvConfigAdapter({ envFilePath: '.env' });

      expect(mockExistsSync).toHaveBeenCalledWith('.env');
      expect(await adapter.get('FILE_VAR')).toBe('from-file');
      expect(await adapter.get('PROCESS_VAR')).toBe('from-process');
    });

    it('loads multiple env files in order, later files take precedence', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(Buffer.from(''));
      mockDotenvParse
        .mockReturnValueOnce({ SHARED: 'base', BASE_ONLY: 'base-val' })
        .mockReturnValueOnce({ SHARED: 'local' });

      const adapter = new EnvConfigAdapter({
        envFilePath: ['.env', '.env.local'],
      });

      expect(await adapter.get('SHARED')).toBe('local');
      expect(await adapter.get('BASE_ONLY')).toBe('base-val');
    });

    it('skips files that do not exist', async () => {
      mockExistsSync.mockReturnValueOnce(false).mockReturnValueOnce(true);
      mockReadFileSync.mockReturnValue(Buffer.from(''));
      mockDotenvParse.mockReturnValue({ FILE_VAR: 'present' });

      const adapter = new EnvConfigAdapter({
        envFilePath: ['.env.missing', '.env'],
      });

      expect(mockDotenvParse).toHaveBeenCalledTimes(1);
      expect(await adapter.get('FILE_VAR')).toBe('present');
    });
  });

  describe('get', () => {
    it('returns the value for a known key', async () => {
      const adapter = new EnvConfigAdapter();
      expect(await adapter.get('PROCESS_VAR')).toBe('from-process');
    });

    it('returns undefined for a missing key', async () => {
      const adapter = new EnvConfigAdapter();
      expect(await adapter.get('NOPE')).toBeUndefined();
    });
  });

  describe('getOrThrow', () => {
    it('returns the value when the key exists', async () => {
      const adapter = new EnvConfigAdapter();
      expect(await adapter.getOrThrow('PROCESS_VAR')).toBe('from-process');
    });

    it('throws ConfigProviderError with KEY_NOT_FOUND when key is missing', async () => {
      const adapter = new EnvConfigAdapter();

      await expect(adapter.getOrThrow('MISSING')).rejects.toMatchObject({
        code: CONFIG_PROVIDER_ERRORS.KEY_NOT_FOUND,
        data: { key: 'MISSING' },
      });
      await expect(adapter.getOrThrow('MISSING')).rejects.toBeInstanceOf(
        ConfigProviderError,
      );
    });
  });
});
