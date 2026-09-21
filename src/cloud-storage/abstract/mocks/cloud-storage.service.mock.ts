import { CloudStorageService } from '../cloud-storage.service';
import { CloudStorageFile } from '../cloud-storage.interfaces';
import { LoggerService } from '../../../common/observability/logger/abstract/logger.service';

const FILE: CloudStorageFile = { url: 'https://example.test/file', id: 'file' };

export class MockCloudStorageService extends CloudStorageService {
  uploadFile = jest.fn().mockResolvedValue(FILE);
  deleteFile = jest.fn().mockResolvedValue(undefined);
  getFile = jest.fn().mockResolvedValue(FILE);

  /** `logger` is protected on the abstract class; this keeps assertions honest. */
  exposeLogger(): LoggerService {
    return this.logger;
  }
}
