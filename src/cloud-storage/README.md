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
├── cloud-storage.config.ts
├── cloud-storage.module.ts
├── cloud-storage-orchestrator.service.ts
├── cloud-storage.targets.ts
├── cloud-storage.tokens.ts
├── abstract/
│   ├── dto/
│   ├── cloud-storage-abstract.module.ts
│   ├── cloud-storage-error-codes.ts
│   ├── cloud-storage.exception.ts
│   └── cloud-storage.service.ts
├── s3-adapter/
│   ├── s3-adapter-config.interface.ts
│   └── s3-adapter.service.ts
├── local-adapter/
│   └── local-adapter.service.ts
├── storacha-adapter/
│   ├── storacha-adapter.client.ts
│   ├── storacha-adapter-config.interface.ts
│   └── storacha-adapter.service.ts
└── README.md
```

---

## Registration Options

> The abstract registration options below are still available.  
> The runtime app should typically consume [`CloudStorageModule`](./cloud-storage.module.ts), which composes adapters and exposes orchestration.

### 1) `CloudStorageAbstractModule.forRoot(...)`

Use this when the adapter can be instantiated by Nest without runtime constructor config.

`forRoot` accepts:

- `adapter: ClassConstructor<CloudStorageService>`
- `isGlobal?`
- `useDefaultController?` (default: `false`)

Example (local adapter):

```ts
import { CloudStorageAbstractModule } from "./abstract/cloud-storage-abstract.module";
import { LocalAdapterService } from "./local-adapter/local-adapter.service";

export const CloudStorageModule = CloudStorageAbstractModule.forRoot({
  adapter: LocalAdapterService,
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

This means the factory returns the concrete service instance (`S3AdapterService`, `StorachaAdapterService`, etc).

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

## Runtime Composition (`CloudStorageModule`)

`CloudStorageModule` wires two lanes:

- **S3 lane** (`CloudStorageService`) using either:
  - `LocalAdapterService` when `CLOUD_STORAGE_S3_BACKEND=LOCAL`
  - `S3AdapterService` when `CLOUD_STORAGE_S3_BACKEND=AWS_S3`
- **IPFS lane** using `StorachaAdapterService`

and exports [`CloudStorageOrchestratorService`](./cloud-storage-orchestrator.service.ts) for developer-level target selection via [`CLOUD_STORAGE_TARGET`](./cloud-storage.targets.ts).

---

## Built-in Adapters

### `LocalAdapterService`

`LocalAdapterService` is intended for local development and stores files in the project-level `/files` directory.

- `uploadFile` writes bytes to `/files` with a generated UUID-based filename.
- `getFile` validates that the file exists and returns `/files/<fileKey>`.
- `deleteFile` removes the file from `/files`.

Because it has no runtime config dependencies, it can be used with **`forRoot(...)`**.

---

### `S3AdapterService`

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

### `StorachaAdapterService`

`StorachaAdapterService` adapts the existing Storacha/IPFS flow to the cloud storage contract.

- `uploadFile` uploads to Storacha and returns a normalized CID-based public IPFS URL.
- `getFile` builds a deterministic public IPFS URL from a CID.
- `deleteFile` currently throws `NOT_IMPLEMENTED` (content-addressed storage is immutable in this flow).

Because it requires runtime config (`storageKey`, `storageProof`), **Storacha should be registered through `forRootAsync(...)`**.

Configuration:

```ts
interface StorachaAdapterConfig {
  storageKey: string;
  storageProof: string;
  gatewayPrefix?: string; // default: https://ipfs.io/ipfs/
}
```

Example composition:

```ts
import type { ConfigType } from "@nestjs/config";
import { CloudStorageAbstractModule } from "./abstract/cloud-storage-abstract.module";
import { cloudStorageConfig } from "./cloud-storage.config";
import { StorachaAdapterService } from "./storacha-adapter/storacha-adapter.service";

export const CloudStorageModule = CloudStorageAbstractModule.forRootAsync({
  isGlobal: true,
  inject: [cloudStorageConfig.KEY],
  useFactory: (config: ConfigType<typeof cloudStorageConfig>) =>
    new StorachaAdapterService({
      storageKey: config.ipfsStorageKey,
      storageProof: config.ipfsStorageProof,
    }),
});
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

## Orchestration Service

[`CloudStorageOrchestratorService`](./cloud-storage-orchestrator.service.ts) provides:

- `uploadFile(target, file)`
- `getFile(target, fileKey)`
- `deleteFile(target, fileKey)`

Where `target` is one of:

```ts
CLOUD_STORAGE_TARGET.S3
CLOUD_STORAGE_TARGET.IPFS
```

Example usage:

```ts
import { CLOUD_STORAGE_TARGET } from "@/modules/infrastructure/cloud-storage/cloud-storage.targets";

await cloudStorageOrchestratorService.uploadFile(
  CLOUD_STORAGE_TARGET.S3,
  file,
);
```

---

## Config

S3 composition typically reads from [`aws.config.ts`](../aws/aws.config.ts) in `useFactory`.

Cloud storage runtime selection uses [`cloud-storage.config.ts`](./cloud-storage.config.ts):

- `CLOUD_STORAGE_S3_BACKEND` (`LOCAL` | `AWS_S3`)
- `IPFS_STORAGE_KEY`
- `IPFS_STORAGE_PROOF`
- default: `LOCAL` when `NODE_ENV=local`, otherwise `AWS_S3`

S3 adapter constructor values (from [`aws.config.ts`](../aws/aws.config.ts)):

- `bucket`
- `region`
- `accessKeyId?`
- `secretAccessKey?`
- `expiresInSeconds`

Storacha composition should consume validated values from [`cloud-storage.config.ts`](./cloud-storage.config.ts) in `useFactory`.
Storacha configuration validation should happen at module/app composition level, not inside the adapter/client.

Expected values:

- `ipfsStorageKey`
- `ipfsStorageProof`
- `gatewayPrefix?`

---

## Why Keep Both Patterns?

- `forRoot` is useful for simple/no-config adapters (for example `LocalAdapterService`).
- `forRootAsync` makes config-driven adapter selection and instantiation explicit.
- For real cloud providers like S3 and Storacha/IPFS, `forRootAsync` is the standard path.
