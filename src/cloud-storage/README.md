# Cloud Storage Module

Provider-agnostic cloud storage with emails-style adapter composition.

This module supports two registration strategies:

1. `forRoot` (adapter class style)
2. `forRootAsync` (service factory style, recommended for config-dependent adapters)

---

## Core Contract

The public service is [`CloudStorageService`](./abstract/cloud-storage.service.ts):

- `uploadFile(file)`
- `deleteFile(fileKey)`
- `getFile(fileKey)`

---

## Directory Structure

```text
src/modules/infrastructure/cloud-storage/
├── abstract/
│   ├── dto/
│   ├── cloud-storage-abstract.module.ts
│   ├── cloud-storage-error-codes.ts
│   ├── cloud-storage.exception.ts
│   └── cloud-storage.service.ts
├── s3-adapter/
│   ├── s3-adapter-config.interface.ts
│   └── s3-adapter.service.ts
└── README.md
```

---

## Registration Options

### 1) `CloudStorageAbstractModule.forRoot(...)`

Use this when the adapter can be instantiated by Nest without runtime constructor config.

`forRoot` accepts:

- `adapter: ClassConstructor<CloudStorageService>`
- `isGlobal?`
- `useDefaultController?` (default: `false`)

Example (no-config adapter):

```ts
import { Injectable } from "@nestjs/common";
import { CloudStorageAbstractModule } from "./abstract/cloud-storage-abstract.module";
import { CloudStorageService } from "./abstract/cloud-storage.service";

@Injectable()
class InMemoryStorageAdapterService extends CloudStorageService {
  async uploadFile(file) {
    return { id: "mock-id", url: `memory://${file.originalname ?? "file"}` };
  }

  async deleteFile() {}

  async getFile(fileKey) {
    return { id: fileKey, url: `memory://${fileKey}` };
  }
}

export const CloudStorageModule = CloudStorageAbstractModule.forRoot({
  adapter: InMemoryStorageAdapterService,
  isGlobal: true,
  useDefaultController: true,
});
```

### 2) `CloudStorageAbstractModule.forRootAsync(...)`

Use this when adapter construction depends on runtime config (recommended for production adapters).

`forRootAsync` accepts:

- `imports?`
- `inject?`
- `useFactory(...deps): CloudStorageService | Promise<CloudStorageService>`
- `isGlobal?`
- `useDefaultController?` (default: `false`)

This means the factory returns the concrete service instance (`S3AdapterService`, etc).

Current recommended composition with S3:

```ts
import type { ConfigType } from "@nestjs/config";
import { CloudStorageAbstractModule } from "./abstract/cloud-storage-abstract.module";
import { S3AdapterService } from "./s3-adapter/s3-adapter.service";
import { awsConfig } from "@/modules/infrastructure/aws/aws.config";

export const CloudStorageModule = CloudStorageAbstractModule.forRootAsync({
  isGlobal: true,
  useDefaultController: true,
  inject: [awsConfig.KEY],
  useFactory: (aws: ConfigType<typeof awsConfig>) =>
    new S3AdapterService({
      bucket: aws.rawDataBucket,
      region: aws.region,
      accessKeyId: aws.accessKeyId,
      secretAccessKey: aws.secretAccessKey,
      expiresInSeconds: 3600,
    }),
});
```

---

## S3 Adapter

`S3AdapterService` is a plain service (no adapter-module token indirection) and requires `S3AdapterConfig` in its constructor.

Because of this constructor requirement, **S3 should be registered through `forRootAsync(...)`**, where `useFactory` builds `new S3AdapterService(config)`.

Configuration:

```ts
interface S3AdapterConfig {
  bucket: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  expiresInSeconds: number;
}
```

---

## Default Controller

[`CloudStorageController`](./abstract/cloud-storage.controller.ts) is a fully-fledged controller that can be mounted by the abstract module when `useDefaultController: true`.

Routes:

- `POST /cloud-storage` (multipart field: `file`)
- `DELETE /cloud-storage/:fileKey`
- `GET /cloud-storage/:fileKey`

By default, it is **disabled** and only registered when explicitly enabled via `useDefaultController`.

---

## Config

S3 composition typically reads from [`aws.config.ts`](../aws/aws.config.ts) in `useFactory`.

Expected values:

- `bucket`
- `region`
- `accessKeyId?`
- `secretAccessKey?`
- `expiresInSeconds`

---

## Why Keep Both Patterns?

- `forRoot` is useful for simple/no-config adapters (tests, mocks, in-memory implementations).
- `forRootAsync` makes config-driven adapter selection and instantiation explicit.
- For real cloud providers like S3, `forRootAsync` is the standard path.
