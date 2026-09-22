# Push notification — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded). Read it first — this file
> adds only what is specific to `src/push-notification/`.

**This module uses style-B registration**: the adapter ships its own
`register`/`registerAsync` module and the abstract module aliases its token.
Style A — what `src/cache/` does, where the abstract module binds the adapter
class itself — is what a new module should use. Do not copy style B.

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
5. A device token is a credential. Never log it, never return it in a
   response — **and never quote the provider's error prose anywhere**, which is
   the same leak wearing a disguise: Expo's `DeviceNotRegistered` message reads
   `"ExponentPushToken[…]" is not a registered push notification recipient`.
   Surface `details.error`, a closed set of codes, and nothing else. That is
   what `ExpoAdapterService._providerErrorOf` is for, and it feeds the log line,
   the thrown `PushNotificationError` and the chunk report's `message` alike.
   The failing token still reaches the caller in the report's own `pushToken`
   field, because revoking the device needs it. The same applies to a *thrown*
   SDK error: `_asModuleError` drops its message rather than forwarding it,
   since an `expo-server-sdk` rejection can quote the request body it was
   handed, and that body carries the token.
6. Log through `this.logger`, inherited from `PushNotificationService` —
   never `console`. An adapter takes `@Optional() logger?: LoggerService` last
   and the base falls back to a `NestLoggerAdapter`, so the module registers
   with or without `LoggerAbstractModule`. Rule 5 still binds every line: no
   device token, and no `error:` field on a provider rejection, because an Expo
   error can quote the token it was given.
7. Failures throw `PushNotificationError` with a code from
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

That last assertion reads the whole serialized `LogInput`, message and data
together, through a recording `LoggerService` handed to the adapter — not one
field of it, and not `console`, which is what the adapter used to write to.

`src/push-notification/abstract/mocks/push-notification.service.mock.ts` gives
`MockPushNotificationService` — every method a `jest.fn()` with a sane default,
the same shape `src/cache/abstract/mocks/` uses.

## Reuse

Copy `src/push-notification/` whole; `expo-adapter/` needs `expo-server-sdk`.
Two companions: `src/config-provider/` (plus `joi`) for
`config/expo.scope.ts`, and `src/common/observability/logger/` for the
`LoggerService` the abstract service defaults and the adapter optionally takes.
The logger is `@Optional()`, so the module registers without
`LoggerAbstractModule`; the import still has to resolve.

You are also copying registration style B, described at the top of this file.
Both sides expose `forRoot`/`forRootAsync`, so the extra indirection is all that
distinguishes it — harmless here, not a shape to reproduce.

`src/push-notification/README.md`'s `## Reuse` is the human version of this
section. Keep the two congruent.

## Known gaps

**A device push token is a credential, and this is the module that handles
them.** Rule 5 forbids logging one, and the hard part is that Expo does not put
the token only in a token field: it builds its error *prose* out of the token,
so logging `ExpoPushErrorTicket.message` leaks it just as surely. That is why
`_providerErrorOf` surfaces `details.error` and nothing else, on all three
surfaces — the log line, the thrown error and the chunk report. A fixture that
puts a bare code like `'DeviceNotRegistered'` in `message` will not catch a
regression here; fixtures must carry Expo's real message shape.

**Delivery is best-effort and the report is the only record.** A chunk can
partially fail, and the caller gets the failing tokens back in the report
rather than as an exception. Nothing retries, and nothing prunes a token Expo
reports as unregistered — a project that sends at volume needs both, and the
report is where to build them from.

**The config parameter is decorated with `@Inject`,** unlike every other adapter
here, which takes a plain constructor parameter. It works; it is just the one
place the shape differs, so do not read it as the convention.
