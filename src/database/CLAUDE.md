# Database — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded). Read it first — this file
> adds only what is specific to `src/database/`.

## Scope

Owns the TypeORM connection, the entity definitions, the base entity, and the
migration directory. Global (`@Global()`), so `TypeOrmModule` is available
everywhere without re-importing.

Does not own: repositories or queries. Those live in the service of the module
that owns the data.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `DatabaseModule` | `src/database/database.module.ts` | Imported once by `src/app.module.ts` |
| `buildTypeOrmOptions` | `src/database/database.module.ts` | The connection factory, exported so it can be tested |
| `BaseEntity` | `src/database/entities/base.entity.ts` | Every entity extends it |
| `User` | `src/database/entities/user.entity.ts` | Auth identity |
| `AuthType` | `src/database/entities/auth-type.enum.ts` | `EMAIL` / `GOOGLE` / `AUTH0`; stored on `User.authType` |
| `Spaceship` | `src/database/entities/spaceship.entity.ts` | The reference domain module's entity (Rule 1 puts it here, not in `src/spaceship/`). It goes when that module goes — `src/spaceship/CLAUDE.md`'s `## Reuse` has the order |
| `databaseScope`, `DatabaseScopeConfig` | `src/database/config/database.scope.ts` | Connection config |
| `AppDataSource` | `src/database/data-source.ts` | TypeORM CLI entry point only — never import from application code |

## Configuration

`databaseScope` accepts either `DATABASE_URL` or the full set `DB_HOST`,
`DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`, plus `DB_SYNCHRONIZE` and
`DB_LOGGING`. The factory in `src/database/database.module.ts` prefers the URL
and throws at startup if neither form is complete.

`src/database/data-source.ts` is the one place outside
`src/config-provider/env-adapter/env-config.adapter.ts` that reads `process.env`
directly. That is deliberate and permitted: the TypeORM CLI runs outside the Nest
container, so no scope exists to inject. Keep the two in sync by hand when you
change a key.

## Rules

1. Entities live in `src/database/entities/`, one per file, extending
   `BaseEntity`. `autoLoadEntities` is on, so registering the entity with
   `TypeOrmModule.forFeature` in `src/database/database.module.ts` is what makes
   its repository injectable.
2. `BaseEntity` gives every row `id` (integer PK), `uuid`, `createdAt`,
   `updatedAt`, `deletedAt`. **`id` is internal — for joins and FKs only. Only
   `uuid` may appear in an API response or a route parameter.**
3. Deletes are soft. Use `softRemove` / `softDelete`; `deletedAt` is the marker
   and TypeORM filters it out of ordinary finds. Never `delete()`.
4. Schema changes are migrations, always generated, never hand-written
   (invariant `T8`):
   ```bash
   pnpm run db:migration:generate src/database/migrations/AddThing
   pnpm run db:migration:run
   ```
   No `--` before the path: pnpm 10 consumes it when a positional argument
   follows, and TypeORM then reports `Not enough non-option arguments`.

   Review the generated SQL before committing it. `migration:generate` diffs the
   entities against a **live** database, so point `DB_*`/`DATABASE_URL` at one
   first — `docker-compose.yml` has one. Generating against a database that is
   behind produces a migration that repeats work already in the directory.
5. `DB_SYNCHRONIZE` is for local development only. It defaults to `false` and
   must stay `false` in staging and production.
6. Index every foreign key and every column that appears in a `WHERE`. Declare
   it on the entity with `@Index()` so the generated migration carries it.
7. A write that spans more than one table runs in a transaction
   (`dataSource.transaction(...)` or a `QueryRunner`).
8. Select the columns you need. No `SELECT *` through `find()` on wide entities
   when a `select` clause will do.
9. Declare an explicit FK column next to a relation when the ID is read without
   loading the relation: the `@ManyToOne` property plus a `@Column()` holding
   the raw id, so a caller that only needs the id never pays for a join.
10. The directory starts at `1789989996617-InitialSchema.ts`, which creates the
    whole schema on an empty database. A new project keeps it and adds to it; it
    is what makes `db:migration:run` work from scratch, which the container
    entrypoint depends on. Check that it still runs on an empty database
    whenever you change `BaseEntity`.

## Tests

`src/database/database.module.unit.spec.ts` covers `buildTypeOrmOptions`: the
URL branch winning over the discrete one, the `5432` default, and the refusal
when the discrete set is incomplete. Service tests mock the repository with
`getRepositoryToken(Entity)` and a plain jest object. Do not spin up a real
database in a unit test; integration coverage belongs in `test/`.

## Reuse

`src/database/README.md`'s `## Reuse` is the human version of this section —
the peer-dependency list, what transfers unchanged and what to drop. Keep the
two congruent; they describe the same move.

`src/database/entities/base.entity.ts` and the migration scripts in
`package.json` transfer to any TypeORM project unchanged.

`src/database/database.module.ts` and `src/database/config/database.scope.ts`
carry this template's config-provider dependency — port them together with
`src/config-provider/`, or rewrite the factory against whatever config mechanism
the target project uses.

`User` owns `src/database/entities/auth-type.enum.ts` directly; dropping
`auth` just means dropping the `authType` column too.

## Known gaps

**The migration chain has to start from empty, every time.** The container
entrypoint runs `db:migration:run` against whatever the database currently is,
so a migration that assumes a table an earlier migration never created will
pass locally — where `DB_SYNCHRONIZE` built it — and crash on a fresh deploy.
After generating one, verify it from an **empty** database, not just against
yours. Rule 10 says the same thing about `BaseEntity`.

**This module owns entities belonging to other modules.** `User` is `auth`'s,
`Spaceship` is the reference domain module's, and both live here because
`autoLoadEntities` needs one registration point. Lifting `src/database/` alone
therefore carries domain shapes with it — delete the ones the destination has
no use for, along with their rows in `TypeOrmModule.forFeature`.

**This module ships no test doubles.** Repository tests use
`getRepositoryToken(Entity)` with a plain jest object, which is what `## Tests`
above describes; there is no packaged mock to import.
