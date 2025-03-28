/**
 * Interface for adapters to implement to work alongside the `CloudStorageModule.`
 */
export interface ICloudStorageProvider {
  /**
   * Uploads a file to the Cloud Storage provider.
   * @param {Express.Multer.File} file - The file to upload.
   * @returns {Promise<{ url: string; id: string }>} An object containing:
   *   - `url`: The public URL where the file can be accessed.
   *   - `id`: The unique identifier assigned to the file in the cloud provider.
   */
  uploadFile(file: Express.Multer.File): Promise<{ url: string; id: string }>;

  /**
   * Delete a file from the Cloud Storage provider.
   * @param {string} fileKey - The unique identifier assigned to the file in the cloud provider.
   * @returns {void}
   */
  deleteFile(fileKey: string): Promise<void>;

  /**
   * Get a file from the Cloud Storage provider.
   * @param {string} fileKey - The unique identifier assigned to the file in the cloud provider.
   * @returns {Promise<{ url: string; id: string }>} An object containing:
   *   - `url`: Signed URL where the file can be accessed.
   *   - `id`: The unique identifier assigned to the file in the cloud provider.
   */
  getFile(fileKey: string): Promise<{ url: string; id: string }>;
}
