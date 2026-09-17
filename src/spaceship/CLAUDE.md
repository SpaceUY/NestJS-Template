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
2. **Controllers do not log** — `src/common/logger/PRACTICES.md`. Business logs
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
8. **Not-found is a 404.** `getSpaceshipById` returns `null` and the controller
   passes it through as a 200 with `data: null` (finding `R2`). Your service
   should throw `RequestException` from `src/common/exception/exceptions.ts`
   instead.
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

Both files here are named `*.spec.ts`, which is the legacy convention
(finding `N4`). New tests are `*.unit.spec.ts`.

## Reuse

Do not copy this module into a project. Delete it, and copy its *shape*:
`src/spaceship/spaceship.service.ts` for repository access and soft deletes,
`src/spaceship/spaceship.controller.ts` for guards and Swagger,
`src/spaceship/dto/` for DTO conventions, and
`src/spaceship/spaceship.service.spec.ts` for the test harness.

Deleting it means removing `src/spaceship/`, `src/database/entities/spaceship.entity.ts`,
the `Spaceship` entry in `TypeOrmModule.forFeature` in
`src/database/database.module.ts`, the `ship` relation on
`src/database/entities/user.entity.ts`, the `SpaceshipModule` import in
`src/app.module.ts`, and the `.addTag('spaceship')` call in `src/main.ts`.

## Known gaps

See `docs/audit/2026-09-11-template-audit.md`.

- **`R1`** — no handler declares a return type or an `@ApiResponse`.
- **`R2`** — a missing spaceship yields `200` with `data: null` instead of `404`.
- **`N4`** — both test files use the legacy `*.spec.ts` name.
- **`N6`** — `spaceship.module.ts` imports `AuthModule` by absolute path.
- **`R3`** — `src/user/user.module.ts` is an empty module nothing imports, yet it
  is where `current-user.decorator.ts` lives, so this module depends on that
  directory.
