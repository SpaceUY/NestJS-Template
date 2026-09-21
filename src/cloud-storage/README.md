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
src/cloud-storage/
├── abstract/
│   ├── dto/
│   │   ├── file-response.dto.ts
│   │   └── upload-file.dto.ts
│   ├── cloud-storage-abstract.module.ts
│   ├── cloud-storage.controller.ts
│   ├── cloud-storage.error.ts
│   ├── cloud-storage.interfaces.ts
│   └── cloud-storage.service.ts
├── s3-adapter/
│   ├── config/
│   │   └── s3.scope.ts
│   ├── s3-adapter-config.interface.ts
│   └── s3-adapter.service.ts
├── local-adapter/
│   └── local-adapter.service.ts
└── README.md
```

---

## Registration Options

The app composes this module directly through `CloudStorageAbstractModule`;
there is no separate composed `CloudStorageModule` file.

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

// in the `imports` array of the module that wires it up
CloudStorageAbstractModule.forRoot({
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

This means the factory returns the concrete service instance (i.e. `S3AdapterService`).

Current recommended composition with S3, as wired in `src/app.module.ts`:

```ts
import { CloudStorageAbstractModule } from "./abstract/cloud-storage-abstract.module";
import { S3AdapterService } from "./s3-adapter/s3-adapter.service";
import { s3Scope, S3ScopeConfig } from "./s3-adapter/config/s3.scope";

// in the `imports` array of the module that wires it up
CloudStorageAbstractModule.forRootAsync({
  isGlobal: true,
  useDefaultController: true,
  inject: [s3Scope.KEY],
  useFactory: (s3: S3ScopeConfig) =>
    new S3AdapterService({
      bucket: s3.bucket,
      region: s3.region,
      accessKeyId: s3.accessKeyId,
      secretAccessKey: s3.secretAccessKey,
      expiresInSeconds: s3.expiresInSeconds,
    }),
});
```

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

## Default Controller

[`CloudStorageController`](./abstract/cloud-storage.controller.ts) is a fully-fledged controller that can be mounted by the abstract module when `useDefaultController: true`.

Routes:

- `POST /cloud-storage` (multipart field: `file`)
- `DELETE /cloud-storage/:fileKey`
- `GET /cloud-storage/:fileKey`

By default, it is **disabled** and only registered when explicitly enabled via `useDefaultController`.

---

## Config

S3 composition reads from [`s3.scope.ts`](./s3-adapter/config/s3.scope.ts), which
defines `S3ScopeConfig` and is registered in `src/app.module.ts` (invariant `T2`):

- `bucket` — `AWS_S3_BUCKET_NAME`
- `region` — `AWS_REGION`
- `accessKeyId?` — `AWS_ACCESS_KEY`
- `secretAccessKey?` — `AWS_SECRET_ACCESS_KEY`
- `expiresInSeconds` — `AWS_S3_EXPIRES_IN_SECONDS` (default `3600`)

---

## Why Keep Both Patterns?

- `forRoot` is useful for simple/no-config adapters (for example `LocalAdapterService`).
- `forRootAsync` makes config-driven adapter selection and instantiation explicit.
- For a real cloud provider like S3, `forRootAsync` is the standard path.

## Reuse

**Two supported workflows.** Clone the template whole, or lift only the modules
you need — this one is written for both. What follows is the second case: what
`src/cloud-storage/` needs in order to compile in another project.

**What travels with it.** Copy `src/cloud-storage/abstract/` plus the adapters
you want, then bring:

- `src/common/observability/logger/` — `abstract/cloud-storage.service.ts`, the
  abstract module and the mock all reference `LoggerService`.
- `src/config-provider/abstract/` — only if you take `s3-adapter/`, whose
  `config/s3.scope.ts` imports the scope helpers. `local-adapter/` needs none.

**Peer dependencies.**

```bash
pnpm add @nestjs/swagger class-validator          # abstract/
pnpm add -D @types/multer                         # abstract/
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner   # s3-adapter/
pnpm add uuid                                     # local-adapter/
```

**What to drop.** `abstract/cloud-storage.controller.ts` is a default REST
surface, not part of the contract — leave it out if the target project brings
its own routes. Nothing else in the module references it.

**Removing it from the template instead.** Nothing imports
`src/cloud-storage/`; it comes out in three edits.
