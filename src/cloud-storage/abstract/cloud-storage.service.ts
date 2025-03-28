import { Injectable, Inject } from '@nestjs/common';
import { ICloudStorageProvider } from './cloud-storage-provider.interface';
import { CLOUD_STORAGE_PROVIDER } from './cloud-storage-provider.const';

@Injectable()
export class CloudStorageService implements ICloudStorageProvider {
  constructor(
    @Inject(CLOUD_STORAGE_PROVIDER)
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
