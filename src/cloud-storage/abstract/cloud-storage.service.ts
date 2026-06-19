import {
  CloudStorageUploadFile,
  CloudStorageFile,
} from './cloud-storage.interfaces';
import { LoggerService } from '../../common/logger/abstract/logger.service';
import { NestLoggerAdapter } from '../../common/logger/nest-adapter/nest-logger.adapter';

/**
 * Interface for adapters to implement to work alongside the `CloudStorageModule.`
 */
export abstract class CloudStorageService {
  protected logger: LoggerService = new NestLoggerAdapter(
    this.constructor.name,
  );

  setLogger(logger: LoggerService): void {
    this.logger = logger;
  }

  /**
   * Uploads a file to the Cloud Storage provider.
   * @param file - The file payload to upload.
   * @returns {Promise<CloudStorageFile>} An object containing:
   *   - `url`: The public URL where the file can be accessed.
   *   - `id`: The unique identifier assigned to the file in the cloud provider.
   */
  abstract uploadFile(file: CloudStorageUploadFile): Promise<CloudStorageFile>;

  /**
   * Delete a file from the Cloud Storage provider.
   * @param {string} fileKey - The unique identifier assigned to the file in the cloud provider.
   * @returns {void}
   */
  abstract deleteFile(fileKey: string): Promise<void>;

  /**
   * Get a file from the Cloud Storage provider.
   * @param {string} fileKey - The unique identifier assigned to the file in the cloud provider.
   * @returns {Promise<CloudStorageFile>} An object containing:
   *   - `url`: Signed URL where the file can be accessed.
   *   - `id`: The unique identifier assigned to the file in the cloud provider.
   */
  abstract getFile(fileKey: string): Promise<CloudStorageFile>;
}
