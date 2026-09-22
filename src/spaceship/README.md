# Spaceship — the reference domain module

Every other directory under `src/` is infrastructure, written to be lifted into
another project. This one is the opposite: it is the worked example of a
**feature**, and it is written to be deleted.

Read it when you are about to write your first domain module in a project
started from this template. It shows, end to end, what the template expects a
feature to look like — and `## Deleting it`, below, is the checklist for
getting it out of your repo once you have.

## What it does

A CRUD API over a `Spaceship` resource, and one background job.

| Method | Route | Notes |
|---|---|---|
| `POST` | `/spaceships` | Creates the ship, captained by the authenticated user. Enqueues the notification and returns without waiting for it |
| `GET` | `/spaceships` | Cached list — see below |
| `GET` | `/spaceships/:uuid` | `404` when no row matches |
| `PATCH` | `/spaceships/:uuid` | Partial update |
| `DELETE` | `/spaceships/:uuid` | Soft delete; the row stays, `deletedAt` is set |

Every route is behind `AuthGuard('jwt')` and documented in Swagger. The public
identifier is always `uuid` — the integer primary key never leaves the process,
and a response names the captain by `captainUuid`, never by the `captainId`
foreign key.

## The three pieces worth reading

**Repository pattern.** `spaceship.repository.ts` is the only file that touches
TypeORM. It also translates database failures into HTTP ones: a unique-violation
on `captainId` becomes a `409`, and a missing row becomes a `404`, so no caller
ever handles a `null` or knows what a Postgres error code is. The error
descriptors live in `spaceship.exceptions.ts` — this module owns them, rather
than adding a domain entry to `src/common/`.

**Cache-aside on the list.** `GET /spaceships` reads Redis first and falls back
to the database on a miss *or on any cache failure*; writes invalidate the key.
Redis being down costs latency, never availability. The one subtlety is that a
cached row is JSON: dates come back as strings, so the service revives them,
and a cache hit returns exactly what a cache miss returns.

**Background email.** Creating a spaceship emails a list of employees, on a
queue, in the background. The request does not wait for it and does not fail if
the enqueue fails. Three seams are worth copying:

- the job carries only the data the email needs, not the entity;
- who gets notified sits behind `NotificationRecipientsProvider`, an abstract
  class with a config-backed implementation. Swapping it for one that reads a
  database table means writing a second implementation and changing one factory
  in `notification/notification.module.ts` — no business logic moves;
- the same is true of the email provider itself: the processor injects
  `EmailService`, so Resend, SendGrid, SES and the console adapter are one
  environment variable apart (`src/email/README.md`).

## Configuration

| Variable | What it does |
|---|---|
| `NOTIFICATION_EMPLOYEE_EMAILS` | Comma-separated recipients of the spaceship-created email. Blank means notify nobody — the job logs a warning and returns |
| `SPACESHIP_LIST_CACHE_TTL_SECONDS` | TTL of the cached list, in seconds. Defaults to 60 |

Both ship in the `REFERENCE DOMAIN MODULE` block at the end of `.env.example`.

## Running it

The module needs Postgres and Redis. Both are in `docker-compose.yml`:

```bash
docker compose up -d postgres redis
cp .env.example .env            # then fill in JWT_SECRET
pnpm run db:migration:run
pnpm run start:dev
```

With `EMAIL_ADAPTER` unset, the console adapter prints the email instead of
sending it, so the whole create-to-notification path works with no provider
account. Swagger is at `/api` in non-production.

## Reuse

**Do not lift this module into another project.** It is a sample, and every
other module's `## Reuse` section is about portability; this one is about
deletion. Copy the *shape* — the file layout, the layering, the error handling,
the way the queue and cache are reached through abstractions — and write your
own domain.

What it needs in order to work here, which is also the list of what your own
domain module will reach for: `src/database/` (the entity and the repository
token), `src/auth/` (the JWT guard and the `@CurrentUser` decorator),
`src/cache/`, `src/queues/`, `src/email/`, `src/templating/`, `src/templates/`,
`src/config-provider/` and `src/common/`. Nine of the template's twelve
directories — which is the point: a feature is where the infrastructure gets
used, not something that lifts on its own.

Peer dependencies beyond what the template already installs: none.

### Deleting it

1. Delete `src/spaceship/` and `src/templates/spaceship/`.
2. Delete `src/database/entities/spaceship.entity.ts` and its spec, remove
   `Spaceship` from `TypeOrmModule.forFeature` in
   `src/database/database.module.ts`, and remove the `ship` relation from
   `src/database/entities/user.entity.ts`.
3. Generate a migration that drops the table — the schema change is a migration
   like any other, never a hand-written file.
4. Remove the `SPACESHIP_CREATED` entries from
   `src/templates/template.const.ts` (all three maps) and from
   `src/templates/template-params.interface.ts`.
5. In `src/app.module.ts`, remove the `SpaceshipModule` entry and the
   `spaceshipCacheScope` / `notificationRecipientsScope` registrations. Leave
   the cache and queue modules — they are infrastructure and cost nothing
   until something uses them.
6. Delete the `REFERENCE DOMAIN MODULE` block at the end of `.env.example`.
7. Remove the `spaceship` row from the module map in the root `CLAUDE.md`, from
   the module catalogue in the root `README.md`, and from `TIERS` in
   `scripts/check-module-independence.mjs`.

Then `pnpm run docs:check && pnpm run modularity:check && pnpm test`. The
module's own agent guide, `src/spaceship/CLAUDE.md`, carries the same list.
