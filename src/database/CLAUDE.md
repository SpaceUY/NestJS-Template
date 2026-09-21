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
   pnpm run db:migration:generate -- src/database/migrations/AddThing
   pnpm run db:migration:run
   ```
   Review the generated SQL before committing it.
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

## Tests

`src/database/database.module.unit.spec.ts` covers `buildTypeOrmOptions`: the
URL branch winning over the discrete one, the `5432` default, and the refusal
when the discrete set is incomplete. Service tests mock the repository with
`getRepositoryToken(Entity)` and a plain jest object. Do not spin up a real
database in a unit test; integration coverage belongs in `test/`.

## Reuse

**No `README.md` is planned for this module.** A README answers "should I
adopt this?" — a shopping question. Nobody shops for a database module: any
NestJS + TypeORM project needs one regardless, so there is no adoption
decision for a human guide to make room for. What follows below is a
different question — "how do I port this one's shape?" — asked by someone who
has already committed to taking `src/database/` (or pieces of it) into
another project. That reader is exactly who this `## Reuse` section, like the
rest of this agent guide, already serves.

`src/database/entities/base.entity.ts` and the migration scripts in
`package.json` transfer to any TypeORM project unchanged.

`src/database/database.module.ts` and `src/database/config/database.scope.ts`
carry this template's config-provider dependency — port them together with
`src/config-provider/`, or rewrite the factory against whatever config mechanism
the target project uses.

`User` owns `src/database/entities/auth-type.enum.ts` directly; dropping
`auth` just means dropping the `authType` column too.

## Known gaps

See `docs/audit/2026-09-11-template-audit.md`.

- **`R4`** — `src/database/migrations/` holds only `.gitkeep`; the template ships
  no baseline migration.
- **`G1`** — ~~the connection factory's URL/host branching is untested.~~
  **Fixed on `test/coverage-cache-common`:** the factory is the exported
  `buildTypeOrmOptions` (it was an inline arrow inside the `@Module` decorator,
  unreachable from a test) and every branch has a case.
- **`C1`** — ~~no `DB_*` key appears in `.env.example`.~~ **Fixed on
  `fix/security-defaults`:** the full `DB_*` set is declared alongside
  `DATABASE_URL`.
