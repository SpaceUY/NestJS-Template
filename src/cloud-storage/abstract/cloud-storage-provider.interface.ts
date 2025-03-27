export interface ICloudStorageProvider {
  uploadFile(file: Express.Multer.File): Promise<string>;
  deleteFile(fileName: string): Promise<void>;
  getFile(fileName: string): Promise<string>;
}
