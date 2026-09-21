# Health

Two endpoints for whoever is watching the process: a load balancer, ECS, a
Kubernetes probe, an uptime checker.

| Endpoint | Question it answers | Touches dependencies | Who polls it |
|---|---|---|---|
| `GET /health` | Can this instance serve traffic right now? | Yes — Postgres, and the cache when registered | Load balancer target group |
| `GET /health/live` | Is the process alive? | **No** | Container runtime, restart policy |

The split matters. Liveness decides whether to **restart** the container; if it
checked Postgres, a database blip would restart every instance at once and turn
one outage into two. Readiness decides whether to **route traffic**, which is
where dependency checks belong.

## Registering it

Already wired in `src/app.module.ts`:

```ts
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // ...
    HealthModule,
  ],
})
export class AppModule {}
```

No options, no `forRoot`. The module configures nothing.

## What a response looks like

`GET /health` when everything is up — note the `{ success, data }` envelope the
global `ResponseInterceptor` adds to every route:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "info": {
      "database": { "status": "up" },
      "cache": { "status": "up", "responseTime": 3 }
    },
    "error": {},
    "details": {
      "database": { "status": "up" },
      "cache": { "status": "up", "responseTime": 3 }
    }
  }
}
```

When something is down the endpoint answers **503**. Be aware that the body
then says only that the request failed, not which dependency — the global
exception filter rebuilds error bodies field by field on purpose (finding
`C4`). The status code is what a load balancer reads, so failover works
correctly; for the *reason*, read the logs. `CacheHealthIndicator` logs its
own failure with the error's class name. This is written up in
`src/health/CLAUDE.md`'s `## Known gaps`.

`GET /health/live` is always cheap:

```json
{ "success": true, "data": { "status": "ok" } }
```

## Verified against real infrastructure

Unlike the extraction figures in the root `README.md`, which measure
`tsc --noEmit` and say so, this module was exercised by booting the app on
2026-09-21 against the `postgres` and `redis` containers from
`docker-compose.yml`, with the initial migration run on an empty database. The
run below was repeated on the same day against `@nestjs/terminus` 12.1.0 after
the Nest 12 upgrade, with the same outcome in every row:

| Scenario | `GET /health/live` | `GET /health` |
|---|---|---|
| Both dependencies up | 200 | 200, `database` and `cache` both `up` |
| Redis stopped | **200** | **503** |
| Redis restored | 200 | 200 |
| Postgres stopped | **200** | **503** |
| Postgres restored | 200 | 200 |

The two bold rows are the point of the split: with a dependency down the
container is *not* restarted, and the load balancer *does* stop routing to it.

Two things that only showed up by running it:

- **Redis down hangs, it does not refuse.** The probe returned after 1003ms —
  the timeout, not the driver. Without `CACHE_PING_TIMEOUT_MS` the readiness
  endpoint would have held the connection open until its caller gave up, which
  reports nothing at all rather than reporting down.
- **The failure log stays clean.** The line read
  `{"indicator":"cache","kind":"Error","responseTime":1003}` — no host, no
  port, no credentials (`T4`).

And it confirmed the first entry in `src/health/CLAUDE.md`'s `## Known gaps`:
the 503 body was `{"success":false,"statusCode":503,"message":"Service
Unavailable Exception"}`, with no indication of which dependency failed.

One thing the terminus 12 re-run changed, in the healthy body rather than the
failing one: every indicator now reports its own `responseTime`, so `GET
/health` answers
`{"database":{"responseTime":16,"status":"up"},"cache":{"responseTime":3,"status":"up"}}`
where 11.x sent `{"database":{"status":"up"}}`. Nothing reads that field here,
but a dashboard or alert parsing the body elsewhere will see the new key.

## Tuning the probes

`src/health/health.const.ts`:

- `DATABASE_PING_TIMEOUT_MS` — 1500
- `CACHE_PING_TIMEOUT_MS` — 1000
- `CACHE_PROBE_KEY` — `health:probe`, read and never written, so the probe
  cannot evict a real entry or grow the keyspace

