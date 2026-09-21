# Database Module

Owns the TypeORM connection, the entity definitions, the base entity every
entity extends, and the migration directory. It is `@Global()`, so
`TypeOrmModule` is available everywhere without re-importing it.

It does not own repositories or queries — those live in the service of the
module that owns the data.

## Directory Structure

```text
src/database/
├── config/
│   └── database.scope.ts        DATABASE_URL or the discrete DB_* set
├── entities/
│   ├── base.entity.ts           id / uuid / createdAt / updatedAt / deletedAt
│   ├── user.entity.ts           the one entity the template ships
│   └── auth-type.enum.ts        EMAIL / GOOGLE / AUTH0, stored on User.authType
├── migrations/
│   └── 1789989996617-InitialSchema.ts
├── database.module.ts           the @Global() module + buildTypeOrmOptions
└── data-source.ts               TypeORM CLI entry point — never imported by app code
```

## Registration

`src/app.module.ts` imports `DatabaseModule` once. There is no `forRoot` here:
the module reads `databaseScope` itself and builds the connection options with
the exported `buildTypeOrmOptions`.

```ts
@Module({
  imports: [DatabaseModule],
})
export class AppModule {}
```

## Config

`databaseScope` accepts either a URL or the discrete set, and prefers the URL
when both are present:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Full connection string. If set, the `DB_*` host keys are ignored |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` | The discrete alternative; `DB_PORT` defaults to `5432` |
| `DB_SYNCHRONIZE` | Local development only. Defaults to `false` and must stay `false` outside it |
| `DB_LOGGING` | Query logging |

`buildTypeOrmOptions` throws at startup when neither form is complete, rather
than letting the app boot and fail on the first query.

## Entities

Every entity extends `BaseEntity`, which gives it five columns:

- `id` — integer primary key. **Internal only**, for joins and foreign keys.
- `uuid` — the public identifier. The only one an API response or a route
  parameter may expose.
- `createdAt`, `updatedAt`, `deletedAt` — timestamps. `deletedAt` is what makes
  deletes soft: use `softRemove` / `softDelete`, never `delete()`.

`autoLoadEntities` is on, so an entity becomes injectable by registering it
with `TypeOrmModule.forFeature` in `src/database/database.module.ts`.

## Migrations

Migrations are always generated from the entities, never hand-written:

```bash
pnpm run db:migration:generate -- src/database/migrations/AddThing
pnpm run db:migration:run
pnpm run db:migration:revert
```

`migration:generate` diffs the entities against a **live** database, so point
`DATABASE_URL` (or the `DB_*` set) at one first — `docker-compose.yml` has one.
Generating against a database that is behind produces a migration that repeats
work already in the directory.

The directory starts at `1789989996617-InitialSchema.ts`, which creates the
whole schema on an empty database. Keep it: it is what makes
`db:migration:run` work from scratch, and `docker-script.sh` runs exactly that
on every deploy.

## Reuse

**Two supported workflows.** Clone the template whole, or lift only the modules
you need — this one is written for both. What follows is the second case: what
`src/database/` needs in order to compile in another project.

**What travels with it.** `src/config-provider/abstract/` —
`config/database.scope.ts` builds its scope with `configSources` and
`defineConfigScope` from there, and that is this module's only edge to another
module of the template. Take it along, or rewrite `database.scope.ts` and
`buildTypeOrmOptions` against whatever config mechanism the target project
already uses; nothing else in the module would change.

**What transfers unchanged.** `entities/base.entity.ts` and the three
`db:migration:*` scripts in `package.json` work in any TypeORM project as-is,
with no config-provider dependency at all.

**Peer dependencies.**

```bash
pnpm add @nestjs/typeorm typeorm pg
pnpm add joi                          # config/database.scope.ts
```

**What to drop.** `entities/user.entity.ts` and `entities/auth-type.enum.ts`
exist for `src/auth/`. Dropping `auth` means dropping both and regenerating the
baseline migration against an empty database.

**Removing it from the template instead.** Only `src/auth/` imports it, for
`User` and `AuthType`. It goes once `auth` has.
