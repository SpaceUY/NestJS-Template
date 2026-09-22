# Spaceship — reference domain module

> Inherits the repo-root `CLAUDE.md` (always loaded). Read it first — this file
> adds only what is specific to `src/spaceship/`.

**This module exists to be copied.** It is the worked example of a domain
module: DTOs, controller, service, repository, its own error type, a
cache-aside read, and a background job that emails several people when a
spaceship is created. A real project deletes it and writes its own in this
shape. Read "Creating a new domain module" below before writing one.

Every other module under `src/` is infrastructure, built to be lifted out.
This one is the opposite: it is built to be **deleted**, and every coupling it
has to the rest of the template is listed in `## Reuse` so that deleting it is
a checklist rather than an investigation.

## Scope

Owns spaceship CRUD and the notification that follows a create: the controller,
the service, the repository, the DTOs, its own `ExceptionInfo` descriptors, its
two config scopes, and the producer/processor pair for its queue.

Does not own: the `Spaceship` entity, which lives in
`src/database/entities/spaceship.entity.ts` with every other entity (`src/database/CLAUDE.md`
Rule 1), the `User` entity it relates to, or any of the infrastructure it uses —
queue, cache, email and templating all arrive as injected abstractions.

## Public surface

Nothing. A domain module is a leaf: no other module imports from it, and the
module graph shows no inbound edge. It exposes HTTP routes, and that is its
whole interface.

| Import | From | Purpose |
|---|---|---|
| `SpaceshipModule` | `src/spaceship/spaceship.module.ts` | Imported once by `src/app.module.ts` |

Routes: `POST /spaceships`, `GET /spaceships`, `GET /spaceships/:uuid`,
`PATCH /spaceships/:uuid`, `DELETE /spaceships/:uuid` — all behind
`AuthGuard('jwt')`.

## Configuration

| Scope | File | Variable |
|---|---|---|
| `spaceshipCacheScope` | `config/spaceship-cache.scope.ts` | `SPACESHIP_LIST_CACHE_TTL_SECONDS` |
| `notificationRecipientsScope` | `notification/config/notification-recipients.scope.ts` | `NOTIFICATION_EMPLOYEE_EMAILS` |

Both are registered in `src/app.module.ts`'s `ConfigProviderAbstractModule`
call and go with this module when it is deleted. A blank recipient list is
valid and means "notify nobody": the processor logs a warning and returns, so
an unconfigured template still boots and still serves `POST /spaceships`.

## Rules

1. **Layering.** Controller validates and delegates; the service holds the
   logic; the repository is the only thing that touches TypeORM. A controller
   never reaches a repository.
2. **Controllers do not log** — `src/common/observability/logger/PRACTICES.md`.
   Business logs go in the service.
3. **DTOs** live in `dto/`, one class per operation, with `class-validator`
   decorators and `@ApiProperty` on every field.

   The global `ValidationPipe` runs with `whitelist` and
   `forbidNonWhitelisted`, so an undeclared field is a 400. That only became
   true on 2026-09-22: `src/main.ts` had `forbidNonWhitelisted` without
   `whitelist`, which is inert, and `POST /spaceships` with an extra field
   answered 201. Verified against the running app after the fix.
4. **Route parameters are `uuid`, never `id`.** The integer PK is internal
   (`src/database/CLAUDE.md` Rule 2). Every lookup here is `where: { uuid }`,
   and `SpaceshipResponseDto` exposes the captain as `captainUuid`, never the
   `captainId` FK.
5. **Guards.** `@UseGuards(AuthGuard('jwt'))` plus `@ApiBearerAuth()` on the
   controller; the module imports `AuthModule`. Read the caller with
   `@CurrentUser() user: User` from `src/auth/decorators/`.
6. **Swagger.** `@ApiTags` on the controller, `@ApiBearerAuth()` where guarded,
   an explicit return type and an `@ApiResponse` on every handler.
