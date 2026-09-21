# SpaceDev NestJS Template

SpaceDev's reusable NestJS backend template. It exists to serve two
workflows: [lift one module into an existing project](#use-a-module-in-another-project),
or [clone the whole thing and delete what you don't need](#clone-the-template-and-strip-what-you-dont-need).
See below for what that means and how to work with it, or jump to
[what is in here](#what-is-in-here) for the module catalogue. If you are
handing the first workflow to an agent rather than doing it yourself, read
[Handing this to Claude](#handing-this-to-claude).

## SpaceDev template documentation

This is the SpaceDev reusable NestJS template. Each top-level directory under
`src/` is a module designed to be lifted into another project on its own.

- `CLAUDE.md` — project invariants, commands and the module map. Start here.
- `docs/architecture/module-contract.md` — the contract every adapter module implements.
- `docs/audit/2026-09-11-template-audit.md` — known defects, cited by ID from each module guide.
- `docs/audit/2026-09-18-modularity-audit.md` — the modularity/extraction/documentation findings, and its reconciliation of the older audit.
- `src/<module>/CLAUDE.md` — rules, public surface and extraction recipe for that module.
- `src/<module>/README.md` — human-facing recipes and examples for that module.

Run `pnpm run docs:check` after editing any `CLAUDE.md`.

## What is in here

Fifteen modules. "Companions" are the other `src/` directories that module's
imports reach into — the narrowest subtree that has to travel with it, taken
from `pnpm run modularity:check -- --report`, which is the source of truth when
this table drifts. Each module's own `README.md` has the recipes and its
`## Reuse` section the full peer-dependency list.

| Module | Owns | Adapters | Companions in `src/` |
|---|---|---|---|
| [`analytics`](src/analytics/README.md) | Product event capture and feature-flag checks | `console`, `posthog` | logger, `config-provider` |
| [`auth`](src/auth/README.md) | JWT issuance and verification, Passport strategies, Google OAuth, Auth0 | — (providers: `google`, `auth0`) | logger, `common/exception/`, `config-provider`, `database` |
| [`cache`](src/cache/README.md) | Key/value cache with TTL, plus an extension mechanism for provider-specific ops | `redis` | **none** |
| [`cloud-storage`](src/cloud-storage/README.md) | File upload, retrieval and deletion, with an optional mountable controller | `local`, `s3` | logger, `config-provider` |
| [`common`](src/common/README.md) | HTTP exception vocabulary, global response interceptor and exception filter, shared decorators, module-validation helper | — | none inside `src/` — but see the `@types/` caveat |
| [`common/observability/logger`](src/common/observability/logger/README.md) | The logging abstraction and trace-id correlation | `nest`, `pino`, `winston` | none |
| [`common/observability/telemetry`](src/common/observability/telemetry/README.md) | OpenTelemetry bootstrap and the `@Span()` decorator | — | none |
| [`config-provider`](src/config-provider/README.md) | Config resolution for the whole app: source adapters, the dynamic module, `defineConfigScope` | `env`, `secrets-manager` | logger |
| [`database`](src/database/README.md) | TypeORM connection, entities, base entity, migrations | — | `config-provider` |
| [`email`](src/email/README.md) | Email delivery of **pre-rendered** content | `aws-ses`, `sendgrid`, `resend`, `console` | logger, `config-provider` |
| [`health`](src/health/README.md) | Readiness (`GET /health`) and liveness (`GET /health/live`) for load balancers and container runtimes | — | logger, `cache` — both optional |
| [`push-notification`](src/push-notification/README.md) | Push delivery | `expo` | logger, `config-provider` |
| [`queues`](src/queues/README.md) | Producer and consumer abstractions for message queues | `bullmq`, `rabbitmq`, `sqs` | logger, `config-provider` |
| [`templates`](src/templates/README.md) | The template files and the typed registry naming them — no executable code | — | none |
| [`templating`](src/templating/README.md) | Compiling a template to HTML | `pug` | `common/utils/` |

"logger" above means `src/common/observability/logger/` specifically, not all
of `src/common/`. Nine modules have an edge into `common`; seven of them reach
only into that subtree, `auth` also uses `common/exception/`, and `templating`
uses only `common/utils/` — one import, `nest-module-validation`. Four things
the table cannot show:

- **Config scopes live with their consumer, not with `config-provider`.** So a
  module that lists `config-provider` as a companion needs `joi` too, and the
  scope file comes with the module.
- **`cache` needs zero companions but does not bring its own config.**
  `src/app.module.ts` feeds it from `src/redis.scope.ts`, an application-level
  scope shared with `src/queues/bullmq-adapter/`. Bring that file or hand the
  adapter a plain object — see `src/cache/CLAUDE.md`'s `## Reuse`.
- **`health`'s two companions are both `@Optional()`.** It boots with neither
  `CacheService` nor `LoggerService` registered — the cache simply drops out of
  the readiness check instead of being reported healthy. The imports still have
  to resolve, which is why they are listed.
- **`common` has a companion that is not a directory under `src/`.** Its
  middleware only type-checks because of the ambient `Express.User`
  augmentation in the repo-root `@types/` directory, which no import statement
  names. Step 3 of the recipe below covers it; `EXT7` is the finding.

Only `cache`, `email` and `queues` have been measured by actually copying them
into a clean project; the numbers and the caveats are below.

## Use a module in another project

The general recipe:

1. Copy `src/<module>/` into the destination project.
2. Copy each companion directory that module depends on (see below) into the
   destination's `src/`.
3. If `common` is one of those companions, also copy the repo-root `@types/`
   directory, and put it somewhere the destination's `tsconfig.json` actually
   compiles — this repo declares no `include`, so a `.d.ts` at the project root
   is part of the program; a destination with `"include": ["src"]` needs the
   file under `src/` instead. `common` depends on the ambient `Express.User`
   type declared there — see `src/common/CLAUDE.md`'s `## Reuse` section for
   the details, since this is the dependency with no import statement, so no
   amount of reading the source will surface it. (The
   `src/common/observability/logger/` subtree on its own does not need it: the
   queues measurement below compiled clean without it.)
4. Install the module's npm packages (below).
5. Register the module in the destination's `src/app.module.ts`, the way this
   template's own `src/app.module.ts` does.

**Prerequisite — the destination's module system.** `nest new` asks which
module system you want and **defaults to ESM**: `"type": "module"` in
`package.json`, `nodenext` resolution, and Vitest. Under `"type": "module"`
every relative import needs an explicit `.js` extension, and no file in this
template writes one, so **no module from this template compiles into a default
scaffold** until either the destination drops `"type": "module"` or every
relative import in the copied code gains a `.js` extension.

The other answer to that prompt is the one that fits. `nest new --type cjs`
produces `"module"`/`"moduleResolution": "nodenext"` with no `"type"` field
and Jest — which is exactly this repo's `tsconfig.json` since the 2026-09-21
Nest 12 upgrade. Into that scaffold a module copies across unchanged.
Extensionless relative imports stay legal because the package is CommonJS;
`nodenext` is only how TypeScript reads the `exports` map that every Nest 12
package now ships. Evidence for the older, wider gap:
`docs/audit/evidence/extract-queues-2026-09-19.txt`, measured 2026-09-19
against `@nestjs/cli` 12.0.3 and TypeScript 6.0.3, before this template moved
to `nodenext`.

One thing does not travel with the source, whichever answer you give: **a
CommonJS destination on Jest must start Jest with
`node --experimental-vm-modules ./node_modules/jest/bin/jest.js`**, or any
spec that reaches an ESM package — `@nestjs/terminus`, or `@nestjs/common`
itself — dies with `SyntaxError: Unexpected token 'export'`. Copy this repo's
`test` scripts along with the code. On Vitest the question does not arise.

What that costs, measured by copying each module alone into a fresh `nest new`
project and running `tsc --noEmit`. The 2026-09-19 `queues` run is not
reproducible from a bare `nest new` any more: the scaffold was first aligned to
this template's CommonJS settings, for the reason given in the prerequisite
above, before any template code was copied in.

- **`cache`** lifts with **zero** companion directories — `tsc --noEmit` exits
  0 (`EXT1`). Needs the npm package `ioredis`. Measured 2026-09-18
  (`docs/audit/2026-09-18-modularity-audit.md`, `### Extraction`).
- **`email`** lifts with **two** companions, `common` and `config-provider`
  (`EXT5`). Needs `resend`, `@sendgrid/mail`, `@aws-sdk/client-ses`, `joi`.
  Measured 2026-09-18, same source.
- **`queues`** lifts with **two** companions,
  `src/common/observability/logger/` and `src/config-provider/`. Copying
  `src/queues/` alone leaves **19** unresolved imports; with both companions
  `tsc --noEmit` exits 0. `src/queues/` itself needs `bullmq`, `amqplib`
  (plus `@types/amqplib`), `@aws-sdk/client-sqs` and `joi`, plus
  `@types/jest` if you copy its `tests/` folders — 11 of those 19 errors are
  in spec files, 8 are not; the companions
  bring their own — `class-transformer`, `pino`, `winston`,
  `@opentelemetry/api` and `@opentelemetry/sdk-trace-node` for the logger,
  `@aws-sdk/client-secrets-manager` and `dotenv` for `config-provider`.
  Measured 2026-09-19: `docs/audit/evidence/extract-queues-2026-09-19.txt`
  and `extract-queues-closure-2026-09-19.txt`.

The `cache` and `email` figures were measured on 2026-09-18 and have not been
re-verified since; in particular they predate the scaffold change described
above, which was only discovered during the 2026-09-19 `queues` measurement.

`queues` is the one that changed. On 2026-09-18 it **did not lift** at all:
copying it alone left 29 unresolved imports, and the only closure that
compiled pulled in 11 of the template's 13 top-level `src/` directories
(`EXT3`, `EXT4`). Removing the demo domain module and moving consumer
registration to `QueueConsumerModule.forFeature` brought that down to the two
companions above.

**This measures compile time, not boot time.** Every result above means
`tsc --noEmit` exits 0 — it does not mean the lifted module works once
running. Whether, say, `cache`'s `forRootAsync` resolves when the host project
registers no matching config scope is untested; the audit does not answer it,
and neither does this README.

### Handing this to Claude

The recipe above assumes you are reading it. The other way to run it is to
point an agent at this repository from the destination project — "use the
`email` module from NestJS-Template here". For that to work the agent needs
both repositories on disk; it cannot read a module it cannot open.

Give it the path and the module, and say to follow this section:

> Both repos are local: the template is at `<path>`, we are in the
> destination. Lift `<module>` from the template into this project following
> the "Handing this to Claude" section of the template's `README.md`.

What the agent should then do, in this order:

1. **Read three files before copying anything** — the template's root
   `CLAUDE.md` (invariants `T1`-`T8`, which the copied code assumes),
   `src/<module>/CLAUDE.md`'s `## Scope` and `## Reuse`, and
   `docs/architecture/module-contract.md` if the module will gain an adapter
   here. `## Reuse` is the authoritative list of what travels with it; the
   catalogue table above is the summary, that section is the detail.
2. **Settle the module system first**, before deciding anything else. Check
   the destination's `package.json` for `"type": "module"` and its
   `tsconfig.json` for `"moduleResolution"`. If the destination is ESM, this
   is a real fork in the road and the wrong moment to guess — the prerequisite
   above explains why, and the two ways out are to drop `"type": "module"` or
   to add a `.js` extension to every relative import in the copied code. Say
   which one you are taking and why, rather than discovering it as a wall of
   `TS2307`s later. Then check how the destination runs Jest: a CommonJS
   project whose `test` script is a bare `jest` will fail on the first ESM
   import, and the fix is the `--experimental-vm-modules` invocation in this
   repo's `package.json`.
3. **Copy the module, then its companions**, from the `## Reuse` list — not
   from the import errors, which under-report: the `@types/express` ambient
   augmentation that `src/common/middleware/response.interceptor.ts` needs has
   no import statement, so no compiler error names it.
4. **Install the peer packages** named in `## Reuse`, with the destination's
   package manager, not necessarily `pnpm`.
5. **Register it** the way `src/app.module.ts` here does — the abstract
   module's `forRoot`/`forRootAsync`, never the adapter class directly (`T1`).
   If the destination has no config-provider, this is the step that needs a
   decision: port `src/config-provider/` too, or write a factory against
   whatever the destination already uses. Do not invent a third mechanism.
6. **Verify with the destination's own gates**, and say which ones ran.
   `tsc --noEmit` is the floor, and it is exactly what the measurements above
   mean — nothing here has been proven to *boot* in another project. If the
   destination has tests, run them. Do not report the lift as working on the
   strength of a clean compile alone; say "compiles, not booted".

Two failure modes worth naming, because both look like success:

- **Copying an adapter without its abstraction.** `S3AdapterService` imported
  directly into a destination service compiles and runs, and throws away the
  entire point of the module (`T1`). The destination should inject
  `CloudStorageService`.
- **Rewriting relative imports to absolute ones.** `src/...` specifiers break
  the next copy out (`T5`) and `pnpm run modularity:check` fails on them here.
  Keep them relative in the destination too.

## Clone the template and strip what you don't need

The other supported workflow: clone the repository and delete what you don't
need, keeping the rest wired together.

There is no demo domain module to delete. What comes out cleanly is a module no
other module imports: the seven adapter modules `analytics`, `cache`,
`cloud-storage`, `email`, `push-notification`, `queues` and `templating`, and
also `auth`, which is not an adapter module but has no inbound edges either
(removing it leaves `database` with no importers left). Each of those is
removed with the same three edits:

1. Remove its registration from `src/app.module.ts`.
2. Remove its config scope from that file's `scopes` array. `templating`
   registers none; `cache` and `queues` share `src/redis.scope.ts`, so that one
   goes only when both have.
3. Remove its variables from `.env.example`.

The rest of the tree is not free-standing. `pnpm run modularity:check --
--report` prints the edges that say so, and today they are:

- `common` is imported by `analytics`, `auth`, `cloud-storage`,
  `config-provider`, `email`, `queues` and `templating`.
- `config-provider` is imported by `analytics`, `auth`, `cloud-storage`,
  `database`, `email`, `push-notification` and `queues` — and imports `common`
  itself.
- `database` is imported by `auth` (23 specifiers).

So `common`, `config-provider` and `database` do not come out on their own:
deleting any of them while something above still imports it leaves the tree
non-compiling. They go last, once everything that imports them has gone.

One directory fits neither list, having no registration and no config scope in
`src/app.module.ts`:

- `src/templates/` holds two generic templates, `WELCOME` and `VERIFICATION`,
  registered in `src/templates/template.const.ts`. Both are starting points, not
  demo content — there is nothing here to strip. **Nothing imports it.** The
  demo route that did, `GET /email`, was removed: unguarded, it sent a real
  message to a hardcoded address from whatever provider the environment had
  configured. The render-then-send pattern it showed is written up in
  `src/email/README.md`. So this directory is free-standing today — take it or
  delete it without touching anything else.

Run `pnpm run modularity:check -- --report` for the current dependency graph
before deleting anything, rather than trusting a copy of it that will drift.

## Installation

```bash
$ pnpm install                 # pnpm 10.15.1, Node 24.15.0 — never npm or yarn
$ cp .env.example .env         # then fill the required keys, see below
```

NestJS 12, TypeScript 6, Jest 30, Node 24. Two consequences worth knowing
before the first `pnpm test`: every Nest 12 package is ESM-only, so
`tsconfig.json` uses `"module": "nodenext"` while still emitting CommonJS (the
`nest new --type cjs` layout), and the `test` scripts start Jest through
`node --experimental-vm-modules` because a CommonJS test cannot otherwise load
an ESM dependency. Run `pnpm test`, never a bare `jest`. `CLAUDE.md`'s
`## Toolchain` has the rest.

`.env.example` lists every key the code actually reads, grouped by the module
that reads it, and marks which ones are required. Copied as it ships, it boots
against the containers below with exactly one thing to fill in: `JWT_SECRET`,
left blank on purpose so the app refuses to start rather than sign tokens with
a shared constant. The database address has no default either — `DATABASE_URL`
or the full `DB_*` set — but the value in the file is the one
`docker-compose.yml` creates. Everything else has a working local default, and
the provider-backed modules all ship a no-network adapter for development:
`EMAIL_ADAPTER=CONSOLE` and `ANALYTICS_ADAPTER=CONSOLE`, with both OAuth
providers off.

One rule that file states and that is easy to get wrong: a blank value is a
value, not an omission. `KEY=` hands the config scope an empty string, and Joi
rejects an empty string for every key but eight. To leave something unset,
comment the line out — which is why the optional blocks in that file ship
commented rather than empty.

## Local development

This project needs PostgreSQL and Redis running locally. Start both with:

```bash
docker-compose up -d          # postgres, redis and jaeger
pnpm run db:migration:run     # creates the schema on a fresh database
```

Redis backs the BullMQ background job queues: `src/app.module.ts` wires both
the producer and the consumer adapter against it, even though the template
ships no queue handlers of its own. See `REDIS_HOST` / `REDIS_PORT` /
`REDIS_PASSWORD` in `.env.example`. The app depends on Redis at runtime, not
just in tests.

Once it is up, `GET /health` tells you whether it found both:

```bash
$ curl -s localhost:5000/health | jq .data.info
{ "database": { "status": "up" }, "cache": { "status": "up" } }
```

A `503` there means a dependency is missing, not that the app is broken — see
`src/health/README.md`.

Swagger is at `/api`, and it is **gated**: `SWAGGER_ENABLED` defaults to false
when `NODE_ENV=PROD` and true everywhere else, so the full API surface is not
published in production by default. Set it explicitly to serve docs from a
prod-like environment — that is why it is a flag rather than a bare `NODE_ENV`
check, since the alternative is lying about `NODE_ENV`, which would also
re-enable the `CORS_ORIGINS` wildcard.

## Running the app

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Test

```bash
# unit tests
$ pnpm run test

# unit tests + the coverage floor — what CI runs
$ pnpm run test:cov
```

**`pnpm run test:e2e` exists but proves nothing.** `test/app.e2e-spec.ts` is
24 lines of unmodified Nest scaffold: it boots the whole `AppModule` and
expects `'Hello World!'` on `GET /`, so it needs a live database and Redis and
runs nowhere — not locally by default, and not in CI. This is **accepted debt**
(`H4`), recorded deliberately rather than papered over: a green boilerplate
e2e run would be worse than none. Closing it means either writing real e2e
specs with `postgres` and `redis` services in `bitbucket-pipelines.yml`, or
deleting the file, `test/jest-e2e.json` and the script. Do not half-fix it.

## Gates CI runs on every PR

These are the five commands `bitbucket-pipelines.yml`'s `test-build` step runs,
in this order. They also run on `staging` and `master` before the deploy step,
so a merge is proved as merged, not just as a pull-request source.

```bash
$ pnpm run docs:check          # every CLAUDE.md: map entry, sections, README sibling
$ pnpm run modularity:check    # module import graph vs. the recorded baseline
$ pnpm run lint:ci             # eslint WITHOUT --fix, so formatting drift fails
$ pnpm run test:cov            # jest + the coverage floor
$ pnpm run build               # nest build
```

Two of those differ from what you would reach for locally, and both
differences are the point:

- **`lint:ci`, never `lint`.** `lint` carries `--fix`, so running it in a
  pipeline repairs formatting drift instead of failing on it — that was
  finding `L3`. Use `pnpm run lint` while you work, `pnpm run lint:ci` to
  predict CI.
- **`test:cov`, never `test`.** The `coverageThreshold` in `package.json` is a
  floor, and Jest only enforces it when coverage is actually collected. Under
  plain `pnpm test` the threshold is inert. The floor today is 95% statements,
  88% branches, 94% functions, 95% lines, measured just under the real numbers
  so it fails on a regression rather than on ambition.

`collectCoverageFrom` excludes `main.ts`, `app.module.ts`,
`src/database/data-source.ts`, the migrations and every `mocks/` directory —
bootstrap, composition root, the TypeORM CLI entry point, generated schema and
test doubles respectively. Everything else counts, including files that sit at
0% and drag the average down; that is information, not noise.
