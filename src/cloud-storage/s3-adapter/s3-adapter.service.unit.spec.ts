import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CloudStorageError, CLOUD_STORAGE_ERRORS } from '../abstract/cloud-storage.error';
import { S3AdapterService } from './s3-adapter.service';
import { LoggerService } from '../../common/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../common/logger/nest-adapter/nest-logger.adapter';

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));
jest.mock('uuid', () => ({ v4: jest.fn(() => 'mocked-uuid') }));

describe('S3AdapterService', () => {
  const mockedSend = jest.fn();
  const mockedGetSignedUrl = getSignedUrl as jest.Mock;

  const config = {
    region: 'us-east-1',
    bucket: 'test-bucket',
    expiresInSeconds: 3600,
  };

  beforeEach(() => {
    (S3Client as jest.Mock).mockImplementation(() => ({ send: mockedSend }));
  });

  afterEach(() => jest.clearAllMocks());

  describe('uploadFile', () => {
    it('should upload a file and return its URL and id', async () => {
      mockedSend.mockResolvedValue({});

      const service = new S3AdapterService(config);
      const result = await service.uploadFile({
        buffer: Buffer.from('content'),
        mimetype: 'text/plain',
      });

      expect(mockedSend).toHaveBeenCalled();
      expect(result.url).toContain('test-bucket');
      expect(typeof result.id).toBe('string');
    });

    it('should throw CloudStorageError UPLOAD_FAILED when S3 rejects', async () => {
      mockedSend.mockRejectedValue(new Error('S3 error'));

      const service = new S3AdapterService(config);
      let error: unknown;
      try {
        await service.uploadFile({ buffer: Buffer.from('content'), mimetype: 'text/plain' });
      } catch (caughtError) {
        error = caughtError;
      }

      expect(error).toBeInstanceOf(CloudStorageError);
      expect((error as CloudStorageError).code).toBe(CLOUD_STORAGE_ERRORS.UPLOAD_FAILED);
    });
  });

  describe('deleteFile', () => {
    it('should delete a file from S3', async () => {
      mockedSend.mockResolvedValue({});

      const service = new S3AdapterService(config);
      await service.deleteFile('some-key');

      expect(mockedSend).toHaveBeenCalled();
    });

    it('should throw CloudStorageError DELETE_FAILED when S3 rejects', async () => {
      mockedSend.mockRejectedValue(new Error('S3 error'));

      const service = new S3AdapterService(config);
      let error: unknown;
      try {
        await service.deleteFile('some-key');
      } catch (caughtError) {
        error = caughtError;
      }

      expect(error).toBeInstanceOf(CloudStorageError);
      expect((error as CloudStorageError).code).toBe(CLOUD_STORAGE_ERRORS.DELETE_FAILED);
    });
  });

  describe('getFile', () => {
    it('should return a signed URL for the file', async () => {
      mockedGetSignedUrl.mockResolvedValue('https://signed-url.example.com');

      const service = new S3AdapterService(config);
      const result = await service.getFile('some-key');

      expect(result).toEqual({ id: 'some-key', url: 'https://signed-url.example.com' });
    });

    it('should throw CloudStorageError GET_FAILED when getSignedUrl rejects', async () => {
      mockedGetSignedUrl.mockRejectedValue(new Error('Presign error'));

      const service = new S3AdapterService(config);
      let error: unknown;
      try {
        await service.getFile('some-key');
      } catch (caughtError) {
        error = caughtError;
      }

      expect(error).toBeInstanceOf(CloudStorageError);
      expect((error as CloudStorageError).code).toBe(CLOUD_STORAGE_ERRORS.GET_FAILED);
    });
  });

  describe('logger behavior', () => {
    const mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      setContext: jest.fn(),
      withTelemetry: jest.fn(),
    } as unknown as LoggerService;

    describe('without LoggerService (NestLoggerAdapter fallback)', () => {
      it('uses NestLoggerAdapter as the default logger', () => {
        const service = new S3AdapterService(config);
        expect((service as any).logger).toBeInstanceOf(NestLoggerAdapter);
      });

      it('completes uploadFile without error using the fallback logger', async () => {
        mockedSend.mockResolvedValue({});
        const service = new S3AdapterService(config);
        await expect(
          service.uploadFile({ buffer: Buffer.from('x'), mimetype: 'text/plain' }),
        ).resolves.toBeDefined();
      });
    });

    describe('with injected LoggerService', () => {
      it('logs debug and log on successful uploadFile', async () => {
        mockedSend.mockResolvedValue({});
        const service = new S3AdapterService(config);
        service.setLogger(mockLogger);

        await service.uploadFile({ buffer: Buffer.from('x'), mimetype: 'text/plain' });

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Uploading file to S3' }),
        );
        expect(mockLogger.log).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'File uploaded to S3' }),
        );
      });

      it('logs error on uploadFile failure', async () => {
        mockedSend.mockRejectedValue(new Error('S3 error'));
        const service = new S3AdapterService(config);
        service.setLogger(mockLogger);

        await expect(
          service.uploadFile({ buffer: Buffer.from('x'), mimetype: 'text/plain' }),
        ).rejects.toBeDefined();

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'File upload to S3 failed' }),
        );
      });

      it('logs debug and log on successful deleteFile', async () => {
        mockedSend.mockResolvedValue({});
        const service = new S3AdapterService(config);
        service.setLogger(mockLogger);

        await service.deleteFile('some-key');

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Deleting file from S3' }),
        );
        expect(mockLogger.log).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'File deleted from S3' }),
        );
      });

      it('logs error on deleteFile failure', async () => {
        mockedSend.mockRejectedValue(new Error('S3 error'));
        const service = new S3AdapterService(config);
        service.setLogger(mockLogger);

        await expect(service.deleteFile('some-key')).rejects.toBeDefined();

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'File deletion from S3 failed' }),
        );
      });

      it('logs debug and log on successful getFile', async () => {
        mockedGetSignedUrl.mockResolvedValue('https://signed-url.example.com');
        const service = new S3AdapterService(config);
        service.setLogger(mockLogger);

        await service.getFile('some-key');

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Generating signed URL from S3' }),
        );
        expect(mockLogger.log).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Signed URL generated' }),
        );
      });

      it('logs error on getFile failure', async () => {
        mockedGetSignedUrl.mockRejectedValue(new Error('Presign error'));
        const service = new S3AdapterService(config);
        service.setLogger(mockLogger);

        await expect(service.getFile('some-key')).rejects.toBeDefined();

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Failed to generate signed URL from S3' }),
        );
      });
    });
  });
});