7. **Deletes are soft** — `softRemove`, never `delete`.
8. **This module owns its errors** (invariant `T3`). `spaceship.exceptions.ts`
   holds the `ExceptionInfo` descriptors and `findByUuidOrFail` throws
   `RequestException` with one of them; callers never see a `null` spaceship.
   Do not add a domain entry to `src/common/exception/exceptions.ts`: `common`
   is platform code, and an entry there would outlive this module's deletion.
   `Exceptions.database.alreadyExists` is different — that one describes a
   Postgres constraint violation, which is the database module's vocabulary,
   not this domain's.
9. **The cache is aside, not in front.** The service reads through
   `CacheService`, falls back to the database on any cache failure, and
   invalidates on every write. A cache that is down degrades latency, never
   availability — every cache call is wrapped and logged at `warn`.
10. **A cached row is JSON, not an entity.** `JSON.parse` returns ISO strings
    where the entity declares `Date`. `reviveSpaceship` in
    `spaceship.service.ts` converts them back, so a cache hit and a cache miss
    return the same shape. Casting instead would leave the declared type lying.
11. **Enqueuing never fails a request.** `createSpaceship` catches and logs a
    producer failure: the spaceship is created either way. The email is a
    notification, not part of the transaction.

## The background half

`POST /spaceships` returns as soon as the row is written; the email goes out on
a BullMQ queue, consumed in the same process by
`notification/notification.processor.ts`.

The registration follows `src/queues/CLAUDE.md` Rule 2: this module declares
`SpaceshipNotificationProcessor` in its own `providers` and binds it with
`QueueConsumerModule.forFeature`. Nothing under `src/queues/` names a class
from here — that is what keeps `queues` liftable, and it is what stops an
`(app)` → `queues` → `spaceship` import cycle from forming.

One coupling is deliberate and is the documented `T1` exception of
`src/queues/CLAUDE.md` Rule 1: `notification.producer.ts` injects the
**concrete** `BullMqProducerAdapter`, because the abstract `QueueProducerService`
exposes only broker-agnostic `delay`/`priority` and this job needs BullMQ's
`attempts`/`backoff`. The alias that makes the concrete class injectable lives
in `notification/notification.module.ts` with an `instanceof` guard, so
swapping the wired adapter for RabbitMQ or SQS fails at **startup** rather than
at the first `addJob` inside a request. A domain that does not need retries
should inject the abstraction and skip all of this.

`SPACESHIP_NOTIFICATION_MAX_ATTEMPTS` is shared by the producer's
`options.attempts` and the processor's retries-exhausted check. They must
agree: `MessageContext` is broker-agnostic by design and cannot report the
configured maximum back to the consumer.

## Creating a new domain module

1. `mkdir src/<domain>` with `dto/`, `<domain>.module.ts`,
   `<domain>.controller.ts`, `<domain>.service.ts`, `<domain>.repository.ts`.
2. Add the entity to `src/database/entities/` and register it in
   `TypeOrmModule.forFeature` in `src/database/database.module.ts`.
3. Generate a migration against a live database — never `synchronize`
   (invariant `T8`).
4. Write DTOs with `class-validator` and `@ApiProperty`.
5. Write `<domain>.exceptions.ts` for the domain's own failures (Rule 8).
6. Write the service against the repository; look rows up by `uuid`.
7. Write the controller: `@ApiTags`, guards, explicit return types,
   `@ApiResponse`.
8. Import `AuthModule` in the module if any route is protected.
9. Add any config scope to `src/app.module.ts`'s `scopes` array and its
   variable to `.env.example`.
10. Register the module in `src/app.module.ts`, and add the directory to
    `TIERS` in `scripts/check-module-independence.mjs` as `feature`.
11. Write the specs — `*.unit.spec.ts` beside each file, plus a
    `<domain>.module.di.spec.ts` if the module has wiring a unit test cannot
    see.
12. Write `src/<domain>/CLAUDE.md` and `README.md` — copy the section order of
    this file, which is the order `pnpm run docs:check` enforces — and add the
    row to the module map in the root `CLAUDE.md` (invariant `T7`).

## Tests