Both timeouts sit under the 5s a typical ECS or ALB check allows, so the
endpoint answers before its caller gives up. Raise them and you risk a probe
that outlives the checker and reports nothing at all.

## Adding a dependency to the check

Say the app gains an outbound API it cannot serve without. Terminus ships an
HTTP indicator; add it to the readiness array in
`src/health/health.controller.ts`:

```ts
const indicators: HealthIndicatorFunction[] = [
  () => this.database.pingCheck('database').withTimeout(DATABASE_PING_TIMEOUT_MS),
  () => this.http.pingCheck('billing', 'https://api.example.com/ping'),
];
```

`withTimeout` is terminus 12's spelling; the old `{ timeout }` option still
works but is deprecated, and unlike the option the builder hands the probe an
`AbortSignal`, so a hung connection is cancelled rather than abandoned.

For something with no terminus indicator you have two shapes to choose from,
and the choice is about what reaches the caller:

- `healthIndicatorService.check('x').attempt(fn).withTimeout(ms)` is terminus's
  own, and the shortest. It reports a failure as
  `down({ message: <the thrown error's message> })` — fine for an internal
  dependency whose errors say nothing sensitive.
- `src/health/cache.health-indicator.ts`'s shape — inject the **abstract**
  service (`T1`), race the probe against a timeout, clear the timer, report the
  error's *class name* (`T4`) — when the provider's message can carry a host,
  a port or a credential, as `ioredis`'s does. That is the whole reason the
  cache indicator is written out by hand instead of using `attempt`.

Two things not to do: do not add the dependency to `liveness()`, and do not
report a dependency that is not registered as `up` — leave it out, the way
`isConfigured()` does for the cache.

## Infrastructure

The container health check is already in the repo:

- `Dockerfile` — a `HEALTHCHECK` hitting `/health/live` with node's global
  `fetch`, so the probe adds no package to the image.
- `task-definition-template.json` — the same probe as the ECS container
  `healthCheck`, with a 60s `startPeriod` to cover boot and migrations.

**The ALB target group is not configured here.** It lives in the
infrastructure repo and should point at `/health` (readiness), not
`/health/live`. Pointing it at liveness means an instance with a dead database
keeps receiving traffic.

## Reuse

Copy `src/health/` whole.

**Peer packages:** `@nestjs/terminus`, plus `@nestjs/typeorm` and `typeorm`
for the database indicator.

**Terminus is on 12.x, and it is ESM-only** (`"type": "module"`, no CommonJS
build) — as is every Nest 12 package. This template still *emits* CommonJS and
loads it through Node's `require(esm)`, which works from Node 22.12 on, so the
application boots normally. The one thing that does not come for free is Jest:
a CommonJS test cannot load an ESM dependency unless Jest is started as
`node --experimental-vm-modules ./node_modules/jest/bin/jest.js`. Copy this
repo's `test`/`test:cov` scripts along with the module, or every spec touching
it dies with `SyntaxError: Unexpected token 'export'`. A destination on Vitest,
or one that is ESM throughout, needs no such flag.

**Companion directories,** both reached through `@Optional()` injection, so the
module boots without either — though the imports must still resolve:

- `src/cache/abstract/cache.service.ts` — for the cache probe. No cache in the
  destination? Delete `cache.health-indicator.ts` and its spec, and drop the
  `isConfigured()` branch from the controller. Nothing else changes.
- `src/common/observability/logger/` — for the failure log line. Replace the
  two constructor lines to drop it.

**What to drop:** the database indicator if the destination is not on TypeORM.
Terminus ships equivalents for Prisma, Mongoose, Sequelize and MikroORM; it is
one line in `health.controller.ts`.

**What removing it from the template costs:** the deploy loses its container
health check, so ECS can no longer tell a wedged process from a healthy one and
will not replace it. Nothing else imports this module, so removal is three
edits: delete the directory, drop `HealthModule` from `src/app.module.ts`, and
remove the `HEALTHCHECK` from `Dockerfile` and the `healthCheck` block from
`task-definition-template.json`.
