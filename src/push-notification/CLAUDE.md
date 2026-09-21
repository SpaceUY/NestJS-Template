# Push notification — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded) and
> `docs/architecture/module-contract.md`. Read those first — this file adds
> only what is specific to `src/push-notification/`.

**This module uses style-B registration** (adapter as module + provider token).
It is the older shape. Read the "two registration styles" section of the contract
before changing anything here, and do not copy style B into a new module.

## Scope

Owns push delivery behind a provider-agnostic contract, with an Expo adapter.

Does not own: device-token storage. Persisting and revoking tokens per user is a
domain concern; the template does not model it.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `PushNotificationService` | `src/push-notification/abstract/push-notification.service.ts` | The contract — `sendPushNotification`, `sendPushNotificationInChunks` — inject this |
| `PushNotificationAbstractModule` | `src/push-notification/abstract/push-notification-abstract.module.ts` | `forRoot` / `forRootAsync` |
| `MockPushNotificationService` | `src/push-notification/abstract/mocks/` | Test double |
| `IPushNotification` and siblings | `src/push-notification/abstract/push-notification.interface.ts` | Payload shapes |
| `PushNotificationDto` | `src/push-notification/abstract/dto/push-notification.dto.ts` | Request DTO |
| `PushNotificationError`, `PUSH_NOTIFICATION_ERRORS` | `src/push-notification/abstract/push-notification.error.ts` | Error type and codes — the plain-`Error` shape every adapter module here uses |
| `PUSH_NOTIFICATION_PROVIDER` | `src/push-notification/abstract/push-notification-provider.const.ts` | Token an adapter module must provide |
| `ExpoAdapterModule` | `src/push-notification/expo-adapter/expo-adapter.module.ts` | Named only in `src/app.module.ts` |
| `expoScope`, `ExpoScopeConfig` | `src/push-notification/expo-adapter/config/expo.scope.ts` | Expo config |

## Configuration

`expoScope` reads `EXPO_ACCESS_TOKEN`. `src/app.module.ts` registers
`PushNotificationAbstractModule.forRoot` with
`ExpoAdapterModule.registerAsync({ inject: [expoScope.KEY], … })` and
`useDefaultController: true`.

## Rules

1. Inject `PushNotificationService`. Never `ExpoAdapterService`.
2. An adapter module must bind its service to `PUSH_NOTIFICATION_PROVIDER` and
   export that token — that is the seam the abstract module aliases to
   `PushNotificationService`.
3. `useDefaultController` defaults to **`true`** here, unlike cloud-storage.
   `PushNotificationController` is a **test endpoint** that sends to an arbitrary
   token with no authentication. Set it to `false` for anything deployed, and
   pass your own guarded controller through `controllers`.
4. Send in chunks. Use `sendPushNotificationInChunks`, which exists because
   Expo rate-limits large sends; do not loop over `sendPushNotification`, the
   single-send method.
5. A device token is a credential. Never log it, never return it in a response.
6. Failures throw `PushNotificationError` with a code from
   `PUSH_NOTIFICATION_ERRORS` — never a raw `expo-server-sdk` error and never
   an `HttpException` (invariant `T3`). An adapter has no business naming an
   HTTP status; mapping the code to one is the controller's job, and
   `PushNotificationController._asHttpException` is the only place that does
   it. It answers `400` for `INVALID_TOKEN` and a fixed `500` for everything
   else, with a message written there rather than taken from the provider.

## Adding an adapter

1. Create `src/push-notification/<provider>-adapter/` with a service extending
   `PushNotificationService`, a config interface, a config-token const and a
   module exposing `register`/`registerAsync`.
2. Bind the service to `PUSH_NOTIFICATION_PROVIDER` in that module's providers
   and export the token — mirror `src/push-notification/expo-adapter/expo-adapter.module.ts`.
3. Add `config/<provider>.scope.ts` and register it in `src/app.module.ts`.
4. Pass the adapter module as `adapter:` to `PushNotificationAbstractModule.forRoot`,
   or import its `registerAsync` result and hand `PUSH_NOTIFICATION_PROVIDER`
   back through `forRootAsync` — see that method's doc comment.
