# Health — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded) and
> `docs/architecture/module-contract.md`. Read those first — this file adds
> only what is specific to `src/health/`.

## Scope

Owns the two endpoints an orchestrator polls: readiness (`GET /health`, every
dependency this instance needs to serve) and liveness (`GET /health/live`, the
process itself). Built on `@nestjs/terminus`.

Does not own: metrics, tracing (`src/common/observability/telemetry/`), or
alerting. A health endpoint answers one yes/no question per dependency; it is
not a dashboard.

Not an adapter module — it configures nothing and swaps no provider, so it has
no `abstract/`, no `<provider>-adapter/` and no `forRoot`. Import
`HealthModule` and the endpoints exist.

## Public surface

- `HealthModule` — `src/health/health.module.ts`. Plain `@Module`, no options.
- `HealthController` — `src/health/health.controller.ts`. `GET /health`,
  `GET /health/live`.
- `CacheHealthIndicator` — `src/health/cache.health-indicator.ts`. Exported as
  a provider of this module, not re-exported; nothing outside injects it.
- Timeouts and the probe key live in `src/health/health.const.ts`.

## Rules

1. **Liveness touches nothing.** `GET /health/live` must never query a
   dependency. It is what the container `HEALTHCHECK` and any restart policy
   read, and a process killed because Postgres blinked turns one outage into
   two. Readiness is where dependencies belong.
2. **Probe through the abstraction, never the driver** (`T1`).
   `CacheHealthIndicator` injects `CacheService`, so the check survives an
   adapter swap. A future Redis-specific probe importing `ioredis` here would
   be wrong; add a method to the cache contract instead.
3. **A dependency that is not registered is left out, not reported up.**
   `CacheHealthIndicator.isConfigured()` returns false when no `CacheService`
   resolved, and the controller omits the indicator entirely. Reporting an
   absent dependency as healthy is how a health check starts lying.
4. **Every probe is bounded in time.** An unreachable dependency usually hangs
   rather than refusing. The database indicator gets its bound from terminus,
   `pingCheck('database').withTimeout(ms)` — never the `{ timeout }` option,
   which 12.x deprecates. `CacheHealthIndicator` still races its own timer
   because it cannot use the builder (rule 5), and that timer must be cleared:
   the uncleared one would be finding `H7` all over again — it held the event
   loop open after a *successful* probe.
5. **The failure reason is the error's class name** (`T4`). An `ioredis`
   connection error reads `connect ECONNREFUSED 10.0.0.4:6379` and can carry
   the password. Neither the response body nor the log line may quote it.

   This is why `CacheHealthIndicator` does not use terminus 12's
   `healthIndicatorService.check('cache').attempt(fn).withTimeout(ms)`, which
   would otherwise replace the whole of `_probeWithTimeout`: on failure the
   builder calls `session.down({ message: errorMessage(err) })`, putting the
   provider's raw text in the response body. The hand-written version exists
   for that one reason. Do not "simplify" it back.

## Tests

`src/health/cache.health-indicator.unit.spec.ts` and
`src/health/health.controller.unit.spec.ts`. Between them they cover: up, down,
timeout, timer cleanup, the `T4` redaction in both the body and the log line,
and the three readiness shapes (cache present, cache absent, liveness touching
nothing). The controller spec runs the indicator functions the controller
handed to terminus, so it asserts which dependencies were probed rather than
asserting against terminus's internals.

## Reuse

Copy `src/health/` whole. It needs the peer package `@nestjs/terminus`, plus
`@nestjs/typeorm` and `typeorm` for the database indicator that terminus
resolves through `ModuleRef`.

**`@nestjs/terminus` is on 12.x, and the destination has to be able to load
ESM.** 12.x is `"type": "module"` with no CommonJS build, the same as every
Nest 12 package. This template still emits CommonJS and reaches it through
Node's `require(esm)`; what that costs is one line in the destination's test
setup, because Jest cannot load an ESM dependency from a CommonJS test unless
it is started as `node --experimental-vm-modules ./node_modules/jest/bin/jest.js`.
Copy this repo's `test` scripts along with the module, or every spec that
imports it fails with `SyntaxError: Unexpected token 'export'`. A destination
on Vitest needs nothing.

Two edges leave this module, both `@Optional()`, so it boots without either —
but both imports still have to resolve:

- `src/cache/abstract/cache.service.ts` for the cache probe. Drop
  `cache.health-indicator.ts` and its spec if the destination has no cache, and
  the controller's `indicators` array loses its conditional branch.
- `src/common/observability/logger/` for the failure log line.

The database indicator assumes TypeORM. A destination on Prisma or Mongoose
swaps `TypeOrmHealthIndicator` for terminus's equivalent — one line in
`health.controller.ts`.

`src/health/README.md`'s `## Reuse` is the human version of this section. Keep
the two congruent (`T7`).

## Known gaps

- **A failing readiness check returns 503 with no indication of which
  dependency is down.** `@HealthCheck()` throws `ServiceUnavailableException`
  carrying terminus's `{ status, info, error, details }` payload, and
  `src/common/middleware/request-exception.filter.ts` deliberately rebuilds
  every error body field by field rather than spreading the exception's own
  payload — that is finding `C4`, and it is correct behaviour for every other
  route. The status code is right, which is all a load balancer reads, but a
  human gets nothing. `CacheHealthIndicator` compensates by logging its own
  failure; `TypeOrmHealthIndicator` is terminus's and does not. Closing this
  properly means letting the filter pass a payload through for one route, which
  is a change to a security-motivated global — scope it deliberately.
- **No `startPeriod` equivalent inside the app.** Readiness reports down while
  migrations run at boot (`docker-script.sh` runs them before the server
  listens, so the endpoint is simply not answering yet). The 60s `startPeriod`
  in `task-definition-template.json` and the Dockerfile `HEALTHCHECK` covers
  this; a load-balancer target group needs its own grace period set in the
  infrastructure, which this repo does not own.
- **The ALB target-group health check is not configured here.**
  `task-definition-template.json` sets the *container* health check only. The
  target group that decides whether to route traffic lives in the
  infrastructure repo and should point at `/health`.
