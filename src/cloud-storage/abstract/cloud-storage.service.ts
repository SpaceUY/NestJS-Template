import { Injectable, Inject } from '@nestjs/common';
import { ICloudStorageProvider } from './cloud-storage-provider.interface';
import { CLOUD_STORAGE_PROVIDER } from './cloud-storage-provider.const';

@Injectable()
export class CloudStorageService implements ICloudStorageProvider {
  constructor(
    @Inject(CLOUD_STORAGE_PROVIDER)
    private readonly storageProvider: ICloudStorageProvider,
  ) {}

  uploadFile(file: Express.Multer.File): Promise<{ url: string; id: string }> {
    return this.storageProvider.uploadFile(file);
  }

  deleteFile(fileKey: string): Promise<void> {
    return this.storageProvider.deleteFile(fileKey);
  }

  getFile(fileKey: string): Promise<{ url: string; id: string }> {
    return this.storageProvider.getFile(fileKey);
  }
}
