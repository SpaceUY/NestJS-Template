/**
 * Interface for adapters to implement to work alongside the `CloudStorageModule.`
 */
export interface ICloudStorageProvider {
  /**
   * Uploads a file to the Cloud Storage provider.
   * @param {Express.Multer.File} file - The file to upload.
   * @returns {string} The file identifier in the cloud provider.
   */
  uploadFile(file: Express.Multer.File): Promise<{ url: string; id: string }>;

  /**
   * Delete a file from the Cloud Storage provider.
   * @param {Express.Multer.File} file - The file to upload.
   * @returns {void}
   */
  deleteFile(fileKey: string): Promise<void>;

  /**
   * Get a file from the Cloud Storage provider.
   * @param {Express.Multer.File} file - The file to upload.
   * @returns {string} The file url in the cloud provider.
   */
  getFile(fileKey: string): Promise<{ url: string; id: string }>;
}
