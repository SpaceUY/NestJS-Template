# Spaceship — reference domain module

> Inherits the repo-root `CLAUDE.md` (always loaded). Read it first — this file
> adds only what is specific to `src/spaceship/`.

**This module exists to be copied.** It is the worked example of a domain
module: DTOs, controller, service, repository access, auth, tests. A real
project deletes it and writes its own in this shape. Read the "Creating a new
domain module" section below before writing one.

## Scope

Owns spaceship CRUD. A domain module owns its controller, its service, its DTOs
and its route surface.

Does not own: the `Spaceship` entity, which lives in
`src/database/entities/spaceship.entity.ts` with every other entity, and the
`User` entity it relates to.

## Public surface

Nothing. A domain module is a leaf — no other module imports from it. It exposes
HTTP routes, and that is its whole interface.

| Import | From | Purpose |
|---|---|---|
| `SpaceshipModule` | `src/spaceship/spaceship.module.ts` | Imported once by `src/app.module.ts` |

## Rules

1. **Layering.** Controller validates and delegates; service holds the logic and
   the repository; the repository is injected with `@InjectRepository(Entity)`.
   A controller never touches a repository.
2. **Controllers do not log** — `src/common/observability/logger/PRACTICES.md`. Business logs
   go in the service.
3. **DTOs** live in `dto/`, one class per operation, with `class-validator`
   decorators and `@ApiProperty` on every field. The global `ValidationPipe` runs
   with `forbidNonWhitelisted`, so an undeclared field is a 400.
4. **Route parameters are `uuid`, never `id`.** The integer PK is internal
   (`src/database/CLAUDE.md`). Every lookup here is `where: { uuid }`.
5. **Guards.** `@UseGuards(AuthGuard('jwt'))` plus `@ApiBearerAuth()` on the
   controller; the module imports `AuthModule`. Read the caller with
   `@CurrentUser() user: User`.
6. **Swagger.** `@ApiTags` on the controller, `@ApiBearerAuth()` where guarded.
   Every handler should declare its return type and its `@ApiResponse` — the
   handlers here do neither (finding `R1`), which is exactly what not to copy.
7. **Deletes are soft** — `softRemove`, never `delete`.
8. **Not-found is a 404.** `spaceship.repository.ts`'s `findByUuidOrFail`
   throws `RequestException` via `Exceptions.spaceship.notFound({ uuid })`
   (`src/common/exception/exceptions.ts`) when no row matches; callers never
   see a `null` spaceship. This was previously a `200` with `data: null`
   (finding `R2`, now fixed) — new lookups should use `findByUuidOrFail`, not
   reintroduce a nullable find.
9. **Imports are relative** (invariant `T5`). `src/spaceship/spaceship.module.ts:2`
   uses an absolute `src/auth/auth.module` specifier (finding `N6`) — do not copy it.

## Creating a new domain module

1. `mkdir src/<domain>` with `dto/`, `<domain>.module.ts`,
   `<domain>.controller.ts`, `<domain>.service.ts`.
2. Add the entity to `src/database/entities/` and register it in
   `TypeOrmModule.forFeature` in `src/database/database.module.ts`.
3. Generate a migration — never `synchronize` (invariant `T8`).
4. Write DTOs with `class-validator` and `@ApiProperty`.
5. Write the service against the injected repository; look rows up by `uuid`;
   throw `RequestException` for domain failures.
6. Write the controller: `@ApiTags`, guards, explicit return types,
   `@ApiResponse`.
7. Import `AuthModule` in the module if any route is protected.
8. Register the module in `src/app.module.ts`.
9. Write `<domain>.service.unit.spec.ts` and `<domain>.controller.unit.spec.ts`.
10. Write `src/<domain>/CLAUDE.md` from the skeleton in
    `docs/architecture/module-contract.md` and add it to the module map in the
    root `CLAUDE.md` (invariant `T7`).

## Tests

`src/spaceship/spaceship.service.spec.ts` is the reference for service tests:
a `Test.createTestingModule` with the repository replaced through
`getRepositoryToken(Spaceship)` and a plain jest object, one `describe` per
method, `jest.clearAllMocks()` in `afterEach`. Every branch gets a case —
including the `null` return.

`spaceship.controller.spec.ts` and `spaceship.service.spec.ts` are still named
`*.spec.ts`, the legacy convention (finding `N4`); `spaceship.repository.unit.spec.ts`
has been renamed to the current one. New tests are `*.unit.spec.ts`.

## Reuse

Do not copy this module into a project. Delete it, and copy its *shape*:
`src/spaceship/spaceship.service.ts` for repository access, soft deletes and
cache-aside reads/writes, `src/spaceship/spaceship.controller.ts` for guards
and Swagger, `src/spaceship/dto/` for DTO conventions,
`src/spaceship/spaceship.service.spec.ts` for the test harness, and
`src/spaceship/notification/` for a worked example of a domain module owning
its own queue producer/processor on top of `src/queues/` (see
`src/queues/CLAUDE.md`).

Two couplings in that worked example are deliberate, and copying it means
copying them knowingly (both are `src/queues/CLAUDE.md` Rule 1 and Rule 2):

- `notification.producer.ts` injects the **concrete** `BullMqProducerAdapter`,
  not the abstract `QueueProducerService` — a documented `T1` exception, because
  the abstract `dispatch()` exposes only broker-agnostic `delay`/`priority`,
  while this notification needs BullMQ's `attempts`/`backoff`. Swapping the
  wired adapter to RabbitMQ/SQS therefore fails at startup, by design; the
  guard is in `src/queues/queues.module.ts`.
- `SpaceshipNotificationProcessor` is **not** declared in
  `notification.module.ts`. It is registered as a consumer handler in
  `src/queues/queues.module.ts`, which is also where it is instantiated,
  because `QueueConsumerModule` takes one app-wide `consumers` array and has no
  `forFeature` equivalent. Adding a queue consumer to a domain module means
  editing `src/queues/queues.module.ts` too, along with any non-global provider
  the handler injects.

Deleting it means removing `src/spaceship/`, `src/database/entities/spaceship.entity.ts`,
the `Spaceship` entry in `TypeOrmModule.forFeature` in
`src/database/database.module.ts`, the `ship` relation on
`src/database/entities/user.entity.ts`, the `SpaceshipModule` import in
`src/app.module.ts`, the `.addTag('spaceship')` call in `src/main.ts`, and —
since this branch wired them in for `src/spaceship/notification/` and its
cache-aside reads — the `notificationRecipientsScope` and
`spaceshipCacheScope` imports/registrations in `src/app.module.ts` (leave
`CacheAbstractModule` and `QueuesModule` themselves; another module may still
use them).

## Known gaps

See `docs/audit/2026-09-11-template-audit.md`.

- **`R1`** — no handler declares a return type or an `@ApiResponse`.
- **`R2`** — ~~a missing spaceship yields `200` with `data: null` instead of
  `404`~~. **Fixed:** `findByUuidOrFail` now throws `RequestException` via
  `Exceptions.spaceship.notFound`.
- **`N4`** — ~~both test files use the legacy `*.spec.ts` name~~. **Partially
  fixed:** `spaceship.repository.unit.spec.ts` was renamed; `spaceship.controller.spec.ts`
  and `spaceship.service.spec.ts` are still legacy-named.
- **`N6`** — `spaceship.module.ts` imports `AuthModule` by absolute path.
- **`R3`** — `src/user/user.module.ts` is an empty module nothing imports, yet it
  is where `current-user.decorator.ts` lives, so this module depends on that
  directory.
