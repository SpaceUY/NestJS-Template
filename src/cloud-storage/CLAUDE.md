# Cloud storage — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded) and
> `docs/architecture/module-contract.md`. Read those first — this file adds
> only what is specific to `src/cloud-storage/`.

## Scope

Owns file upload, retrieval and deletion behind a provider-agnostic contract,
with an optional mountable controller.

Does not own: file metadata persistence, virus scanning, or image processing. A
project that needs those adds a domain module that consumes `CloudStorageService`.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `CloudStorageService` | `src/cloud-storage/abstract/cloud-storage.service.ts` | `uploadFile`, `getFile`, `deleteFile` — inject this |
| `CloudStorageAbstractModule` | `src/cloud-storage/abstract/cloud-storage-abstract.module.ts` | `forRoot` / `forRootAsync` |
| `CloudStorageError`, `CLOUD_STORAGE_ERRORS` | `src/cloud-storage/abstract/cloud-storage.error.ts` | Error type and codes |
| `UploadFileDto` | `src/cloud-storage/abstract/dto/upload-file.dto.ts` | Upload payload |
| `FileResponseDto` | `src/cloud-storage/abstract/dto/file-response.dto.ts` | Response shape |
| `CloudStorageController` | `src/cloud-storage/abstract/cloud-storage.controller.ts` | Mounted only via `useDefaultController: true` |
| `S3AdapterService` | `src/cloud-storage/s3-adapter/s3-adapter.service.ts` | Named only in `src/app.module.ts` |
| `LocalAdapterService` | `src/cloud-storage/local-adapter/local-adapter.service.ts` | Not currently registered in `src/app.module.ts`; wire it through `forRoot` for local development |
| `s3Scope`, `S3ScopeConfig` | `src/cloud-storage/s3-adapter/config/s3.scope.ts` | S3 config |
| `MockCloudStorageService` | `src/cloud-storage/abstract/mocks/` | Test double |

## Configuration

`s3Scope` reads `AWS_S3_BUCKET_NAME`, `AWS_REGION`, `AWS_ACCESS_KEY`,
`AWS_SECRET_ACCESS_KEY` and `AWS_S3_EXPIRES_IN_SECONDS` (default `3600`).
Registered in `src/app.module.ts`, which currently wires `S3AdapterService`
through `forRootAsync` with `useDefaultController: true`.

`LocalAdapterService` takes no configuration and writes to a project-level
`/files` directory — development only. Because it needs no config it is the one
adapter here that suits `forRoot`.

## Rules

1. Inject `CloudStorageService`. Never inject `S3AdapterService` or
   `LocalAdapterService` (invariant `T1`).
2. Adapters do not declare a logger. `CloudStorageService` owns a `protected
   logger` defaulting to `new NestLoggerAdapter(<adapter class name>)`, and
   `CloudStorageAbstractModule` optionally injects the container's
   `LoggerService` and calls `setLogger()` on the instance it builds. Declaring
   a `logger` field in an adapter shadows the inherited one and silently
   defeats that injection. `email`, `config-provider` and `queues` use the same
   pattern.
3. Adapter selection belongs in the `useFactory` in `src/app.module.ts` — local
   for development, S3 for deployed environments. Do not branch on the
   environment inside a service.
4. `useDefaultController` defaults to `false`. Mounting it exposes
   `POST /cloud-storage`, `GET /cloud-storage/:fileKey` and
   `DELETE /cloud-storage/:fileKey` **with no authentication**. For anything
   beyond a demo, leave it off and write a controller that applies
   `AuthGuard('jwt')` and your own authorization.
5. Adapters throw `CloudStorageError` with a `CLOUD_STORAGE_ERRORS` code. An
   `@aws-sdk` error must never escape the adapter.
6. A file key is opaque. Never build one from user-supplied input without
   validating it; `CLOUD_STORAGE_ERRORS.INVALID_KEY` exists for that rejection.
7. AWS credentials are optional in `S3AdapterConfig` precisely so deployed
   environments can use the task IAM role. Prefer the role; set explicit keys
   only for local work.
8. Presigned URLs are time-bounded by `expiresInSeconds`. Keep it short; do not
   raise it to paper over a slow client.

## Adding an adapter

1. Create `src/cloud-storage/<provider>-adapter/<provider>-adapter.service.ts`
   extending `CloudStorageService`.
2. Add `<provider>-adapter-config.interface.ts` for the constructor options.
3. Add `config/<provider>.scope.ts` if it needs configuration.
4. Translate every SDK error into `CloudStorageError`.
5. Register it in the `forRootAsync` factory in `src/app.module.ts`.
6. Add `<provider>-adapter.service.unit.spec.ts`.

## Tests

This module is reasonably covered:
`src/cloud-storage/abstract/cloud-storage-abstract.module.unit.spec.ts`,
`src/cloud-storage/local-adapter/local-adapter.service.unit.spec.ts` and
`src/cloud-storage/s3-adapter/s3-adapter.service.unit.spec.ts`. Follow the local
adapter test: `jest.mock('node:fs/promises')` and `jest.mock('uuid')` at module
level, construct with `new`, assert both the happy path and the thrown
`CloudStorageError`.

`src/cloud-storage/abstract/mocks/cloud-storage.service.mock.ts` gives
`MockCloudStorageService` for consumers that only need a `CloudStorageService`
in their container — every method a `jest.fn()` with a sane default, the same
shape `src/cache/abstract/mocks/` uses.

## Reuse

Copy `src/cloud-storage/abstract/` plus the adapters you want.

- `abstract/` needs `@nestjs/common`, `@nestjs/swagger`, `class-validator` and
  `@types/multer`.
- `s3-adapter/` needs `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`,
  and its scope depends on `src/config-provider/`.
- `local-adapter/` needs `uuid` and nothing else.

Drop `cloud-storage.controller.ts` if the target project brings its own.

## Known gaps

See `docs/audit/2026-09-11-template-audit.md`.

- **`D1`** — ~~`src/cloud-storage/README.md` documents an orchestrator, a targets
  enum, a tokens file, a config file and an IPFS adapter, all under a
  `!src/modules/infrastructure/` path. None of it exists.~~ **Fixed:** the
  README now describes the real tree and registration examples; the
  orchestrator/targets/tokens/IPFS sections were never-built design and were
  removed rather than described.
- **`N2`** — ~~`src/cloud-storage/abstract/cloud-storage.controller.ts` throws
  `ApiException`, a plain `Error` carrying no HTTP status, so three validation
  failures answer `500` where `400` was intended.~~ **Fixed on
  `chore/dead-code-and-error-model`:** the three throws are
  `BadRequestException`, `ApiException` is deleted, and this module no longer
  imports `src/common/exception/` at all. `!src/common/enums.ts` was deleted
  outright afterwards (finding `H2`) — it had no consumers left.
- **`N5`** — ~~no `abstract/mocks/`.~~ **Fixed on `chore/module-gaps`:**
  `src/cloud-storage/abstract/mocks/cloud-storage.service.mock.ts`.
- **`C1`** — ~~`AWS_REGION` and `AWS_S3_EXPIRES_IN_SECONDS` are missing from
  `.env.example`.~~ **Fixed on `fix/security-defaults`:** both are declared.
