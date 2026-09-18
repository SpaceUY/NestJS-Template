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
| `PushNotificationAbstractModule` | `src/push-notification/abstract/push-notification-abstract.module.ts.ts` | `forRoot` only |
| `IPushNotification` and siblings | `src/push-notification/abstract/push-notification.interface.ts` | Payload shapes |
| `PushNotificationDto` | `src/push-notification/abstract/dto/push-notification.dto.ts` | Request DTO |
| `PushNotificationException` | `src/push-notification/abstract/push-notification.exception.ts` | Error type |
| `PUSH_NOTIFICATION_ERRORS`, `IErrorDefinition` | `src/push-notification/abstract/push-notification-error-codes.ts` | Error definitions |
| `PUSH_NOTIFICATION_PROVIDER` | `src/push-notification/abstract/push-notification-provider.const.ts` | Token an adapter module must provide |
| `ExpoAdapterModule` | `src/push-notification/expo-adapter/expo-adapter.module.ts` | Named only in `src/app.module.ts` |
| `expoScope`, `ExpoScopeConfig` | `src/push-notification/expo-adapter/config/expo.scope.ts` | Expo config |

Note the module file's real name: `push-notification-abstract.module.ts.ts`,
with a doubled extension (finding `N1`). Import it exactly as written until that
is fixed.

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
6. Failures do **not** throw `PushNotificationException`. The class is defined
   and type-checked against, but never constructed: `ExpoAdapterService`'s two
   `catch` blocks re-throw the raw `expo-server-sdk` error or the adapter's own
   `InternalServerErrorException` unchanged, so `PushNotificationController`'s
   `instanceof PushNotificationException` check never fires and every failure
   surfaces as `InternalServerErrorException`. This violates the root
   `CLAUDE.md`'s `T3` — the module does not own its error type in practice,
   whatever this guide used to claim. See `M15`.

## Adding an adapter

1. Create `src/push-notification/<provider>-adapter/` with a service extending
   `PushNotificationService`, a config interface, a config-token const and a
   module exposing `register`/`registerAsync`.
2. Bind the service to `PUSH_NOTIFICATION_PROVIDER` in that module's providers
   and export the token — mirror `src/push-notification/expo-adapter/expo-adapter.module.ts`.
3. Add `config/<provider>.scope.ts` and register it in `src/app.module.ts`.
4. Pass the adapter module as `adapter:` to `PushNotificationAbstractModule.forRoot`.
5. Add `<provider>-adapter.service.unit.spec.ts`.

## Tests

No test exists (finding `G1`). The Expo adapter is the place to start: mock
`expo-server-sdk` at module level, assert chunking behaviour and the re-thrown
SDK/`InternalServerErrorException` failure — not `PushNotificationException`,
which is never constructed (`M15`). No `abstract/mocks/` exists (finding `N5`).

## Reuse

Copy `src/push-notification/` whole; `expo-adapter/` needs `expo-server-sdk`.
`config/expo.scope.ts` depends on `src/config-provider/` and `joi`.

Be aware you are also copying findings `N1`, `N2` and `N3` — a project lifting
this module should plan to rename the module file, convert the error type to the
plain-`Error` shape, and add `forRootAsync`.

## Known gaps

See `docs/audit/2026-09-11-template-audit.md` and `docs/audit/2026-09-18-modularity-audit.md`.

- **`N1`** — `push-notification-abstract.module.ts.ts` has a doubled extension.
- **`N2`** — `PUSH_NOTIFICATION_ERRORS` contains three entries whose codes are all
  `CLOUD_STORAGE_*` copy-paste leftovers, and they describe file upload, not push.
- **`N3`** — no `forRootAsync`; the file ends with `// TODO: Add forRootAsync`.
  Also, `forRoot` mutates the caller's `controllers` array with `push`.
- **`D4`** — `src/push-notification/README.md` teaches `@nestjs/config` and `npm`.
- **`G1`**, **`N5`** — no tests, no mocks.
- **`M15`** — `PushNotificationException` is defined but never constructed;
  adapter failures escape as the raw SDK error or `InternalServerErrorException`
  instead (Rule 6).
