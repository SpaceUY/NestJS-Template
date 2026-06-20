import {
  CloudStorageError,
  CLOUD_STORAGE_ERRORS,
} from '../../abstract/cloud-storage.error';
import { LocalAdapterService } from '../local-adapter.service';
import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { LoggerService } from '../../../common/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../../common/logger/nest-adapter/nest-logger.adapter';

jest.mock('node:fs/promises', () => ({
  access: jest.fn(),
  mkdir: jest.fn(),
  unlink: jest.fn(),
  writeFile: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

describe('LocalAdapterService', () => {
  const mockedAccess = jest.mocked(access);
  const mockedMkdir = jest.mocked(mkdir);
  const mockedUnlink = jest.mocked(unlink);
  const mockedWriteFile = jest.mocked(writeFile);

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('should upload a file to the local files directory', async () => {
      (uuidv4 as unknown as jest.Mock).mockReturnValue('local-id');
      mockedMkdir.mockResolvedValue(undefined);
      mockedWriteFile.mockResolvedValue(undefined);

      const service = new LocalAdapterService();
      const response = await service.uploadFile({
        buffer: Buffer.from('local-file'),
        originalname: 'document.txt',
      });

      expect(mockedMkdir).toHaveBeenCalledWith(
        expect.stringContaining('/files'),
        { recursive: true },
      );
      expect(mockedWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('/files/local-id.txt'),
        expect.any(Buffer),
      );
      expect(response).toEqual({
        id: 'local-id.txt',
        url: '/files/local-id.txt',
      });
    });
  });

  describe('getFile', () => {
    it('should return a local URL when the file exists', async () => {
      mockedAccess.mockResolvedValue(undefined);

      const service = new LocalAdapterService();
      const response = await service.getFile('existing-file.png');

      expect(mockedAccess).toHaveBeenCalledWith(
        expect.stringContaining('/files/existing-file.png'),
      );
      expect(response).toEqual({
        id: 'existing-file.png',
        url: '/files/existing-file.png',
      });
    });

    it('should throw CloudStorageError FILE_NOT_FOUND when file does not exist', async () => {
      mockedAccess.mockRejectedValue({ code: 'ENOENT' });

      const service = new LocalAdapterService();
      let error: unknown;
      try {
        await service.getFile('missing-file.png');
      } catch (caughtError) {
        error = caughtError;
      }

      expect(error).toBeInstanceOf(CloudStorageError);
      expect((error as CloudStorageError).code).toBe(
        CLOUD_STORAGE_ERRORS.FILE_NOT_FOUND,
      );
    });

    it('should rethrow non-ENOENT errors from getFile unchanged', async () => {
      const networkError = new Error('Network failure');
      mockedAccess.mockRejectedValue(networkError);

      const service = new LocalAdapterService();
      await expect(service.getFile('some-file.png')).rejects.toBe(networkError);
    });
  });

  describe('deleteFile', () => {
    it('should delete a local file', async () => {
      mockedUnlink.mockResolvedValue(undefined);

      const service = new LocalAdapterService();
      await service.deleteFile('file-to-delete.pdf');

      expect(mockedUnlink).toHaveBeenCalledWith(
        expect.stringContaining('/files/file-to-delete.pdf'),
      );
    });

    it('should throw CloudStorageError FILE_NOT_FOUND when file does not exist', async () => {
      mockedUnlink.mockRejectedValue({ code: 'ENOENT' });

      const service = new LocalAdapterService();
      let error: unknown;
      try {
        await service.deleteFile('missing.pdf');
      } catch (caughtError) {
        error = caughtError;
      }

      expect(error).toBeInstanceOf(CloudStorageError);
      expect((error as CloudStorageError).code).toBe(
        CLOUD_STORAGE_ERRORS.FILE_NOT_FOUND,
      );
    });

    it('should rethrow non-ENOENT errors from deleteFile unchanged', async () => {
      const networkError = new Error('Network failure');
      mockedUnlink.mockRejectedValue(networkError);

      const service = new LocalAdapterService();
      await expect(service.deleteFile('some-file.pdf')).rejects.toBe(
        networkError,
      );
    });
  });

  describe('path validation', () => {
    it('should throw CloudStorageError INVALID_KEY when file key contains path traversal', async () => {
      const service = new LocalAdapterService();
      let error: unknown;
      try {
        await service.getFile('../etc/passwd');
      } catch (caughtError) {
        error = caughtError;
      }

      expect(error).toBeInstanceOf(CloudStorageError);
      expect((error as CloudStorageError).code).toBe(
        CLOUD_STORAGE_ERRORS.INVALID_KEY,
      );
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
        const service = new LocalAdapterService();
        expect((service as any).logger).toBeInstanceOf(NestLoggerAdapter);
      });

      it('completes uploadFile without error using the fallback logger', async () => {
        (uuidv4 as unknown as jest.Mock).mockReturnValue('fallback-uuid');
        mockedMkdir.mockResolvedValue(undefined);
        mockedWriteFile.mockResolvedValue(undefined);
        const service = new LocalAdapterService();
        await expect(
          service.uploadFile({
            buffer: Buffer.from('x'),
            originalname: 'test.txt',
          }),
        ).resolves.toBeDefined();
      });
    });

    describe('with injected LoggerService', () => {
      it('logs debug and log on successful uploadFile', async () => {
        (uuidv4 as unknown as jest.Mock).mockReturnValue('test-uuid');
        mockedMkdir.mockResolvedValue(undefined);
        mockedWriteFile.mockResolvedValue(undefined);
        const service = new LocalAdapterService();
        service.setLogger(mockLogger);

        await service.uploadFile({
          buffer: Buffer.from('x'),
          originalname: 'test.txt',
        });

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Writing file to local storage' }),
        );
        expect(mockLogger.log).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'File written to local storage' }),
        );
      });

      it('logs debug and log on successful deleteFile', async () => {
        mockedUnlink.mockResolvedValue(undefined);
        const service = new LocalAdapterService();
        service.setLogger(mockLogger);

        await service.deleteFile('file.txt');

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Deleting file from local storage',
          }),
        );
        expect(mockLogger.log).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'File deleted from local storage',
          }),
        );
      });

      it('logs debug and log on successful getFile', async () => {
        mockedAccess.mockResolvedValue(undefined);
        const service = new LocalAdapterService();
        service.setLogger(mockLogger);

        await service.getFile('file.txt');

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Checking file in local storage',
          }),
        );
        expect(mockLogger.log).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'File found in local storage' }),
        );
      });
    });
  });
});
