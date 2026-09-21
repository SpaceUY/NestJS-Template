import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Buffer } from 'node:buffer';
import { CloudStorageController } from './cloud-storage.controller';
import { CloudStorageService } from './cloud-storage.service';
import { MockCloudStorageService } from './mocks/cloud-storage.service.mock';
import { CloudStorageUploadFile } from './cloud-storage.interfaces';

const upload = (
  overrides: Partial<CloudStorageUploadFile> = {},
): CloudStorageUploadFile => ({
  buffer: Buffer.from('a file'),
  mimetype: 'text/plain',
  originalname: 'note.txt',
  size: 6,
  ...overrides,
});

describe('CloudStorageController', () => {
  let controller: CloudStorageController;
  let service: MockCloudStorageService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CloudStorageController],
      providers: [
        { provide: CloudStorageService, useClass: MockCloudStorageService },
      ],
    }).compile();

    controller = moduleRef.get(CloudStorageController);
    service = moduleRef.get(CloudStorageService);
  });

  describe('uploadFile', () => {
    it('hands the file to the service and returns what it answers', async () => {
      const file = upload();

      await expect(controller.uploadFile(file)).resolves.toEqual({
        url: 'https://example.test/file',
        id: 'file',
      });
      expect(service.uploadFile).toHaveBeenCalledWith(file);
    });

    // Multer leaves the argument undefined when the part is missing, and an
    // empty buffer costs a provider round trip to learn nothing.
    it.each([
      ['no file at all', undefined],
      ['an empty buffer', upload({ buffer: Buffer.alloc(0), size: 0 })],
    ])('rejects %s before calling the service', async (_label, file) => {
      await expect(controller.uploadFile(file)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(service.uploadFile).not.toHaveBeenCalled();
    });
  });

  describe('deleteFile', () => {
    it('passes the key through to the service', async () => {
      await controller.deleteFile('folder/note.txt');

      expect(service.deleteFile).toHaveBeenCalledWith('folder/note.txt');
    });

    it.each([
      ['an empty key', ''],
      ['a whitespace-only key', '   '],
    ])('rejects %s before calling the service', async (_label, key) => {
      await expect(controller.deleteFile(key)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(service.deleteFile).not.toHaveBeenCalled();
    });
  });

  describe('getFile', () => {
    it('returns what the service answers', async () => {
      await expect(controller.getFile('folder/note.txt')).resolves.toEqual({
        url: 'https://example.test/file',
        id: 'file',
      });
      expect(service.getFile).toHaveBeenCalledWith('folder/note.txt');
    });

    it.each([
      ['an empty key', ''],
      ['a whitespace-only key', '   '],
    ])('rejects %s before calling the service', async (_label, key) => {
      await expect(controller.getFile(key)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(service.getFile).not.toHaveBeenCalled();
    });
  });
});