5. Add `<provider>-adapter.service.unit.spec.ts`.

## Tests

`push-notification.controller.unit.spec.ts` covers the code-to-status mapping
and asserts no provider text reaches the response;
`expo-adapter.service.unit.spec.ts` covers the token-validation path, which
needs no network; `push-notification-abstract.module.unit.spec.ts` covers both
registration paths, including that `forRoot` no longer mutates the caller's
`controllers` array. `expo-adapter.send.unit.spec.ts` covers the send and
chunking paths with `expo-server-sdk` mocked at module level — the real
`Expo.isExpoPushToken` is kept through `requireActual`, since the validation
path depends on it. It asserts the message payload, the deep-link branch, the
error-ticket and thrown-failure translations, the dropping of invalid tokens
before chunking, the success/failure split of a chunk report, and rule 5 on
both paths: no device token reaches the log.

`src/push-notification/abstract/mocks/push-notification.service.mock.ts` gives
`MockPushNotificationService` — every method a `jest.fn()` with a sane default,
the same shape `src/cache/abstract/mocks/` uses.

## Reuse

Copy `src/push-notification/` whole; `expo-adapter/` needs `expo-server-sdk`.
`config/expo.scope.ts` depends on `src/config-provider/` and `joi`.

Be aware you are also copying finding `N3` — a project lifting this module
should plan to add `forRootAsync`.

## Known gaps

See `docs/audit/2026-09-11-template-audit.md` and `docs/audit/2026-09-18-modularity-audit.md`.

- **`N1`** — ~~`push-notification-abstract.module.ts.ts` has a doubled extension.~~
  **Fixed on `chore/dead-code-and-error-model`.**
- **`N2`** — ~~`PUSH_NOTIFICATION_ERRORS` contains three entries whose codes are all
  `CLOUD_STORAGE_*` copy-paste leftovers, and they describe file upload, not push.~~
  **Fixed on `chore/dead-code-and-error-model`:** the codes are now
  `PUSH_NOTIFICATION_*` and describe push failures, in the `cache.error.ts`
  shape.
- **`N3`** — ~~no `forRootAsync`; the file ends with `// TODO: Add forRootAsync`.
  Also, `forRoot` mutates the caller's `controllers` array with `push`.~~
  **Fixed on `chore/module-gaps`:** `forRootAsync` takes the factory shape every
  other abstract module in the template uses, and both paths build a fresh
  controllers array. The adapter-as-module style itself (style B) is unchanged.
- **`D4`** — ~~`src/push-notification/README.md` teaches `@nestjs/config` and
  `npm`.~~ **Fixed (`@nestjs/config`):** every registration example now injects
  `expoScope` via `@Inject(expoScope.KEY)` and types the factory parameter as
  `ExpoScopeConfig`, matching `src/app.module.ts`. The `npm` half of this bullet
  is `DOC9`'s installation-line defect
  (`docs/audit/2026-09-18-modularity-audit.md`), not `D4`'s — fixed separately
  in this same branch.
- **`G1`** — ~~the send and chunking paths are still untested.~~ **Fixed on
  `test/coverage-email-templating-push`:** `expo-adapter.send.unit.spec.ts`.
- **`H5`** — ~~the chunk report logged the failing device token
  (`getExpoPushNotificationChunkReport`), against rule 5. Found writing the test
  above.~~ **Fixed on the same branch:** the log line names no token; the token
  is still returned in the report, which is where the caller needs it.
- **`N5`** — ~~no `abstract/mocks/`.~~ **Fixed on `chore/module-gaps`:**
  `src/push-notification/abstract/mocks/push-notification.service.mock.ts`.
- **`M15`** — ~~`PushNotificationException` is defined but never constructed;
  adapter failures escape as the raw SDK error or `InternalServerErrorException`
  instead (Rule 6).~~ **Fixed on `chore/dead-code-and-error-model`:**
  `PushNotificationException` is gone, `ExpoAdapterService` throws
  `PushNotificationError` on every failure path, and the controller's mapping
  is covered by a spec.
