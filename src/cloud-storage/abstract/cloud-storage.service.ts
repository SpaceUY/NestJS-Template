import { Injectable, Inject } from '@nestjs/common';
import { ICloudStorageProvider } from './cloud-storage-provider.interface';

@Injectable()
export class CloudStorageService {
  constructor(
    @Inject()
    private readonly storageProvider: ICloudStorageProvider,
  ) {}

  uploadFile(file: Express.Multer.File): Promise<string> {
    return this.storageProvider.uploadFile(file);
  }

  deleteFile(fileName: string): Promise<void> {
    return this.storageProvider.deleteFile(fileName);
  }

  getFile(fileName: string): Promise<string> {
    return this.storageProvider.getFile(fileName);
  }
}
