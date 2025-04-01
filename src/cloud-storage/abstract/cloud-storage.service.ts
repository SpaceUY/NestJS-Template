/**
 * Interface for the file object returned by the Cloud Storage provider.
 * @property {string} url - The public URL where the file can be accessed.
 * @property {string} id - The unique identifier assigned to the file in the cloud provider.
 */
interface CloudStorageFile {
  url: string;
  id: string;
}

/**
 * Interface for adapters to implement to work alongside the `CloudStorageModule.`
 */
export abstract class CloudStorageService {
  /**
   * Uploads a file to the Cloud Storage provider.
   * @param {Express.Multer.File} file - The file to upload.
   * @returns {Promise<CloudStorageFile>} An object containing:
   *   - `url`: The public URL where the file can be accessed.
   *   - `id`: The unique identifier assigned to the file in the cloud provider.
   */
  abstract uploadFile(file: Express.Multer.File): Promise<CloudStorageFile>;

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