`spaceship.service.unit.spec.ts` is the reference for service tests: a
`Test.createTestingModule` with every collaborator replaced by a plain jest
object, one `describe` per method, `jest.clearAllMocks()` in `afterEach`, and a
case per branch — including each cache failure path.

`spaceship.module.di.spec.ts` compiles the real Nest graph, which the unit
specs deliberately do not. It exists because three things fail only on actual
resolution: the handler resolving out of this module's injector after
`forFeature` bound it, that handler's non-global recipients provider resolving
with it, and the guarded alias finding a BullMQ producer — and refusing to
start when it finds something else. It is also the executable version of
`src/queues/README.md`'s per-feature registration example.

`src/database/entities/spaceship.entity.unit.spec.ts` runs both halves of the
`Spaceship`↔`User` relation selectors. A selector pointing at the wrong
property compiles and passes every repository-mocking test, then fails when
TypeORM builds its metadata against a live database.

## Reuse

**Do not copy this module into a project.** Delete it, and copy its *shape*:

| For | Read |
|---|---|
| Repository access, soft deletes, cache-aside | `spaceship.service.ts` |
| Provider-SDK error translation into a 404/409 | `spaceship.repository.ts` |
| A domain's own error descriptors | `spaceship.exceptions.ts` |
| Guards, Swagger, explicit return types | `spaceship.controller.ts` |
| DTO and response-mapping conventions | `dto/`, `mappers/` |
| A domain owning its own queue producer and consumer | `notification/` |
| A pluggable collaborator behind an abstract class | `notification/notification-recipients.provider.ts` and its two implementations |

**Deleting it** means removing, in this order:

1. `src/spaceship/` and `src/templates/spaceship/`.
2. `src/database/entities/spaceship.entity.ts`, its
   `src/database/entities/spaceship.entity.unit.spec.ts`, the `Spaceship` entry
   in `TypeOrmModule.forFeature` in `src/database/database.module.ts`, and the
   `ship` relation on `src/database/entities/user.entity.ts`.
3. A generated migration dropping the `spaceship` table — the table exists in
   `src/database/migrations/`, so deleting the entity is a schema change like
   any other (`T8`).
4. The `SPACESHIP_CREATED` entries in `src/templates/template.const.ts` (all
   three maps) and in `src/templates/template-params.interface.ts`.
5. In `src/app.module.ts`: the `SpaceshipModule` import and entry, and the
   `spaceshipCacheScope` / `notificationRecipientsScope` imports and `scopes`
   entries. Leave `CacheAbstractModule`, `QueueProducerModule` and
   `QueueConsumerModule` — they are infrastructure, registered for whatever
   comes next.
6. The `REFERENCE DOMAIN MODULE` block at the end of `.env.example`.
7. The `spaceship` row in the module map in the root `CLAUDE.md`, the module
   catalogue in `README.md`, and the `spaceship` entry in `TIERS` in
   `scripts/check-module-independence.mjs`.

Then `pnpm run docs:check && pnpm run modularity:check && pnpm test`.

`src/spaceship/README.md`'s `## Reuse` is the human version of this section.
Keep the two congruent (`T7`).

## Known gaps

**A cached `captain` keeps its dates as strings.** `reviveSpaceship` converts
the spaceship's own `createdAt`/`updatedAt`/`deletedAt` back to `Date`, and
nothing else. That is safe only because the repository's `select` loads no date
from the `captain` relation, so none is ever written to the cache — widen that
`select` and `reviveSpaceship` has to widen with it, or a cache hit and a cache
miss stop agreeing on types.

**The producer and the processor share one attempts number through config.**
`SPACESHIP_NOTIFICATION_MAX_ATTEMPTS` feeds the producer's `options.attempts`
and the processor's retries-exhausted check independently. They must agree:
`MessageContext` is broker-agnostic by design and cannot report the configured
maximum back to the consumer, so a mismatch shows up as a job that logs
"giving up" on the wrong delivery.

**Notification delivery is not transactional.** `createSpaceship` catches and
logs a producer failure, so the row exists whether or not the email was ever
enqueued. That is the intended trade — the notification is not part of the
write — but it means a dropped queue message is invisible to the caller.
