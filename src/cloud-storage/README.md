# Cloud Storage Module

A NestJS module that provides Cloud Storage functionality with a clean, injectable service interface.

## Overview

This module provides a cloud storage files solution for NestJS applications. It includes:

- A configurable Cloud Storage module
- A service wrapper for Cloud Storage operations
- Endpoints upload, delete and get files from cloud storage provider
- AWS S3 Integration

## Directory Structure

```
cloud-storage/
├── abstract/
│   ├── dto/
│   ├── cloud-storage-abstract.module.ts
│   ├── cloud-storage-error-codes.ts
│   ├── cloud-storage-provider.const.ts
│   ├── cloud-storage-provider.interface.ts
│   ├── cloud-storage.controller.ts
│   ├── cloud-storage.exception.ts
│   ├── cloud-storage.service.ts
├── s3-adapter/
│   ├── s3-adapter-config.provider.const.ts
│   ├── s3-adapter-config.interface.ts
│   ├── s3-adapter.module.ts
│   ├── s3-adapter.service.ts
└── README.md

```

## Features

- Configurable Cloud Storage connection
- Cloud storage provider operations, upload, delete and get file
- Easy-to-use service interface
- AWS S3 support
- Integration with NestJS dependency injection

## Installation

Ensure you have the required dependencies:

```bash
npm install @aws-sdk/client-s3
npm install @aws-sdk/s3-request-presigner
npm install @types/multer
```

## Usage

### 1. Import the Module

#### Single Node Mode

```typescript
import { Module } from '@nestjs/common';
import { S3AdapterModule } from './cloud-storage/s3-adapter/s3-adapter.module';
import { CloudStorageAbstractModule } from './cloud-storage/abstract/cloud-storage-abstract.module.ts';
import { ConfigType } from '@nestjs/config';
import awsConfig from 'src/config/aws.config'; // Your aws config

@Module({
  imports: [
    CloudStorageAbstractModule.forRoot({
      adapter: S3AdapterModule.forRootAsync({
        inject: [awsConfig.KEY],
        useFactory: (aws: ConfigType<typeof awsConfig>) => ({
          bucket: aws.s3.bucket,
          region: aws.base.region,
          accessKeyId: aws.base.accessKeyId,
          secretAccessKey: aws.base.secretAccessKey,
          expiresInSeconds: aws.s3.expiresInSeconds,
        }),
      }),
    }),
  ],
})
export class AppModule {}
```

### 2. Use the Cloud Storage Service

```typescript
import { Injectable } from '@nestjs/common';
import { ICloudStorageProvider } from './cloud-storage-provider.interface';
import { CLOUD_STORAGE_PROVIDER } from './cloud-storage-provider.const';

@Injectable()
export class YourService {
  constructor(@Inject(CLOUD_STORAGE_PROVIDER)
    private readonly storageProvider: ICloudStorageProvider,) {}

   getFile(fileKey: string): Promise<{ url: string; id: string }> {
    return this.storageProvider.getFile(fileKey);
  }
}
```

## Configuration Options

The `CloudStorageAbstractModule.forRoot()` method accepts standard AWS S3 configuration options:

```typescript
static forRoot(options: { adapter: DynamicModule }): DynamicModule
```

There's also a `forRootAsync` option which allows for dependency injection. For instance, the module can be used in the following fashion:

```typescript
CloudStorageAbstractModule.forRoot({
  adapter: S3AdapterModule.forRootAsync({
    inject: [awsConfig.KEY],
    useFactory: (aws: ConfigType<typeof awsConfig>) => ({
      bucket: aws.s3.bucket,
      region: aws.base.region,
      accessKeyId: aws.base.accessKeyId,
      secretAccessKey: aws.base.secretAccessKey,
      expiresInSeconds: aws.s3.expiresInSeconds,
    }),
  }),
}),
```

Assuming that a `awsConfig` is registered using `@nestjs/common`'s `registerAs` method.

## API Reference

### CloudStorageController

The main endpoints for interacting with cloud storage provider:

```typescript
class CloudStorageController {
  // Upload a file buffer to cloud storage provider
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<FileResponseDto>

  // Delete a file from cloud storage provider by fileKey
  async deleteFile(@Param('fileKey') fileKey: string): Promise<string>

  // Retrieve a file signed url from cloud storage provider by fileKey
  async getFile(@Param('fileKey') fileKey: string): Promise<FileResponseDto>
}
```

## Extending Functionality with Other Storage Providers

The `CloudStorageAbstractModule` is designed to be flexible and support multiple cloud storage providers. To add support for another provider, follow these steps:

1. **Create a New Adapter**  
   - Create a new directory inside `cloud-storage`, for example: `gcs-adapter/` for Google Cloud Storage.  
   - Implement a service that follows the `ICloudStorageProvider` interface defined in `cloud-storage/abstract/cloud-storage-provider.interface.ts`.

2. **Define the Adapter Module**  
   - Create a module similar to `S3AdapterModule` to initialize the new provider.  
   - Ensure it provides a configuration mechanism (e.g., `forRoot` or `forRootAsync` methods).

3. **Register the Adapter in the Abstract Module**  
   - Modify `CloudStorageAbstractModule` to accept the new adapter as a dynamic module.  
   - Example:  
   ```typescript
   CloudStorageAbstractModule.forRoot({
     adapter: GCSAdapterModule.forRootAsync({
       inject: [gcsConfig.KEY],
       useFactory: (gcs: ConfigType<typeof gcsConfig>) => ({
         bucket: gcs.bucket,
         projectId: gcs.projectId,
         credentials: gcs.credentials,
       }),
     }),
   }),
   ```
4. **Implement Provider-Specific Logic**
  - Ensure the new adapter correctly implements methods such as uploadFile, deleteFile, and getFile.
  - Use the respective SDK (e.g., @google-cloud/storage for Google Cloud Storage).
  - By following this structure, you can easily extend the cloud storage module to support different providers like Google Cloud Storage, Azure Blob Storage, or others.

## Best Practices

1. **File Naming & Organization**

   - Use a consistent naming convention for stored files (e.g., user-avatars/{userId}.jpg).
   - Include timestamps or UUIDs in filenames to prevent overwrites
   - Organize files into logical directories (e.g., events/{eventId}/images/)

2. **Error Handling**

   - Implement logging for file operations to track issues
   - Handle upload failures and implement retry mechanisms
   - Use try-catch blocks around cloud-storage operations

3. **Security & Access Control**

   - Use signed URLs or pre-signed URLs for secure temporary access
   - Restrict public access to storage unless necessary
   - Apply bucket policies and IAM roles to limit access

4. **Performance Optimization**

   - Enable content caching using a CDN (e.g., AWS CloudFront).
   - Set appropriate cache-control headers for frequently accessed files.
   - Consider multipart uploads for large files.

5. **Storage Cost Management**

   - Use lifecycle policies to move old files to lower-cost storage (e.g., S3 Glacier).
   - Regularly audit and clean up unused or orphaned files.
   - Monitor storage usage and costs to avoid unexpected charges.

## Contributing

Feel free to submit issues and enhancement requests!