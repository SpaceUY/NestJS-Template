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
      adapter: S3AdapterModule.registerAsync({
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
import { CloudStorageService } from './cloud-storage.service';
import { CLOUD_STORAGE_PROVIDER } from './cloud-storage-provider.const';

@Injectable()
export class YourService {
  constructor(private cloudStorageService: CloudStorageService) {}

   getFile(fileKey: string): Promise<CloudStorageFile> {
    return this.storageProvider.getFile(fileKey);
  }
}
```

## Using the S3 Adapter with CloudStorageAbstractModule

To make the `CloudStorageAbstractModule` work with the S3 adapter, it's required to extend the `CloudStorageService` class. Specifically, in your `S3AdapterService` class that extends `CloudStorageService`. This extension is necessary for the CloudStorageAbstractModule to interact with the S3 storage provider.

If your project only requires the S3 adapter and you know that you won't need to change the provider, you can skip using the abstract module and directly import the S3AdapterModule into your project.

**Fix Import Paths Manually (If Needed)**:

  After copying the files, you might need to fix the import paths manually. Ensure that the import paths for the CloudStorageService and the S3AdapterService are correct according to your project structure. If you encounter any errors related to the imports, double-check that the paths are resolved correctly.

  In your project, find a service that extends `CloudStorageService`, and adjust the import path if needed, like this:

  ```typescript
  import { CloudStorageService } from 'path-to-cloud-storage-service'; // Adjust the import path
  import { Injectable } from '@nestjs/common';

  @Injectable()
  export class S3AdapterService extends CloudStorageService {
  }
   
```


## Configuration Options

The `CloudStorageAbstractModule.forRoot()` method accepts standard AWS S3 configuration options:

```typescript
static forRoot(options: { adapter: DynamicModule }): DynamicModule
```

There's also a `registerAsync` option which allows for dependency injection. For instance, the module can be used in the following fashion:

```typescript
CloudStorageAbstractModule.forRoot({
  adapter: S3AdapterModule.registerAsync({
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


For a secure and scalable integration with AWS S3, it is recommended to **use IAM Roles instead of passing access keys explicitly**.  
For this reason, the environment variables **AWS_ACCESS_KEY** and **AWS_SECRET_ACCESS_KEY** are optional in this project.

## API Reference

The `CloudStorageAbstractModule` allows the optional registration of a default controller (`CloudStorageController`), which exposes endpoints for file management with the cloud storage provider.

### CloudStorageController

The main endpoints for interacting with cloud storage provider:

```typescript
class CloudStorageController {
  // Upload a file buffer to cloud storage provider
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<FileResponseDto>

  // Delete a file from cloud storage provider by fileKey
  async deleteFile(@Param('fileKey') fileKey: string): Promise<void>

  // Retrieve a file signed url from cloud storage provider by fileKey
  async getFile(@Param('fileKey') fileKey: string): Promise<FileResponseDto>
}
```

### **Enabling the Default Controller**

To use the default controller, set `useDefaultController: true` when registering the module:

```typescript
import { Module } from '@nestjs/common';
import { CloudStorageAbstractModule } from './cloud-storage/cloud-storage-abstract.module';
import { S3AdapterModule } from './adapters/s3-adapter.module';

@Module({
  imports: [
    CloudStorageAbstractModule.forRoot({
      adapter: S3AdapterModule.registerAsync({
        inject: [awsConfig.KEY],
        useFactory: (aws: ConfigType<typeof awsConfig>) => ({
          bucket: aws.s3.bucket,
          region: aws.base.region,
          accessKeyId: aws.base.accessKeyId,
          secretAccessKey: aws.base.secretAccessKey,
          expiresInSeconds: aws.s3.expiresInSeconds,
        }),
      }),
      useDefaultController: true, // Enables the default controller
      isGlobal: true, // If you need, enables the module as global
    }),
  ],
})
export class AppModule {}
```

### **Enabling a Custom Controller**

To use a custom controller, set `useDefaultController: false` when registering the module:

```typescript
import { Module } from '@nestjs/common';
import { CloudStorageAbstractModule } from './cloud-storage/cloud-storage-abstract.module';
import { S3AdapterModule } from './adapters/s3-adapter.module';
import { CustomStorageController } from './custom-storage.controller';

@Module({
  imports: [
    CloudStorageAbstractModule.forRoot({
      adapter: S3AdapterModule.registerAsync({
        inject: [awsConfig.KEY],
        useFactory: (aws: ConfigType<typeof awsConfig>) => ({
          bucket: aws.s3.bucket,
          region: aws.base.region,
          accessKeyId: aws.base.accessKeyId,
          secretAccessKey: aws.base.secretAccessKey,
          expiresInSeconds: aws.s3.expiresInSeconds,
        }),
      }),
      useDefaultController: false, // Disable the default controller
      customController: [YourController], // Registers the custom controller
      isGlobal: true, // If you need, enables the module as global
    }),
  ], 
})
export class AppModule {}

```

## Extending Functionality with Other Storage Providers

The `CloudStorageAbstractModule` is designed to be flexible and support multiple cloud storage providers. To add support for another provider, follow these steps:

1. **Create a New Adapter**  
   - Create a new directory inside `cloud-storage`, for example: `gcs-adapter/` for Google Cloud Storage.  
   - Implement a service that follows the `ICloudStorageProvider` interface defined in `cloud-storage/abstract/cloud-storage-provider.interface.ts`.

2. **Define the Adapter Module**  
   - Create a module similar to `S3AdapterModule` to initialize the new provider.  
   - Ensure it provides a configuration mechanism (e.g., `register` or `registerAsync` methods).

3. **Register the Adapter in the Abstract Module**  
   - Modify `CloudStorageAbstractModule` to accept the new adapter as a dynamic module.  
   - Example:  
   ```typescript
   CloudStorageAbstractModule.forRoot({
     adapter: GCSAdapterModule.registerAsync({
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
   - For a secure and scalable integration with AWS S3, it is recommended to use IAM Roles instead of passing access keys explicitly. IAM Roles allow applications (e.g., EC2, Lambda, ECS) to assume roles and gain the necessary permissions to access S3 without needing to manage access keys manually. By using IAM Roles, you reduce the risk of exposing sensitive credentials and simplify the management of access permissions. For this reason, the environment variables AWS_ACCESS_KEY and AWS_SECRET_ACCESS_KEY are optional in this project

4. **Performance Optimization**

   - Enable content caching using a CDN (e.g., AWS CloudFront).
   - Set appropriate cache-control headers for frequently accessed files.
   - Consider multipart uploads for large files.

5. **Storage Cost Management**

   - Use lifecycle policies to move old files to lower-cost storage (e.g., S3 Glacier).
   - Regularly audit and clean up unused or orphaned files.
   - Monitor storage usage and costs to avoid unexpected charges.

6. **If you need, using the S3 Endpoint Option for Local Cloud Storage**

   - The endpoint option in AWS SDKs allows connecting to a custom S3-compatible storage service, such as a local MinIO server or an on-premise object storage system.
   - By specifying a custom endpoint, data can be stored and accessed without routing through AWS public endpoints, improving performance and reducing data transfer costs.
   - Ensure proper authentication and security settings when configuring the endpoint, especially when connecting to private or self-hosted storage solutions.

## Contributing

Feel free to submit issues and enhancement requests!