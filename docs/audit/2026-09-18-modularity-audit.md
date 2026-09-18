# NestJS Template — Modularity & Documentation Audit, 2026-09-18

Audited against commit `ea4d7e1` on `master`, with `pnpm install --frozen-lockfile`
completed.

| Gate | Result |
|---|---|
| `pnpm run build` | PASSES — exit 0 |
| `pnpm exec eslint` | 0 errors, 4 warnings |
| `pnpm test` | 36 suites, 295 tests, all passed |
| `pnpm run docs:check` | passed |

## Priority

Three buckets rank every `M`, `EXT` and `DOC` finding (37 total, none
omitted) against the template's own stated purpose — every top-level
directory under `src/` lifts into another repo on its own. No numeric score:
a reader deciding what to fix next is better served by three ordered groups
than by a count. Fix bucket 1 first.

### Breaks the promise (8 as measured; 5 still open as of `fix/documentation-remediation` — `DOC2`, `DOC5` and `DOC7` fixed, struck below)

A module provably cannot be lifted, or a guide states something false enough
that trusting it would send a reader straight at that same failure.

- **M2**, **M3**, **M5** — the `(app)`/`queues`/`spaceship` cycle: `queues`
  reaches into the app-root config scope (`M2`) and into the demo module
  `spaceship` (`M3`), closing a 3-node cycle (`M5`) that pulls the host
  application itself into the dependency, not just a sibling module. This is
  qualitatively worse than a two-module pair that still lifts together
  (`M6`, `M7`, below) because one of the three nodes is the app root itself.
  **Still open** — `M2`, `M3`, `M5` (and their extraction proof, `EXT3`/`EXT4`
  below) are the `queues`-decoupling design change this plan explicitly
  excludes from its scope (see Ruling P3, `progress.md`); no code changed.
- **EXT3**, **EXT4** — the measured proof of the same defect: copying
  `queues` alone leaves 29 unresolved imports, and the only closure that
  compiles needs 11 of the template's 13 top-level directories plus the
  app-root file `src/redis.scope.ts` — `EXT4`'s own verdict is "does not
  lift." **Still open**, same reason as `M2`/`M3`/`M5` above.
- ~~**DOC2**~~, ~~**DOC5**~~, ~~**DOC7**~~ — guides that would send a reader straight
  into the `M2`/`M3`/`M5` trap instead of warning them off it: `queues`'s
  `CLAUDE.md` Reuse section claims `abstract/` "depends only on
  `@nestjs/common`" and never names `queues.module.ts`'s app-root/`spaceship`
  imports at all (`DOC2`); its `README.md` — the document a non-agent reader
  would actually consult before lifting the module — says nothing about
  extraction cost whatsoever (`DOC7`); and the root `CLAUDE.md` tells every
  agent starting a session that build and lint are red and that `dotenv` is
  still duplicated, both false (`DOC5`). Each is a guide asserting the
  opposite of what this audit measured, not merely omitting detail.
  **All three fixed by `fix/documentation-remediation`** (see the `DOC2`,
  `DOC5` and `DOC7` entries below for verification detail) — the code
  defects (`M2`, `M3`, `M5`, `EXT3`, `EXT4`) remain open and are the only
  reason this bucket is not empty.

### Erodes the promise (19 as measured; 13 still open as of `fix/documentation-remediation` — `DOC1`, `DOC3`, `DOC4`, `DOC8`, `DOC9` and `DOC10` fixed, struck below)

The module still lifts — alone or with a bounded, real set of companions —
but a developer or agent copying it is misled about the cost, or hits
behaviour a module's own contract or guide promises and the code does not
deliver.

- **M1** — four files still use absolute `src/...` imports that break the
  moment the file is copied elsewhere; a per-file fix, not a structural one.
- **M4**, **M6**, **M7**, **M9** — real cross-module cycles/couplings
  (`auth`↔`database`, `common`↔`config-provider`, `analytics`→`logger`) that
  still close and lift as a pair, but the root `CLAUDE.md` module map
  presents some of these as independent siblings with no note that they
  must travel together.
- **M10**, **M12**, **M13**, **M15**, **M17**, **M18** — contract violations
  where a module's own guide or the shared contract promises behaviour
  (a dynamic-module shape, a thrown module-specific error) the code does not
  provide, at `queues`, `templating`, `logger`, `push-notification`,
  `cloud-storage` and `email` respectively. `M10` restates `M2`/`M3`'s
  mechanism from the contract-shape angle rather than adding new severity,
  which is why it sits here and not in bucket 1.
- **EXT7**, **EXT9** — the one coupling the import-graph checker cannot see
  at all (an ambient `@types/express` augmentation `common` needs in order
  to compile once extracted) and the resulting meta-finding that a green
  `pnpm run modularity:check` is not proof a module has no hidden cost.
- ~~**DOC1**~~, ~~**DOC3**~~, ~~**DOC4**~~, ~~**DOC8**~~, ~~**DOC9**~~, ~~**DOC10**~~ — guides whose
  worked examples do not compile or run as written: `push-notification`'s
  dead exception class taught as live (`DOC1`), `common`'s missing
  `typeRoots` note (`DOC3`), `logger`'s undercounted dependency and broken
  `@/` import alias (`DOC4`, `DOC8`), five independent drifts in
  `push-notification/README.md` (`DOC9`), and the root `README.md`'s
  license/package-manager contradictions plus its silence on both of the
  template's two workflows (`DOC10`). **All six fixed by
  `fix/documentation-remediation`** (see each entry below for verification
  detail); the underlying code defects these guides described (`M15`, `N1`,
  etc.) were deliberately left untouched, per this plan's scope.

### Cosmetic (10 as measured; 9 still open as of `fix/documentation-remediation` — `DOC6` fixed, struck below)

Naming, ordering, dead files, or a finding that documents a working, bounded
extraction cost rather than a defect.

- **M8**, **M11**, **M14**, **M16** — a disputed tier call this audit
  deliberately leaves as-is, a directory-shape deviation with no proven
  extraction cost, a DI-decorator inconsistency that still works stand-alone,
  and an analytics adapter whose error-swallowing is disclosed accurately in
  its own guide (so nothing here is a false claim, only a rule-4 technicality).
- **EXT1**, **EXT2**, **EXT5**, **EXT6**, **EXT8** — the successful
  measurements: `cache` lifts alone (`EXT1`/`EXT6`), `email` lifts with 2
  named companions confirmed by closure (`EXT2`/`EXT5`), and the per-module
  npm-package list (`EXT8`) — reference data, not defects.
- ~~**DOC6**~~ — `spaceship`'s `CLAUDE.md` test-naming note omits one of two
  legacy-named spec files; an incomplete inventory, not a false claim.
  **Fixed by `fix/documentation-remediation`** — see the `DOC6` entry below.

## What this audit asks

The template's stated purpose (`CLAUDE.md`, opening paragraph) is that every
top-level directory under `src/` can be lifted into another repository on its
own, and that a clone can be stripped down to the modules a project needs.
This audit tests that claim three ways: statically (the import graph), by
experiment (compiling an extracted module in isolation), and by reading every
guide the template ships to see whether it still describes the code.

Finding IDs are stable. `M` = modularity, `EXT` = extraction, `DOC` =
documentation. Findings from `docs/audit/2026-09-11-template-audit.md` keep
their original IDs and are reconciled in the last section. When a finding is
fixed, strike it here rather than deleting it, so citations stay resolvable.

### Module independence

Evidence: `node scripts/check-module-independence.mjs --report` at `4d64b6d`,
dumped to `docs/audit/evidence/module-graph.txt`. It found 14
violations, now recorded verbatim in
`docs/audit/module-independence-baseline.json` as the ratchet baseline (see
`pnpm run modularity:check`, which passes clean against it and fails the
moment a new violation appears — proven in this audit's working notes by a
throwaway edit to `src/cache/abstract/cache.service.ts`, reverted immediately
after).

**Post-review correction to the checker.** The final review of this branch
found that `scripts/check-module-independence.mjs` recorded an absolute
`src/...` import (`abs-import`, `M1`) as a portability violation but then
skipped it before it could contribute an edge — so an absolute import was
invisible to the tier and cycle checks, an undisclosed third coverage
boundary alongside `M9` and `EXT9`. The checker now resolves an absolute
specifier to its target module and records the edge (still flagging
`abs-import` too — an absolute import is both a portability defect and a
real dependency). Re-running `pnpm run modularity:check -- --report` after
the fix adds three previously-invisible edges (`auth -> user`, and the
already-partially-known `auth -> common`, plus the one this correction was
made to surface, `spaceship -> auth`, confirming `EXT4`'s
`src/spaceship/spaceship.module.ts:2` absolute import really is a dependency
on `auth`), but produces **no new tier or cycle violation** — every module
on both ends of these edges shares the same `feature` tier, so nothing in
the 14-violation baseline changed. A reader should take from this that the
module graph's edge coverage changed (absolute imports now count), not that
new coupling was discovered.

| ID | Finding |
|----|---------|
| **M1** | Six absolute `src/...` import specifiers, four files: `src/auth/jwt.strategy.ts:6-7`, `src/auth/google/google.controller.ts:3`, `src/auth/google/google.service.ts:5-6`, `src/spaceship/spaceship.module.ts:2`. `tsconfig.json` sets no `paths`, so these resolve only through `baseUrl: "./"` and break the instant the owning module is copied into another repo. Unchanged from N6. |
| **M2** | `queues` reaches into the app root's config scope: `src/queues/queues.module.ts:7` (`import ... from '../redis.scope'`) and `src/queues/abstract/tests/queues.module.di.spec.ts:26` (`import ... from '../../../redis.scope'`) both resolve to `src/redis.scope.ts`, module `(app)`. So `queues` cannot be copied into another repo without also carrying the host application's own root config file. |
| **M3** | `queues` (tier `infrastructure`) imports the demo feature module `spaceship`'s notification code at `src/queues/queues.module.ts:8-15` (`SPACESHIP_NOTIFICATION_QUEUE`, `SpaceshipNotificationProcessor`, `NotificationRecipientsAbstractModule`, `ConfigNotificationRecipientsProvider`, `notificationRecipientsScope`) and again at `src/queues/abstract/tests/queues.module.di.spec.ts:18,28`. So `queues` cannot be extracted without `spaceship`, even though `queues` is meant to be a generic infrastructure module and `spaceship` is the disposable reference feature. |
| **M4** | `database` (tier `infrastructure`) imports the feature module `auth`'s `AuthType` enum at `src/database/entities/user.entity.ts:2` (consumed at :17-18). So `database` cannot be extracted on its own without `auth`, contrary to `database`'s stated role as a generic entity/migration layer. See M8 for why `database`'s own tier assignment is part of what makes this read as a violation. |
| **M5** | **Strongest finding in this audit.** Tarjan SCC detection over the import graph surfaces a 3-node cycle, `cycle\|(app),queues,spaceship`, invisible to the old 2-node-only cycle rule this checker replaced. It closes because `(app)` imports `spaceship` directly (`src/app.module.ts:32`), `spaceship` imports `queues` (`src/spaceship/notification/notification.module.ts:3`, among others), and `queues` imports back into `(app)` via `redis.scope` (M2). Concretely: the app root, the general-purpose `queues` infrastructure module, and the throwaway `spaceship` demo feature are one mutually-dependent knot — none of the three can be removed or lifted into another repo without pulling the other two along with it. |
| **M6** | `cycle\|auth,database`: `auth` imports `database`'s `User` entity in 7 places (e.g. `src/auth/jwt.strategy.ts`, `src/auth/core/auth-token/auth-token.service.ts`, `src/auth/google/google.service.ts`) and `database` imports `auth`'s `AuthType` enum back (`src/database/entities/user.entity.ts:2`, M4). So `auth` and `database` can only ever be extracted together, never separately. |
| **M7** | `cycle\|common,config-provider`: `common` imports `config-provider` twice (`src/common/observability/analytics/config/analytics.scope.ts:2-3`) and `config-provider` imports `common`'s logger back 5 times (`src/config-provider/abstract/config-provider-abstract.module.ts:20`, `src/config-provider/abstract/config-provider.service.ts:1-2`, plus their `.unit.spec.ts` counterparts). So the two platform-tier modules can only be extracted as a pair. |
| **M8** | The `TIERS` map's two arguable calls (flagged in the task brief): `database` is tiered `infrastructure` although it ships the domain `User` entity, and `templates` is tiered `feature` although it is pug assets consumed only by the infrastructure module `email`. This audit leaves both as-is — retiering is a fix, not a finding — but records the consequence: `database`'s `infrastructure` tier is why M4 reads as a tier violation at all (reclassifying it `feature` would drop that one violation line from the tier table, though the `auth`/`database` cycle in M6 would remain regardless of tier). No `templates` edge appears among the current 14 violations, so `templates`'s classification is not currently masking anything, but a reader relying on the tier table to judge `templates` in isolation should know the call is disputed. |
| **M9** | **Checker coverage boundary — observability blind spot.** `moduleOf()` keys on the first path segment, so `src/common/observability/{logger,analytics,telemetry}` all collapse into one `common` module, even though the root `CLAUDE.md` module map lists the three as separate modules with their own `CLAUDE.md`/`README.md`. Resolved by hand rather than by extending the checker (a `moduleOf()` change and re-baseline would touch `scripts/`, outside this task's file list — recorded here as the call this task made and why). By-hand result: `analytics` imports `logger` in two places, `src/common/observability/analytics/posthog-adapter/posthog-adapter.service.ts:6-7` and `src/common/observability/analytics/console-adapter/console-adapter.service.ts:4-5` (both pull `LoggerService` and `NestLoggerAdapter`); `telemetry` (`src/common/observability/telemetry/tracing.bootstrap.ts`, `otel-env.ts`) imports neither `logger` nor `analytics`. So `analytics` cannot be extracted independently of `logger` despite the module map presenting them as siblings, while `telemetry` genuinely can be. The checker's violation count does not and cannot reflect this — it is a coverage gap, not a ratcheted defect. |

### Extraction

Evidence: `docs/audit/evidence/extract-{cache,email,queues}.txt` (single-module
probes) and `extract-{cache,email,queues}-closure.txt` (closure probes; `extract-cache.txt`
and `extract-cache-closure.txt` are legitimately zero bytes — that emptiness is
itself the evidence that `cache` compiles alone, not a missing file). Each was
produced by copying only the named `src/<module>` director(y/ies) into a scratch
directory containing a `tsconfig.json` that mirrors a fresh `nest new` project
(no `paths`, `baseUrl: "./"`, no `strict` family flags) plus `node_modules`
symlinked from the template (so package resolution never masks intra-repo
failures), then running `"$TEMPLATE/node_modules/.bin/tsc" --noEmit`. Three
modules were probed: `cache` (the contract's own reference implementation),
`email` (multi-adapter, config-heavy) and `queues` (the module the Task 3 graph
predicted was most entangled).

**Scope of this section.** Every probe below measures compile-time
extractability only — `tsc --noEmit` exiting 0 (or the closure needed to make
it exit 0). None of it tests whether a lifted module *boots*: whether
`cache`'s `forRootAsync` resolves when the host project registers no matching
config scope, whether a module's runtime `@Inject` graph is satisfiable
outside this app's `src/app.module.ts` wiring, or which environment variables
and scope registrations each module drags along at start-up. "Lifts cleanly"
below means "compiles cleanly" — runtime bootability is a real, open question
this audit does not answer.

| ID | Finding |
|----|---------|
| **EXT1** | **`cache` is the one module in this audit that lifts with nothing else — an existence proof that the template's stated goal is achievable, and the target the other modules should be measured against.** `cp -r src/cache <probe>/src/cache && tsc --noEmit` exits **0**, no output (`extract-cache.txt` is empty). `cache` has no relative import that leaves its own directory — `grep -rhn "from '\.\./\.\." src/cache --include='*.ts'` matches only paths that resolve back inside `cache` itself (e.g. `src/cache/redis-adapter/extensions/redis-cache-keys.extension.ts:4`, `../../abstract/cache.error`) — and no source file has an intra-repo dependency on this template's `common` module or on `config-provider` (six files do import the npm package `@nestjs/common`, e.g. `src/cache/abstract/cache-abstract.module.ts:6`, `src/cache/redis-adapter/redis-adapter.service.ts:1` — an ordinary framework dependency every `nest new` project ships, not the template's own `src/common/` module; the substance of this finding is the latter, intra-repo dependency, which is genuinely absent). **This corrects this task's original briefed premise**, which stated `cache` imports from `common` and `config-provider`; that premise was wrong. The Task 3 evidence itself (`docs/audit/evidence/module-graph.txt`) has no `cache -> common` or `cache -> config-provider` line; every edge touching `cache` is inbound (`(app) -> cache`, `spaceship -> cache`). Verdict: **lifts cleanly**. |
| **EXT2** | `cp -r src/email <probe>/src/email && tsc --noEmit` exits 2, 9 `TS2307` lines (`extract-email.txt`): 7 of the form `Cannot find module '../../common/...'` (e.g. `src/email/abstract/email.service.ts:6-7`, `src/email/utils/execute-html-email-send.ts:5`) and 2 `'../../config-provider/...'` (`src/email/config/email.scope.ts:2-3`). Distinct missing modules: **2** (`common`, `config-provider`) — matching the Task 3 graph's `email -> common (7)` / `email -> config-provider (2)` edge counts exactly. Verdict: **lifts with 2 companions**. |
| **EXT3** | `cp -r src/queues <probe>/src/queues && tsc --noEmit` exits 2, 29 `TS2307` lines (`extract-queues.txt`): `common` (13), `config-provider` (4), `spaceship` (7), `email` (2), `templating` (1) and the app-root file `src/redis.scope.ts` (2 — `src/queues/queues.module.ts:7`, `import ... from '../redis.scope'`; not a directory). Distinct missing modules: **6**, matching the Task 3 graph's `queues -> {common, config-provider, email, templating, spaceship, (app)}` edges exactly, both in which modules and in per-edge line counts. |
| **EXT4** | **Closure probe, `queues` — does not close to a small set.** Copying the 6 modules from EXT3 is not enough: `spaceship` (needed by `queues`) itself demands `cache`, `database`, `templates`, `user`, and — via its own absolute-import violation (`M1`) — `auth` (`src/spaceship/spaceship.module.ts:2`, `import ... from 'src/auth/auth.module'`; also `spaceship.service.ts:2,8`, `spaceship.controller.ts:19-20`, `spaceship.repository.ts:6`). Copying those five closes every `TS2307` (`extract-queues-closure.txt`, final run: 0 missing-module errors). Final closure: **11 of the template's 13 top-level `src/` directories** — `queues` plus `auth`, `cache`, `common`, `config-provider`, `database`, `email`, `spaceship`, `templates`, `templating`, `user` — **plus the app-root file `src/redis.scope.ts`**, which is not a directory a `nest new` project has any place for; it is the host application's own config wiring. Only `cloud-storage` and `push-notification` are excluded. The set closes at all only because it is large enough to hold both halves of three cycles this audit already recorded: `M5` (`(app)`/`queues`/`spaceship`), `M6` (`auth`/`database`), `M7` (`common`/`config-provider`). Concretely, `spaceship`'s own dependency back on `queues` (`M5`) is satisfied for free because `queues` is the very module being copied — that is a cycle, not a closure, and it is why "lifts with 6 companions" (EXT3's number) understates the real cost by 5 directories and 1 file. Reproduction: `cp -r src/queues src/common src/config-provider src/email src/templating src/spaceship src/redis.scope.ts src/cache src/database src/templates src/user src/auth <probe>/src/ && tsc --noEmit`. Verdict: **does not lift** — its only working closure is effectively the whole template. |
| **EXT5** | **Closure probe, `email` — closes at 3 directories.** `cp -r src/email src/common src/config-provider <probe>/src/ && tsc --noEmit` (`extract-email-closure.txt`) resolves every `TS2307` from EXT2. `common -> config-provider` / `config-provider -> common` (`M7`) is a 2-node cycle, but both halves are already in the set, so it does not grow further. Verdict: **lifts with 2 companions**, confirmed by closure. |
| **EXT6** | **Closure probe, `cache` — closes at 1 directory.** Trivial given EXT1: `cache` alone already closes, 0 companions, `tsc` exit 0. |
| **EXT7** | **`common` has a real, non-import extraction dependency: an ambient global type augmentation, root-caused.** Both the `email` closure (EXT5) and the `queues` closure (EXT4) leave a `TS2339` at `src/common/middleware/response.interceptor.ts:40` (`Property 'id' does not exist on type 'User'`) even with every `TS2307` resolved. Root cause: the repo root ships `@types/express/index.d.ts` (untracked by `src/`, at the template root), which reads `declare namespace Express { interface User { id: string } }` — this is what supplies `.id` on `req.user`. The template's own `tsconfig.json` loads it via `"typeRoots": ["@types", "./node_modules/@types"]`; the brief's from-scratch probe `tsconfig.json` sets no `typeRoots`, so TypeScript falls back to `./node_modules/@types` only and the augmentation is never loaded — which is why the error appears in every probe and in no full-tree `tsc --noEmit -p tsconfig.json` run (confirmed: that run's only error is an unrelated `test/app.e2e-spec.ts` supertest issue, `TS2349`), and why adding `auth` and `database` to the closure did not fix it (the declaration is not under `src/` at all). **Verified both directions**: copying `@types/` into the `email` closure probe and adding `"typeRoots": ["@types", "./node_modules/@types"]` to its `tsconfig.json` makes the `TS2339` disappear entirely (`extract-email-closure-with-typeroots.txt`) — the only error left is EXT7(b) below. Grepping `src/` for `req.user`, `request.user` and `Express.User` (`grep -rn "req\.user\|request\.user\|Express\.User" src --include='*.ts'`) finds exactly one other read of `request.user` — `src/user/current-user.decorator.ts:7` — but it returns the value untyped without touching `.id`, and both of its consumers (`src/auth/google/google.controller.ts:22`, `src/spaceship/spaceship.controller.ts:40`) declare their own explicit `User` (the database entity) as the parameter type rather than relying on the ambient `Express.User`, so neither depends on the augmentation. **`response.interceptor.ts:40` is the only line in the template that does.** Neither `src/common/CLAUDE.md` nor `src/common/README.md` mentions `@types/express`, the augmentation, or `typeRoots` (confirmed by grep — no hits). **Consequence:** extracting `common` into another repo compiles only if the destination project also copies the root `@types/` directory and sets `typeRoots` to include it; nothing in `common`'s own guide says so, so a developer following the module's documentation has no way to know. (b) `src/config-provider/abstract/config-provider-abstract.module.ts:223` — `TS2322`, a `Provider[]` assignability error — remains a probe-harness artifact, not a coupling defect: it disappears when the probe's `tsconfig.json` adds `strictNullChecks: true` (confirmed by rerunning EXT5's probe with only that flag added), the one strictness flag the template's root `tsconfig.json` sets that the brief's from-scratch probe config deliberately omits. Recorded so a reader does not mistake it for a missing module. |
| **EXT8** | **npm packages per module**, read from non-relative import specifiers (`grep -rhn "from '[^.]" src/<module> --include='*.ts'`), excluding what a fresh `nest new` project already ships (`@nestjs/*`, `reflect-metadata`, `rxjs`): `cache` needs only **`ioredis`**. `email` needs **`resend`, `@sendgrid/mail`, `@aws-sdk/client-ses`, `joi`**. `queues` needs **`bullmq`, `amqplib`, `@aws-sdk/client-sqs`, `joi`**, and also imports the Node builtin `node:buffer`, which needs no install. `node_modules` was symlinked into every probe precisely so none of this ever surfaced as a probe failure — this list comes from reading source, not from `tsc` output. |
| **EXT9** | **Coverage boundary: the modularity checker cannot see ambient-type dependencies, so a green `modularity:check` is not proof a module extracts cleanly.** `scripts/check-module-independence.mjs` builds its graph by regex-matching `from`/`import` specifiers in source text (`stripComments` + `specifiersOf`, matching `/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g`) and only follows specifiers starting with `.` (relative imports) into the graph at all. `@types/express/index.d.ts` (EXT7) contains zero `import`/`export`/`from` statements — it is a bare `declare namespace` block — so no amount of tightening that regex would ever surface it; the dependency has no import specifier to match. This is a second coverage boundary alongside `M9`'s (nested `observability` submodules folding into one `common` node): `M9` is a blind spot in how the checker buckets known edges, while this one is a blind spot in what counts as an edge at all. A reader must not treat a clean `pnpm run modularity:check` run as evidence that a module has no hidden extraction cost. |

### Contract conformance

Evidence: `docs/architecture/module-contract.md` in full (not the task brief's
summary of it), `find src -type d -name '*-adapter' | sort` (the brief's own
`src/*/[a-z]*-adapter/` glob misses `src/common/observability/logger/nest-adapter/`,
three levels deep — every listed adapter directory below was found with the
corrected command), and by opening every abstract module, every module's error
file (or lack of one), and one adapter service per module rather than trusting
grep hits alone. Findings continue the `M` series from Task 3 at **M10**.
Findings `N1`, `N2`, `N3`, `N5` are `docs/audit/2026-09-11-template-audit.md`'s
and keep their original IDs; they are re-verified, not restated, below.

**Scope note — where the brief and the contract disagree.** The contract's own
opening sentence names seven modules as implementing the shape: `cache`,
`cloud-storage`, `email`, `push-notification`, `templating`, `config-provider`,
`common/observability/logger`. It does not claim `queues`, `analytics` or
`telemetry` follow it. The brief's context (item 4) directs auditing all four
post-2026-09-11 modules "against the contract" as if the same claim applied
uniformly. Per this task's instructions, the contract wins: `telemetry` is
graded `n/a` throughout, because its own `src/common/observability/telemetry/CLAUDE.md`
states plainly, "This module does not follow the adapter-module contract... There
is no abstract class to inject" — a documented exemption, not a defect, and one
the contract's silence about `telemetry` corroborates. `queues` and `analytics`
are graded normally despite the same textual silence, because neither module's
own `CLAUDE.md` disclaims the contract the way `telemetry`'s does — both inherit
`docs/architecture/module-contract.md` in their own header and describe their
divergences as adaptations of the shape (`queues`: "the contract is split in
two"), not exemptions from it. `logger`, unlike `queues`/`analytics`, **is**
named in the contract's own text as implementing the shape, which makes its
missing error class (`M13`) a sharper finding than analytics's or queues'.

#### Conformance matrix

✅ conforms · ❌ does not, cell cites the finding · n/a rule does not apply to
this module's design (cited where the exemption is itself documented).

| Module | Directory shape | Rule 1 — abstract class is the token | Rule 2 — adapter is a plain class | Rule 3 — `forRoot` + `forRootAsync` | Rule 4 — adapters translate errors | Rule 5 — ships mocks |
|---|---|---|---|---|---|---|
| `cache` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `cloud-storage` | ❌ `N5` | ✅ | ✅ | ✅ | ❌ `M17` | ❌ `N5` |
| `config-provider` | ❌ `N5` | ✅ | ✅ | ✅ | ✅ | ❌ `N5` |
| `email` | ❌ `N5` | ✅ | ✅ | ✅ | ❌ `M18` | ❌ `N5` |
| `push-notification` | ❌ `N1`, `N5` | ✅ | ❌ `M14` | ❌ `N3` | ❌ `M15` | ❌ `N5` |
| `queues` | ❌ `M10`, `N5` | ✅ | ✅ | ✅ | ✅ | ❌ `N5` |
| `templating` | ❌ `M11`, `N5` | ✅ | ✅ | ❌ `N3` | ❌ `M12` | ❌ `N5` |
| `common/observability/logger` | ❌ `M13`, `N5` | ✅ | ✅ | ✅ | ❌ `M13` | ❌ `N5` |
| `common/observability/analytics` | ❌ `M16`, `N5` | ✅ | ✅ | ✅ | ❌ `M16` | ❌ `N5` |
| `common/observability/telemetry` | n/a | n/a | n/a | n/a | n/a | n/a |

25 of 54 graded cells (`telemetry`'s row is 6 `n/a` cells, ungraded) are ❌.
`cache` is the only module with a clean row, confirming its status as the
contract's reference implementation.

#### Findings

| ID | Finding |
|----|---------|
| **M10** | **Directory-shape deviation, `queues` — the split abstract layer and the root `queues.module.ts`.** `find src/queues -type f` shows no `src/queues/abstract/queues.service.ts`, `.interfaces.ts`, `.error.ts` or `-abstract.module.ts` at that level. Instead the contract is duplicated across two independent trees: `src/queues/abstract/producer/` (`queue-producer.service.ts`, `queue-producer.interfaces.ts`, `queue-producer.error.ts`, `queue-producer.module.ts`) and `src/queues/abstract/consumer/` (`queue-consumer.adapter.ts`, `.handler.ts`, `.interfaces.ts`, `.error.ts`, `.module.ts`) — a legitimate consequence of the module being bidirectional (`src/queues/CLAUDE.md`'s own "Scope" section says so), but still a shape the contract's diagram has no room for. On top of that split, `src/queues/queues.module.ts` sits at the module root as a concrete, non-dynamic `@Module` — not a `forRoot`/`forRootAsync` dynamic module at all — that hardcodes the BullMQ adapter (`:28-46`) and imports the domain module `spaceship`'s notification classes (`:8-15`, already the subject of `M2`/`M3`). Confirms the brief's item 5 exactly: this file is not "the contract's abstract module" — the two real abstract modules are `QueueProducerModule`/`QueueConsumerModule`, both of which do conform to rule 3 (see the matrix) — it is a bespoke composition root the contract's shape block does not describe, and it is the same file `M2`/`M3` already flag for the `redis.scope`/`spaceship` coupling. That confirms the brief's suspicion: this file is the seam where the contract broke down for `queues`. |
| **M11** | **Directory-shape deviation, `templating`.** `find src/templating -type f`: `abstract/` holds only `template-provider.const.ts` and `template.service.ts` — no `template.interfaces.ts`, no `template.error.ts`, and no `template-abstract.module.ts`. The dynamic module lives instead at `src/templating/template.module.ts` (module root, `export class TemplateModule`), the same root-level-module shape deviation `M10` records for `queues`. No `abstract/mocks/` either (`N5`). |
| **M12** | **Rule 4 violation, `templating`.** `src/templating/pug-adapter/pug-adapter.service.ts:14-21` (`compile`) has no `try`/`catch` at all: `pug.compileFile(fullPath)` and the call to the compiled template function can both throw (missing file, pug syntax error) and the raw `pug`/Node error propagates unchanged. There is no error class to translate into in the first place — `templating` ships no `.error.ts` (`M11`) — so this is not a missed `catch`, it is the absence of the module's own error type that rule 4 requires. |
| **M13** | **`common/observability/logger` ships no error class, despite being one of the seven modules the contract's own text names as implementing the shape.** `ls src/common/observability/logger/abstract/` returns `logger-abstract.module.ts`, `logger.interfaces.ts`, `logger.service.ts`, `serialize-error.ts` and their specs — no `logger.error.ts`. `serialize-error.ts` formats an `unknown` value for a log line (used by all three adapters, e.g. `src/common/observability/logger/pino-adapter/pino-logger.adapter.ts:4`); it is not an `Error` subclass with a code map, so it is not a rule-4 error type. No `abstract/mocks/` either (`N5`). Rule 1 and rule 3 are otherwise fully met (`LoggerService` is the token; `forRoot`/`forRootAsync` both exist, `src/common/observability/logger/abstract/logger-abstract.module.ts:29,50`) — this is a narrower gap than `push-notification`'s or `templating`'s, but it lands on the module the contract itself holds up as compliant. |
| **M14** | **Rule 2 violation, `push-notification`'s `ExpoAdapterService`.** `src/push-notification/expo-adapter/expo-adapter.service.ts:23-26` — the constructor is `constructor(@Inject(EXPO_ADAPTER_PROVIDER_CONFIG) config: ExpoAdapterConfig)`. Every other adapter checked across the template takes its config as a plain, undecorated constructor parameter (`src/cache/redis-adapter/redis-adapter.service.ts:18`, `src/cloud-storage/s3-adapter/s3-adapter.service.ts:36`, `src/email/resend-adapter/resend-adapter.service.ts:21`, `src/config-provider/secrets-manager-adapter/secrets-manager-config.adapter.ts:17`, `src/queues/bullmq-adapter/bullmq-producer.adapter.ts:31`, `src/common/observability/analytics/posthog-adapter/posthog-adapter.service.ts:17`). `ExpoAdapterService` is the one adapter in the template reaching for a NestJS DI decorator inside a class the contract calls "plain." `new ExpoAdapterService(cfg)` still works — the decorator is inert outside a DI container — so this does not break unit-testability the way `@Module` would, but it is a real, singular deviation from the pattern every other adapter follows. |
| **M15** | **Rule 4 violation, `push-notification` — the module's own error class is never thrown.** `grep -rn "new PushNotificationException" src` returns nothing: `PushNotificationException` (`src/push-notification/abstract/push-notification.exception.ts`) is defined and referenced in a type check but never constructed anywhere in the codebase. `ExpoAdapterService`'s two `catch` blocks (`src/push-notification/expo-adapter/expo-adapter.service.ts:76-82`, `111-116`) log via `console.error` and `throw error;` — re-raising the raw `expo-server-sdk` failure, or the adapter's own manually-thrown `InternalServerErrorException` (`:44`, `:67`), unchanged. Consequence: `src/push-notification/abstract/push-notification.controller.ts:34-36` (`if (error instanceof PushNotificationException) { throw error; }`) is dead code — nothing ever satisfies that branch — and every failure falls through to `throw new InternalServerErrorException(error)` at `:37`, which also hands the raw upstream error object to an HTTP exception constructor. `src/push-notification/CLAUDE.md` rule 6 says "Failures throw `PushNotificationException`"; the code does not. |
| **M16** | **`common/observability/analytics` ships no error class; its adapter swallows errors by documented design rather than translating them.** `ls src/common/observability/analytics/abstract/` has no `analytics.error.ts` (nor `abstract/mocks/`, `N5`). `PosthogAdapterService`'s three methods (`src/common/observability/analytics/posthog-adapter/posthog-adapter.service.ts:23-37`, `39-57`, `59-80`) each `catch` the PostHog client's error, log it, and return a safe default (`void`/`false`/`undefined`) instead of throwing anything — confirmed as deliberate by the module's own guide, `src/common/observability/analytics/CLAUDE.md` rule 2: "`capture()` is synchronous and fire-and-forget by design — `PosthogAdapterService` catches and logs its own client errors rather than propagating them." This is a defensible product choice (an analytics outage should not break the request), but it means rule 4 cannot be satisfied even in principle: there is no module error type to translate into, and the adapter is designed never to raise one. |
| **M17** | **Rule 4 partial gap, `cloud-storage`'s `LocalAdapterService`.** `src/cloud-storage/local-adapter/local-adapter.service.ts:29-49` (`uploadFile`) has no `try`/`catch` around `mkdir`/`writeFile` at all — a filesystem error (permissions, disk full) escapes as a raw Node `fs` error, not a `CloudStorageError`. `deleteFile` (`:51-65`) and `getFile` (`:67-87`) do translate the one case they check for (`ENOENT` → `CloudStorageError(FILE_NOT_FOUND)`) but re-throw every other error unchanged (`:63`, `:80`). This is confirmed as intentional — `local-adapter.service.unit.spec.ts:90,128` are titled "should rethrow non-ENOENT errors ... unchanged" — but intentional or not, an unmapped filesystem error still escapes the adapter raw, which is what rule 4 forbids. `S3AdapterService` (`src/cloud-storage/s3-adapter/s3-adapter.service.ts:64-110`) wraps every provider call in `try`/`catch` → `CloudStorageError` with no gaps and is the module's conforming half. |
| **M18** | **Rule 4 violation, `email`'s `AwsSesAdapterService`.** `src/email/aws-ses-adapter/aws-ses-adapter.service.ts` never imports `EmailError`. Its one `catch` block (`:81-84`, inside `sendWithHtmlContent`, the shared path for both `sendEmail` and `sendEmailBatch`) logs the failure and `throw error;` — re-raising the raw `@aws-sdk/client-ses` rejection, or the adapter's own manually-thrown plain `Error` (`:68`), unchanged. `EmailError`/`EMAIL_ERRORS` exist (`src/email/abstract/email.error.ts`) and are used correctly by the other three adapters, but not directly — `ResendAdapterService` and `SendgridAdapterService` both route through the shared `executeHtmlEmailSend` helper (`src/email/utils/execute-html-email-send.ts:39-49`), which is where the `EmailError` translation actually lives; `AwsSesAdapterService` is the one adapter that does not call that helper and has no translation of its own. This contradicts `src/email/CLAUDE.md` rule 5: "Adapters throw `EmailError`... A `@sendgrid/mail`, `resend` or `@aws-sdk/client-ses` error must never escape." |

#### Prior findings re-verified against `05fcd60`

| ID | Status |
|----|--------|
| **N1** | **Still open, unchanged.** `src/push-notification/abstract/push-notification-abstract.module.ts.ts` still carries the doubled `.ts.ts` extension, and `src/app.module.ts:26` still imports it by that literal name (`from './push-notification/abstract/push-notification-abstract.module.ts'`). |
| **N2** | **Still open; queues does not make it five.** The template still has exactly four competing error shapes: (a) POJO-constant + plain-`Error`-subclass (`cache`, `cloud-storage`, `email`, `config-provider`); (b) `RequestException`/`Exceptions` registry (`auth`, `common`); (c) `HttpException`-based (`push-notification`); (d) `ApiException`, a plain `Error` with no HTTP status (`cloud-storage`'s default controller). `queues`'s two new error classes, `QueueProducerError` and `QueueConsumerError` (`src/queues/abstract/producer/queue-producer.error.ts`, `src/queues/abstract/consumer/queue-consumer.error.ts`), are both POJO-constant + plain-`Error`-subclass — they join shape (a) rather than adding a fifth. Separately (not a new shape, a new gap): `logger` (`M13`) and `analytics` (`M16`) now ship *no* error class at all, which N2's four-shape count does not capture because you cannot compete with an absence — worth a reader's attention regardless. |
| **N3** | **Still open for both named modules; queues and the new observability modules do not have it.** `TemplateModule` (`src/templating/template.module.ts:18-36`) has only `static forRoot`, no `forRootAsync` — unchanged. `PushNotificationAbstractModule` (`src/push-notification/abstract/push-notification-abstract.module.ts.ts:20-48`) still has only `static forRoot` and still closes with the literal `} // TODO: Add forRootAsync`. The modules that postdate the prior audit do not repeat this gap: `QueueProducerModule` and `QueueConsumerModule` both have `forRoot` and `forRootAsync` (`src/queues/abstract/producer/queue-producer.module.ts:18,46`, `src/queues/abstract/consumer/queue-consumer.module.ts:38,68`), and so do `LoggerAbstractModule` and `AnalyticsAbstractModule` (`src/common/observability/logger/abstract/logger-abstract.module.ts:29,50`, `src/common/observability/analytics/abstract/analytics-abstract.module.ts:25,41`). |
| **N5** | **Still open, unchanged. `cache` remains the only module with `abstract/mocks/`.** `find src -type d -name mocks` returns exactly one directory: `src/cache/abstract/mocks`. Every other module graded in the matrix above — `cloud-storage`, `config-provider`, `email`, `push-notification`, `queues`, `templating`, `logger`, `analytics` — has none. |

### Agent guides (CLAUDE.md)

Evidence: `pnpm run docs:check` (the mechanical half — section presence,
backticked-path existence, module-map completeness only);
`docs/architecture/module-contract.md`'s "Writing a module CLAUDE.md" skeleton
and its three habits; every finding ID a module guide cites, checked against
`docs/audit/2026-09-11-template-audit.md`; every symbol in `## Public surface`
of the four newest guides (`src/queues/CLAUDE.md`,
`src/common/observability/{analytics,logger,telemetry}/CLAUDE.md`, and the
`auth0` additions to `src/auth/CLAUDE.md`) checked against its source file;
the root `CLAUDE.md`'s module map, Commands block and "Known template-wide
gaps" checked command-by-command. Findings continue the documentation series
at **DOC1**.

`pnpm run docs:check` passes: all 15 module guides carry all six required
sections, every backticked path resolves (or is correctly `!`-negated), and
the module map is complete. That is the mechanical half only — everything
below is what it cannot check.

**Clean checks, recorded because a findings section that only ever records
defects reads as untrustworthy.** All 15 module guides carry a `Does not own:`
line inside `## Scope` — no module lacks the contract's mandatory boundary
statement. No guide restates root-invariant text in place of citing `T1`-`T8`
(the brief's grep for the invariants' own phrasing returns zero hits);
`src/database/CLAUDE.md:34` and
`src/common/observability/telemetry/CLAUDE.md:39` both mention `process.env`,
but only to name themselves as the two files `T2` itself lists as exceptions,
not to restate the rule. Every finding ID cited by a module guide resolves in
`docs/audit/2026-09-11-template-audit.md`, and the two guides that cite a
since-fixed ID present it correctly: `src/cache/CLAUDE.md:111` strikes `L2`
through with "**Fixed:** the prefix was corrected..." and
`src/email/CLAUDE.md:112` strikes `B1` through the same way — neither tells an
agent a dead defect is live. `src/cache/CLAUDE.md`'s `## Reuse` (`:95-101`)
says `cache` lifts by copying `abstract/` plus the adapter directories
wanted, with `src/redis.scope.ts` an optional bring-along rather than a hard
dependency; that matches `EXT1`/`EXT6` exactly (`cache` alone: `tsc --noEmit`
exit 0) — `redis-adapter/` itself never imports `redis.scope.ts` or
`redisScope` (confirmed by grep) — so the guide is not merely optimistic, it
is accurate, and the one guide in this audit that gets to say so.

| ID | Finding |
|----|---------|
| **DOC1** | ~~**`src/push-notification/CLAUDE.md` asserts behaviour the code does not have.** Rule 6 (`:57`) reads "Failures throw `PushNotificationException`, which is an `HttpException`..." and the `## Tests` section (`:74-76`) repeats it: "assert chunking behaviour and the thrown `PushNotificationException`." `M15` established `grep -rn "new PushNotificationException" src` returns nothing — the class is defined and type-checked against but never constructed; `ExpoAdapterService`'s two `catch` blocks (`src/push-notification/expo-adapter/expo-adapter.service.ts:76-82,111-116`) re-throw the raw SDK error or the adapter's own `InternalServerErrorException` instead. The guide's own `## Known gaps` never lists this (it cites `N1`, `N2`, `N3`, `D4`, `G1`, `N5` — not `M15`), so an agent reading only the module guide has no way to learn the rule it just read is fiction.~~ **Fixed by `fix/documentation-remediation` (commit `d9f7def`):** rule 6 now reads "Failures do **not** throw `PushNotificationException`... See `M15`," and `## Known gaps` cites `M15` directly. Re-tested: `grep -rn "new PushNotificationException" src` still returns nothing — the code defect (`M15`) is unchanged and out of this plan's scope; only the guide's false claim was corrected. |
| **DOC2** | ~~**`src/queues/CLAUDE.md`'s `## Reuse` section (`:93-100`) understates the module's extraction cost on two independent axes — the most damaging kind of documentation defect, because an agent will act on it.** (a) Line 95 claims "`abstract/` depends only on `@nestjs/common`" — false: `abstract/producer/queue-producer.service.ts:2-3`, `abstract/producer/queue-producer.module.ts:7`, `abstract/consumer/queue-consumer.adapter.ts:2-3` and `abstract/consumer/queue-consumer.module.ts:18` all import `LoggerService`/`NestLoggerAdapter` from `src/common/observability/logger/` — a real intra-repo module dependency the section never names. (b) The section never mentions `queues.module.ts` at all, even though the module's own `## Scope` calls it "the wired default." That file imports `redisScope`/`RedisScopeConfig` from the app-root `../redis.scope` (`:7`) and five symbols from `spaceship` (`:8-15` — `SPACESHIP_NOTIFICATION_QUEUE`, `SpaceshipNotificationProcessor`, `NotificationRecipientsAbstractModule`, `ConfigNotificationRecipientsProvider`, `notificationRecipientsScope`). `M2`/`M3` and `EXT3`/`EXT4` already established this is not a trimmable detail: the module's real closure is 11 of the template's 13 top-level `src/` directories plus `src/redis.scope.ts`, and `EXT4` calls it "does not lift." An agent following the Reuse section's literal instructions — "Copy `abstract/` plus the adapter directories you want" — comes away believing queues costs at most a Redis scope file, never learning that the wired module `## Scope` just described cannot be extracted at all without carrying the app root and a demo feature module along with it. (`## Known gaps` does disclose the `spaceship` coupling in general terms — "imports a domain-specific recipients module" — but `## Reuse` is the section a lifting agent actually reads, and it is silent.)~~ **Fixed by `fix/documentation-remediation` (commit `d9f1c97`):** `## Reuse` now states plainly that `abstract/` needs `src/common/observability/logger/` and names the four importing files, and adds a dedicated paragraph stating `queues.module.ts` "does **not** lift," naming the `redis.scope`/`spaceship` imports and citing `M2`/`M3`/`EXT3`/`EXT4` directly. Re-tested by reading the current section: both axes are now covered. |
| **DOC3** | ~~**`src/common/CLAUDE.md`'s `## Reuse` section (`:77-79`) omits `common`'s only real extraction dependency.** It says the interceptor needs "`rxjs` and `express` types," which reads as, and is satisfied by, the ordinary `@types/express` npm package. `EXT7` found the actual dependency is a global ambient-type augmentation the template ships at the repo root, `@types/express/index.d.ts` (`declare namespace Express { interface User { id: string } }`), loaded only because `tsconfig.json:21` sets `"typeRoots": ["@types", "./node_modules/@types"]`; without copying that file and that `tsconfig.json` setting, `src/common/middleware/response.interceptor.ts:40` (`user.id`) does not type-check in a fresh project. Confirmed by grep: neither `src/common/CLAUDE.md` nor `src/common/README.md` contains the strings `@types/express`, `typeRoots` or "augmentation."~~ **Fixed by `fix/documentation-remediation` (commit `d9f1c97`):** the section now names the ambient augmentation, `@types/express/index.d.ts`, the exact `tsconfig.json` `typeRoots` setting that loads it, and cites `EXT7`. Re-tested: `grep -n "typeRoots\|@types/express\|augmentation" src/common/CLAUDE.md` now matches. |
| **DOC4** | ~~**`src/common/observability/logger/CLAUDE.md:86` undercounts what `abstract/` needs to lift.** It claims "`abstract/` and `nest-adapter/` need only `@nestjs/common`," but `abstract/logger-abstract.module.ts:8` imports `ClassConstructor` from the npm package `class-transformer` (a real dependency, `package.json:59`). Smaller and same-shape as `DOC3`: the Reuse section undercounts what a lift actually needs.~~ **Fixed by `fix/documentation-remediation` (commit `d9f1c97`):** `:86-87` now reads "`abstract/` needs `@nestjs/common` and `class-transformer` (`logger-abstract.module.ts` imports `ClassConstructor` from it); `nest-adapter/` needs only `@nestjs/common`" — more precise than the finding's own wording, since only `abstract/` (not `nest-adapter/`) needs `class-transformer`. Re-tested by reading the current line. |
| **DOC5** | ~~**The root `CLAUDE.md`'s "Known template-wide gaps" section (`:145-167`) contains defects that are themselves stale.** (a) `:150-151` — "`pnpm run build` and `pnpm run lint` both fail on `master` right now" is false: this audit's own gate table (measured at `ea4d7e1`, the branch point, on `master`) shows `pnpm run build` PASSES exit 0 and `pnpm exec eslint` returns 0 errors — every agent that starts a session in this repo is told the build is red when it is green. (b) `:161` — "**`B2`** — `package.json` declares `dotenv` twice" is false: `package.json` declares `dotenv` exactly once, both here (`:61`) and on `master` (`:60`); the 2026-09-11 audit's `B2` (a duplicate at lines 38/49 there) has been fixed without anyone striking it through anywhere it is cited. (c) `:164-165` — "even though all 120 tests pass" is stale: this audit's own gate table records 36 suites / 295 tests passing at the branch point, and 120 appears nowhere in the source `G2` finding either. (d) `B3` (`:162-163`, `apk`/`prisma` in the `Dockerfile`) and `TS1` (`:166-167`, no `"strict": true`) were re-verified and remain accurate and current — not every line in this section is wrong, only three of the eight. The Commands block (`:47-58`) was checked key-for-key against `package.json`'s `scripts` and matches exactly, `modularity:check` included. The module map lists every `CLAUDE.md` that exists and no guide that does not (`diff` against `find src -name CLAUDE.md`: clean). `T5`'s "four files still violate this" matches `M1`'s count exactly. (e) A fifth stale claim, outside the "Known template-wide gaps" section this finding otherwise scopes to: the `## Conventions` section's `Tests` bullet (`CLAUDE.md:132-133`) reads "The four `*.spec.ts` files are legacy (finding `N4`)" — there are five, not four. `find src -name "*.spec.ts" ! -name "*.unit.spec.ts"` returns `src/app.controller.spec.ts`, `src/auth/email/email.controller.spec.ts`, `src/spaceship/spaceship.controller.spec.ts`, `src/spaceship/spaceship.service.spec.ts` and `src/queues/abstract/tests/queues.module.di.spec.ts` — five files, matching this audit's own `N4` reconciliation row (`### Prior-audit reconciliation`, below), which already records the fifth file added since 2026-09-11. `DOC5` otherwise scoped its pass to the module map, Commands block and Known-gaps section (per this section's evidence line), so the Conventions section escaped that pass; recorded here rather than opening a new ID for the same defect shape.~~ **Fixed by `fix/documentation-remediation` (commit `13140ef`):** all five parts corrected — (a) the gaps section now opens "All four gates pass on `master`," citing this audit's gate table; (b) `B2` is struck as fixed, citing `DOC5`; (c) the "120 tests" claim is gone; (d) `B3`/`TS1` were left intact, correctly, since they remain open; (e) the Conventions `Tests` bullet now reads "The remaining `*.spec.ts` files are legacy," no longer citing a wrong count. Re-tested: `grep -n "120\|dotenv twice\|fail on \`master\`\|both fail" CLAUDE.md` returns nothing. |
| **DOC6** | ~~**`src/spaceship/CLAUDE.md`'s `N4` note is incomplete.** `:135-136` (and `## Tests`, `:83-84`) say `spaceship.repository.unit.spec.ts` "has been renamed" and that `spaceship.service.spec.ts` "is still legacy-named," but never mention `src/spaceship/spaceship.controller.spec.ts`, which the source `N4` finding also names and which still carries the legacy `*.spec.ts` name unchanged (`ls src/spaceship/*.spec.ts` shows both `.controller.spec.ts` and `.service.spec.ts` still present). The guide presents its own test suite as one file away from clean when a second legacy-named file sits in the same directory.~~ **Fixed by `fix/documentation-remediation` (commit `d9f7def`):** the `N4` note (`:135-137`) now names both `spaceship.controller.spec.ts` and `spaceship.service.spec.ts` as still legacy-named. Re-tested: `grep -n "controller.spec.ts\|service.spec.ts" src/spaceship/CLAUDE.md` shows both files named together at `:84-85` and in the `## Known gaps` entry. |

12 of the 16 `CLAUDE.md` files were read in full for this section (all four
Step-5 targets, the root file, `cache` and `email` as reference points,
`auth` and `common` — the latter is where `DOC3` was found —
`spaceship`, `push-notification`, `database`); the remaining module guides
were checked structurally (Steps 2-4) but not walked symbol-by-symbol against
their source, since Step 5 scopes that deeper pass to the four newest guides.
6 of the 16 guides carry at least one finding above: `push-notification`,
`queues`, `common`, `common/observability/logger`, the root `CLAUDE.md`, and
`spaceship`.

### Human guides (README.md)

Evidence: the Step 1 path-existence grep over all 12 module `README.md` files
(the brief's own `find`-plus-backticked-path-extraction command), a grep for
`registerAs|ConfigType<|@nestjs/config` and for `npm install|npm run|yarn `
across the same files, `grep '"@nestjs/config"' package.json` (no hits —
confirmed not a dependency), and — the part that
actually finds drift — reading every README in full and checking its primary
registration example's option names against the real `*-abstract.module.ts`
(or `*.module.ts`) options interface and the real adapter config interface,
opening the source file in each case rather than trusting the guide's prose.
Findings continue the documentation series at **DOC7**.

**Prior findings `D1`–`D4`, re-verified against `964eb88`: all four still
open, unfixed since 2026-09-11 — and all four subsequently fixed by
`fix/documentation-remediation` (re-tested by Task 12, see each entry).**

- ~~**`D1`** — `src/cloud-storage/README.md` still documents a
  `src/modules/infrastructure/cloud-storage/` tree with
  `cloud-storage.module.ts`, `cloud-storage-orchestrator.service.ts`,
  `cloud-storage.targets.ts`, `cloud-storage.tokens.ts`,
  `cloud-storage.config.ts` and an `IPFSAdapterService` (`:25-30`, `:50`,
  `:121-123`, `:187-223`). `find src/cloud-storage -type f` shows none of
  these exist; the real tree is `src/cloud-storage/abstract/`,
  `s3-adapter/`, `local-adapter/` with no orchestrator, targets enum, tokens
  file or IPFS adapter anywhere. `src/cloud-storage/CLAUDE.md`'s own "Known
  gaps" already carries this finding verbatim.~~ **Fixed (commit `244afc7`):**
  the never-built orchestrator/targets/tokens/IPFS sections were deleted
  outright (nothing to correct — they described code that was never
  written), and the directory tree plus the `forRootAsync` example were
  corrected to the real `abstract/`/`s3-adapter/`/`local-adapter/` shape.
  Re-tested: `grep -n "src/modules/infrastructure\|cloud-storage-orchestrator\|cloud-storage.targets\|cloud-storage.tokens\|cloud-storage.config.ts\|IPFSAdapterService" src/cloud-storage/README.md` returns nothing.
- ~~**`D2`** — `src/email/README.md` still documents `utils/email-logger.adapter.ts`
  (`:38`, `:88`), `abstract/email-logger.interface.ts` (`:24`) and
  `src/config/email.config.ts` (`:90`, `:145`). None exist (confirmed both by
  the Step 1 mechanical grep, which flags `src/config/email.config.ts` as
  the one `MISSING:` path across all 12 READMEs, and by `find src/email
  -type f`). The real config file is `src/email/config/email.scope.ts`.~~
  **Fixed (commit `244afc7`):** the two nonexistent logger files were
  deleted (never built), the config path was corrected to
  `src/email/config/email.scope.ts`, and the previously-undocumented
  `src/email/utils/execute-html-email-send.ts` was documented in their
  place. Re-tested: `grep -n "email-logger.adapter.ts\|email-logger.interface.ts\|src/config/email.config.ts" src/email/README.md` returns nothing.
- ~~**`D3`** — `src/config-provider/README.md:25` still names
  `config-provider-error-codes.ts`; the real file is
  `src/config-provider/abstract/config-provider.error.ts`
  (`find src/config-provider -type f`).~~ **Fixed (commit `244afc7`):**
  renamed to the real file, `src/config-provider/abstract/config-provider.error.ts`.
  Re-tested: `grep -n "config-provider-error-codes.ts" src/config-provider/README.md`
  returns nothing; the real file still exists at that path.
- ~~**`D4`** — `@nestjs/config`'s `ConfigType<...>` is still taught, unfixed, in
  four READMEs: `src/cache/README.md:65`, `src/cloud-storage/README.md:92,101`,
  `src/email/README.md:82,97-98` and `src/push-notification/README.md:59,69` (plus
  every `registerAsync` example in the last one). `src/common/observability/logger/README.md:82`
  also uses `ConfigType<typeof appConfig>` in one example — a fifth hit the
  original `D4` did not name, first surfaced by this task's grep.
  `grep '"@nestjs/config"' package.json` returns nothing — the package is not
  installed, so every one of these examples fails to compile if followed
  literally.~~ **Fixed (commit `1dc5870`):** every `ConfigType<...>` example
  across all five READMEs was replaced with the real `config-provider`
  registration pattern (`defineConfigScope` / `@Inject(xScope.KEY)`).
  Re-tested: `grep -rln "ConfigType<" src/cache/README.md
  src/cloud-storage/README.md src/email/README.md
  src/push-notification/README.md
  src/common/observability/logger/README.md` returns nothing, and
  `grep -c '"@nestjs/config"' package.json` is still `0` (correctly never
  installed).

**New findings.**

| ID | Finding |
|----|---------|
| **DOC7** | ~~**`src/queues/README.md` is completely silent about the module's real extraction cost — worse than its own `CLAUDE.md` (`DOC2`), which at least mentions the coupling in passing.** `grep -n "spaceship\|redis.scope\|Reuse\|lift\|extract\|companion\|copy" src/queues/README.md` returns three hits, none relevant (`companion` inside "the cross-broker read-side companion to retries"; `lift`/`lifted` describing SQS header handling). The README has no `## Reuse` section at all, unlike `cache`, `cloud-storage`, `config-provider`, `email` and `templating`'s guides. It documents the producer/consumer contracts, all three adapters (BullMQ, RabbitMQ, SQS) and their broker-specific behavior in real depth and with real accuracy (every registration example checked against `queue-producer.interfaces.ts` / `queue-consumer.interfaces.ts` matches exactly), but a reader deciding whether to lift `queues` — the one document a non-agent reader would consult — gets zero indication that `queues.module.ts` (the module's own "wired default", per its `CLAUDE.md` Scope) imports the demo module `spaceship` and the app-root `src/redis.scope.ts`, or that the module's real closure is 11 of 13 top-level `src/` directories (`M2`, `M3`, `EXT3`, `EXT4` — `EXT4`: "does not lift"). This is a stronger silence than `DOC2` found in the agent guide, whose "Known gaps" section at least names the `spaceship` coupling "in general terms."~~ **Fixed by `fix/documentation-remediation` (commits `cd29e72`, `c0ad1ef`):** the README now opens with a forward pointer ("Before you lift this...") and carries a full `## Reuse` section stating what lifts (`abstract/` and its non-DI-coupled tests) and what does not (`queues.module.ts`, naming the `redis.scope`/`spaceship` imports and the 11-of-13-directory closure). Re-tested: `grep -n "spaceship\|redis.scope\|Reuse\|lift\|extract\|companion\|copy" src/queues/README.md` now returns 15+ substantive hits including a dedicated `## Reuse` section. |
| **DOC8** | ~~**`src/common/observability/logger/README.md`'s two `Registration` examples import from a path alias that does not exist in this project.** Lines 64-65 and 76-77: `import { LoggerAbstractModule } from '@/common/observability/logger/abstract/logger-abstract.module';` (and the `NestLoggerAdapter`/`PinoLoggerAdapter` siblings). `cat tsconfig.json` has no `"paths"` key at all — only `baseUrl: "./"` — so `@/...` resolves to nothing; confirmed by `grep -rn "from '@/" src --include='*.ts'`, which returns zero hits anywhere in the real source tree, and by checking `package.json`/no `nest-cli.json` alias config. A developer copying either example verbatim gets an unresolvable import. (`src/cloud-storage/README.md` uses the same `@/modules/infrastructure/...` alias twice, but that is already covered by `D1`'s fictional-path finding; this is the first time the `@/` alias itself, independent of `D1`'s fictional directory, is named as the defect.)~~ **Fixed by `fix/documentation-remediation` (commit `1dc5870`):** both examples now import via relative paths (`./common/observability/logger/abstract/logger-abstract.module`, etc.), matching the project's real `baseUrl`-only resolution. Re-tested: `grep -n "@/" src/common/observability/logger/README.md` returns nothing, and `grep -rn "from '@/" src --include='*.ts'` still confirms the alias is used nowhere in real source either. |
| **DOC9** | ~~**`src/push-notification/README.md` carries five independent internal drifts, in addition to the already-known `D4`.** (a) Two import statements (`:171`, `:197`) read `import { PushNotificationAbstractModule } from './push-notification/push-notification-abstract.module';` — wrong on two counts: missing the `/abstract/` path segment, and missing the `.ts` suffix the doubled-extension file (`push-notification-abstract.module.ts.ts`, finding `N1`) requires in the import specifier. The README gets this right once, at `:60` (`'./push-notification/abstract/push-notification-abstract.module.ts'`, matching what `src/app.module.ts` actually does), then wrong twice later. (b) `import { ExpoAdapterModule } from './adapters/expo-adapter.module';` (`:172`, `:198`) — the real path is `./push-notification/expo-adapter/expo-adapter.module`; no `adapters/` directory exists anywhere in `src/`. (c) `:211` — `customController: [YourController], // Registers the custom controller` names an option the module does not have. `src/push-notification/abstract/push-notification-abstract.module.ts.ts:16` shows the real `forRoot` option is `controllers?: Type<any>[]`, not `customController`; this is drift in the option name itself, not merely the path around it, and is not covered by any `M`-series finding since the module *does* have the feature — the README just names it wrong. (d) The directory tree (`:27`) lists `expo-adapter-config.provider.const.ts`; the real file (`find src/push-notification -type f`) is `expo-adapter-config-provider.const.ts` (hyphen, not dot, before `provider`). (e) `## Installation` (`:48`) reads literally `npm expo-server-sdk` — not valid syntax for any package manager (missing `install`/`add`), and if corrected would still be `npm`, not `pnpm`; every other README's install instructions correctly use `pnpm add` (`src/common/observability/logger/README.md:159-160,296,324,332`, `src/config-provider/README.md:274`). This line is why the brief's own Step 2 grep (`npm install\|npm run\|yarn `) is not sufficient by itself — it does not match `npm expo-server-sdk` because the line has no `install`/`run` keyword, so this hit surfaced only by reading the file. Checked separately per brief item 4: this README does **not** repeat `DOC1`'s/`M15`'s false claim that `PushNotificationException` is thrown — the string never appears in the file at all, so the human guide does not carry that particular falsehood, only these five.~~ **Fixed by `fix/documentation-remediation` (commit `210e890`, plus a sixth drift found during remediation and fixed in commit `79d9fbf`):** (a)-(e) all corrected — imports now include `/abstract/` and the `.ts` suffix; `ExpoAdapterModule`'s import path is the real one; the option is now `controllers: [CustomNotificationController]`, matching `controllers?: Type<any>[]`; the directory tree lists the real hyphenated filename; and `## Installation` now reads `pnpm add expo-server-sdk`. **A sixth drift, not part of the original five, was found while fixing this file and is recorded here for an honest count and history:** the "Enabling a Custom Controller" example imported `CustomNotificationController` (`:199`) but its `forRoot` call referenced an undefined `YourController` (`:212`) — a self-inconsistent example the original five-drift review did not catch because it checked paths and option names, not identifier agreement within one example. Fixed in commit `79d9fbf` by making both identifiers agree on `CustomNotificationController`. Re-tested: `grep -n "push-notification-abstract.module\|ExpoAdapterModule\|customController\|expo-adapter-config\|npm \|pnpm add\|YourController" src/push-notification/README.md` shows all paths correct, no `customController` or `YourController` remaining, and `pnpm add` in place of `npm`. |

**Modules with no finding above, checked in full.** `src/cache/README.md`
(registration examples for `forRoot`/`forRootAsync` and the `RedisAdapterConfig`
shape both match `cache.interfaces.ts` and `redis-adapter-config.interface.ts`
exactly; the module has no `Reuse`/extraction-cost section at all, so unlike
its `CLAUDE.md` it makes no claim about `EXT1`'s "lifts with nothing else"
finding to credit or fault — it is silent, not wrong). `src/common/README.md`
(the one documented function, `validateAdapterModule`, matches
`nest-module-validation.ts`'s real signature exactly; confirmed, per brief
item 4, that it never mentions `@types/express`, `typeRoots` or "augmentation"
— the same silence about `EXT7` that `DOC3` already found in its `CLAUDE.md`,
now confirmed from the README's side too, not a new finding since `DOC3`
already names the underlying defect and this task's brief treats a doc
defect as reportable once). `src/common/observability/analytics/README.md`
(matches `analytics-abstract.module.ts`'s options; carries no registration
code example to check further). `src/common/observability/telemetry/README.md`
(the `@Span()` examples match `span.decorator.ts` exactly). `src/config-provider/README.md`
(every option in the `forRootAsync`/`forRoot` examples, `defineConfigScope`'s
four-argument signature, `reloadableSourceToken`, and `jwtScope.KEY`'s literal
value `'CONFIG_SCOPE_JWT'` all match `config-provider.interfaces.ts`,
`define-config-scope.util.ts` and `config-provider-tokens.ts` exactly — `D3` is
its only defect). `src/templates/README.md` (correctly documents that this
directory ships no Nest module/provider at all, matching its `CLAUDE.md`; its
registry example is illustrative and omits the real third entry,
`SPACESHIP_CREATED`, but never claims to be exhaustive, so that is not drift).
`src/templating/README.md` (the `TemplateModule.forRoot`, `PugAdapterModule.register`
and `TemplateService.compile` signatures in its examples all match
`template.module.ts`, `pug-adapter.module.ts` and `template.service.ts`
exactly — no findings).

**`PRACTICES.md` verdict.** `src/common/observability/logger/PRACTICES.md`
(cited by the root `CLAUDE.md` as the logging rules and by the 2026-09-11
audit's `C5`) was read in full and checked against `LoggerService`'s real
abstract methods (`setContext`, `log`, `warn`, `error`, `debug`) and
`LogInput`'s real shape (`{ message, data? }`) in
`src/common/observability/logger/abstract/logger.interfaces.ts`. Every code
example (`this.logger.log({ message, data })`, `setContext(ClassName.name)`,
the past-tense event-name examples) uses the real API correctly, names no
file that does not exist, and describes no method the service does not have.
**No drift found** — the rules describe policy (which level to use, what
never to log, controllers stay log-free) rather than an API surface, which is
exactly the kind of content that does not go stale when the code changes
underneath it. This is not the same claim as "every rule is followed" — `C5`
already documents one violation of it (`src/auth/google/google.service.ts`
logging a raw provider error) — only that the document itself teaches nothing
false.

**Step 4 — the three modules with a `CLAUDE.md` and no `README.md`.**
`src/auth`, `src/database` and `src/spaceship` are all marked `—` in the root
`CLAUDE.md`'s module map "Human guide" column. None of the three `CLAUDE.md`
files contains the word "README" anywhere (`grep -n "README" src/auth/CLAUDE.md
src/database/CLAUDE.md src/spaceship/CLAUDE.md` — zero hits) — so in every
case the absence is undocumented; no guide states whether it is deliberate.
Judged module by module:

- **`src/spaceship` — the absence reads as deliberate, even though the guide
  never says so explicitly.** `src/spaceship/CLAUDE.md:6` opens "**This module
  exists to be copied**" as a worked *example*, and its own `## Reuse` section
  (`:90`) is explicit: "Do not copy this module into a project. Delete it, and
  copy its *shape*." A module whose own guide tells a reader not to lift it as
  a unit has a coherent reason to skip a human-facing "how to lift this"
  guide — the inconsistency `DOC7` flags for `queues` (silence where the
  module actually is meant to be lifted) does not apply here.
- **`src/database` — a real gap, not a clear "deliberate."** `src/database/CLAUDE.md`
  ships a full `## Reuse` section (`:77-88`) that reads exactly like the
  Reuse section of a module that does have a README: what transfers unchanged
  (`base.entity.ts`, the migration scripts), what carries a dependency to port
  together (`database.module.ts` / `database.scope.ts` with
  `config-provider`), and what to do about the `auth` coupling
  (`User.authType`). Nothing in the file explains why that guidance lives only
  in the agent-facing doc.
- **`src/auth` — the sharpest case, and worth a finding either way.**
  `src/auth/CLAUDE.md:142-155` likewise ships a full `## Reuse` section (what
  four things to port first, the peer-dependency list, how to drop
  `google`/`auth0` cleanly) — again, the same kind of content every
  README-bearing module puts in its human guide. `src/auth`'s own `## Scope`
  names three login methods (email, Google, Auth0), but only two are actually
  implemented: `src/auth/email/email.controller.ts` and `src/auth/auth.service.ts`
  are both empty scaffolds (finding `R3`), confirmed by reading both files.
  **Correction (Task 12):** this section's original phrasing here, "now
  fronts three independent login methods," overstated that by one — Google
  and Auth0 are the two working, independently-droppable providers. No guide
  was ever wrong about this: `src/auth/CLAUDE.md:147` already stated the
  email scaffold's status plainly, predating this audit. The looseness was
  this audit's own prose, corrected in place rather than struck, since
  nothing was ever fixed. Either way, `src/auth` is one of the larger, more
  consequential modules in the template by surface area — and a developer
  deciding *whether to adopt this module's auth strategy at all*, as opposed
  to an agent already committed to editing it, has no human-facing document
  to read. Given both `auth` and `database`
  document their extraction cost in agent-only form with no stated reason,
  this reads as a documentation gap the template should either close (write
  the READMEs) or own explicitly (state in each `CLAUDE.md`, as `spaceship`'s
  effectively does, that no human guide is planned and why).

**Coverage.** All 12 module `README.md` files were read in full, and for each
one that carries a registration/usage code example, at least one was checked
line-by-line against the real `*-abstract.module.ts` (or `*.module.ts`)
options interface and the real adapter config interface named in that
example — not sampled. One of the 12,
`src/common/observability/analytics/README.md`, carries no registration code
example at all (noted above), so nothing there was left unchecked — there was
no example to check.
`src/common/observability/logger/PRACTICES.md` was also read in full. The
three `CLAUDE.md` files in Step 4 (`src/auth`, `src/database`, `src/spaceship`)
were read for their `Scope`/`Reuse`/`Known gaps` sections only, not
symbol-by-symbol, since Task 6 already audited them as agent guides. The
Step 1 path-existence grep and the Step 2 `@nestjs/config`/`npm` greps were
run mechanically over all 12 files as specified in the brief; every hit they
produced was opened and confirmed by hand before being written up above.
7 of the 12 READMEs carry at least one finding above: `cache` (`D4`),
`cloud-storage` (`D1`, `D4`), `email` (`D2`, `D4`), `config-provider` (`D3`),
`push-notification` (`D4`, `DOC9`), `queues` (`DOC7`),
`common/observability/logger` (`D4`, `DOC8`). The remaining 5 (`common`,
`common/observability/analytics`, `common/observability/telemetry`,
`templates`, `templating`) carry none.

#### Root README

Evidence: `cat README.md` (98 lines, read in full), `ls LICENSE` (Step 2 of
the brief), `grep -n "never npm or yarn" CLAUDE.md`, `grep -n "pnpm"
bitbucket-pipelines.yml`, `ls docs/architecture/module-contract.md
docs/audit/2026-09-11-template-audit.md` (link-target checks), `grep -n "R3"
docs/audit/2026-09-11-template-audit.md`, `cat src/templates/template.const.ts`,
`grep -n "spaceship" src/app.module.ts .env.example`, and
`src/spaceship/CLAUDE.md:90`. This continues the documentation series at
**DOC10**.

**Classification of the file.** Of the root `README.md`'s 98 lines, lines
1–27 (logo, CircleCI/npm/Coveralls/Discord/Open Collective/PayPal/Twitter
badges, `## Description`) and lines 86–98 (`## Support`, `## Stay in touch`,
`## License`) are unmodified upstream `nestjs/nest` boilerplate — the same
finding prior audit `D5` already made ("Root `README.md` is unmodified NestJS
boilerplate"). Confirming what has changed since `D5`: lines 29–40, the
"SpaceDev template documentation" section, have been grafted in and are new
since the 2026-09-11 audit; nothing else has changed. `D5`'s second half
("instructs `npm install` while CI and Docker use pnpm") is also still
literally true today, unfixed — see the pnpm/npm finding below.

**What is right and should be kept.** Lines 29–40 ("SpaceDev template
documentation") are accurate and useful, and a wholesale rewrite of the file
would be wrong — this 12-line section, not the other 86 lines, is the part
worth preserving. Every link target it names exists and was checked directly:
`CLAUDE.md` (root, present), `docs/architecture/module-contract.md`
(`ls` confirms), `docs/audit/2026-09-11-template-audit.md` (`ls` confirms),
`src/<module>/CLAUDE.md` and `src/<module>/README.md` (both patterns
confirmed present for every module carrying a guide, per the root
`CLAUDE.md` module map already audited by Task 6). `README.md:40`'s
`pnpm run docs:check` instruction is itself correct against
`bitbucket-pipelines.yml:15` and `package.json`.

~~**`DOC10` — the root README serves neither of the two workflows the template
exists for, misattributes the work in its closing sections, and contradicts
itself on package manager. Three parts, one finding.**~~

**Fixed by `fix/documentation-remediation` (commits `0f07a8c`, `019e165`,
`2bbbfa9`):** part (a)'s boilerplate was deleted (lines 1-27 and 86-98,
including the false `LICENSE` link and the `nestjs/nest` misattribution;
README 98 → 70 lines), keeping and extending only the accurate 12-line
"SpaceDev template documentation" section; part (b)'s `npm` commands were
all converted to `pnpm`, removing the self-contradiction; part (c)'s two
missing workflows were both written, growing the README from 71 to 145
lines. Re-tested below, part by part; the detailed evidence in (a)-(c) is
left as the historical record of what was found.

*(a) Misattribution and a false legal claim.* ~~`README.md:86-88` ("Nest is an
MIT-licensed open source project... If you'd like to join them, please read
more here", linking `docs.nestjs.com/support`), `:90-94` ("Author - [Kamil
Myśliwiec]", "Twitter - @nestframework") and `:96-98` ("Nest is
[MIT licensed](LICENSE)") all describe the upstream `nestjs/nest` framework
project, not this repository — they credit a third party's authorship and
solicit donations/sponsorship to a project this template only depends on. On
a SpaceDev internal template this is not a stale-content nit, it is
misattribution: a reader has no way to tell, from the file itself, that these
three sections describe the framework and not the template. Separately, the
License section's specific claim is false as written: `README.md:98` links
`LICENSE` as if that file exists in this repository; `ls LICENSE` returns "No
such file or directory" — there is no LICENSE file in the repo at all. Note
for scope: this audit does not take a position on what license (if any) this
internal template should carry, or draft replacement text — only that the
document currently asserts an unverifiable/false legal fact and misattributes
the work; that determination is not the auditor's to make.~~ **Fixed:** all
three sections (`:86-88`, `:90-94`, `:96-98`) were deleted along with the
rest of the unmodified boilerplate; the license question was correctly left
open for the repo owner rather than answered unilaterally. Re-tested:
`grep -n -i "license" README.md` returns nothing, and `grep -n "Kamil\|Nest is"
README.md` returns nothing.

*(b) The pnpm/npm contradiction, including a same-file self-contradiction.*
~~`README.md:44-46` ("## Installation", `$ npm install`), `:62-71` ("## Running
the app", `$ npm run start` / `start:dev` / `start:prod`) and `:75-84`
("## Test", `$ npm run test` / `test:e2e` / `test:cov`) all use `npm`. Every
other authority disagrees: `CLAUDE.md:48` states "pnpm 10.15.1, Node
24.15.0 — never npm or yarn"; `bitbucket-pipelines.yml:13-18` runs `corepack
prepare pnpm@10.15.1 --activate`, `pnpm install --frozen-lockfile`, `pnpm run
docs:check`, `pnpm run modularity:check`, `pnpm run lint`, `pnpm run build`
(this branch's own Task 9 inserted the `modularity:check` line, shifting
`lint`/`build` down by one and widening this citation from the original
`:13-17`) — CI never invokes `npm`. The
contradiction is not even confined to different sections written at different
times: `README.md:40`, four lines below the "SpaceDev template documentation"
section's own accurate content, already tells the reader to run `pnpm run
docs:check` — so the same file instructs the same reader to install with
`npm` at line 45 and to run a script with `pnpm` at line 40. This is `D5`'s
pnpm/npm observation, still open and now cited with exact line numbers on
both sides plus the same-file self-contradiction `D5` did not note.~~
**Fixed:** every command in the README now uses `pnpm`. Re-tested:
`grep -nE '(^|[^p])npm (install|run)|\$ npm' README.md` returns nothing
(exit 1); `grep -n "pnpm" README.md` shows the install, run and test
sections all converted.

*(c) Neither of the two workflows the template exists to serve is
documented, and this audit's own measurements are what would make both
recipes writable.* ~~The file has no section addressing either "pull one
module into another Nest project" or "clone this repo and delete what you
don't need" — confirmed by reading all 98 lines; the only content about the
template's structure is the 12-line "SpaceDev template documentation"
section, which points a reader at the per-module guides but supplies no
catalogue, no extraction-cost data and no deletion order itself.~~ **Fixed:**
both recipes below (`Workflow 1`/`Workflow 2`) are now written into the
README as `## Use a module in another project` and `## Clone the template
and strip what you don't need`. Re-tested: `grep -n "^## " README.md` shows
both headings present. **Correction (Task 12, fix round 1):** the
`Workflow 1`/`Workflow 2` bullets below assert, sentence by sentence, that
this data is absent from the README — that is no longer true of any of it,
so they are struck through in full below, the same as (a)-(c) above, rather
than left standing as if still live.

- **Workflow 1 — lift a module into an existing project.** ~~The README names
  no per-module extraction cost anywhere, even though this audit's Task 4
  extraction probes already produced exactly that data in reproducible form:
  `EXT1` shows `cache` lifts with **zero** companion directories (`cp -r
  src/cache <probe>/src/cache && tsc --noEmit` exits 0). `email` lifts with
  **2** companions, `common` and `config-provider` (`EXT5`). `EXT3`/`EXT4`
  show `queues` does **not** lift in any practical sense: its closure needs
  11 of the template's 13 top-level `src/` directories plus the app-root file
  `src/redis.scope.ts`, and the closure only closes at all because it happens
  to contain both halves of three cycles this audit already recorded (`M5`,
  `M6`, `M7`) — copying `queues` alone gets a reader 29 unresolved-import
  errors, not a working module. `EXT7` adds a dependency the README cannot
  even gesture at today because nothing in the repo documents it: extracting
  `common` also requires copying the repo-root `@types/` directory and adding
  a `typeRoots` entry to the destination project's `tsconfig.json`, or the
  copy compiles with one remaining type error — `src/common/CLAUDE.md` and
  `src/common/README.md` are both silent on this (already flagged from the
  agent-guide side as `DOC3`, confirmed again from the README side in this
  task's Step 4). None of this — which modules are cheap to lift, which are
  not, and the one non-import dependency extraction can hit — appears in the
  root README, and every number above is already measured and citable by ID;
  the recipe the README is missing does not need new investigation to write.~~
  **Fixed (Task 9, commit `2bbbfa9`):** `README.md`'s `## Use a module in
  another project` now states the `@types`/`typeRoots` step explicitly and
  gives the `cache`/`email`/`queues` numbers (`EXT1`, `EXT5`, `EXT3`/`EXT4`)
  by name. Re-tested by reading that section in full against the numbers
  above — they match.

- **Workflow 2 — clone and strip.** ~~Nobody has documented this workflow
  anywhere in the repo (confirmed: `grep -rn "strip\|delete.*module\|remove
  this module" README.md CLAUDE.md` returns nothing relevant). This audit's
  own findings answer every question such a recipe would need to raise:~~
  - ~~*Which directories are demo/reference, not template infrastructure.*
    `src/spaceship/CLAUDE.md:1` is literally titled "Spaceship — reference
    domain module," and `:90` gives the workflow its own named first step in
    words the root README never repeats: "Do not copy this module into a
    project. Delete it, and copy its *shape*." `src/templates/` is partially
    demo content, not wholly: `src/templates/template.const.ts` registers
    three templates, `WELCOME` and `VERIFICATION` (generic onboarding/auth,
    used regardless of `spaceship`) alongside `SPACESHIP_CREATED`, whose
    files live under `src/templates/spaceship/` — so "delete `templates`" is
    the wrong instruction; "delete `src/templates/spaceship/` and its
    `TEMPLATES.SPACESHIP_CREATED` / `TEMPLATE_PATHS` / `TEMPLATE_SUBJECTS`
    entries" is the correct one, and only a reader who already has this
    audit's Task-4/Task-6 detail could know that distinction. `src/user`
    is a candidate too, on weaker but real grounds: the root `CLAUDE.md`'s
    module map already notes it "has no guide" and holds only
    `current-user.decorator.ts` plus "an empty `src/user/user.module.ts`
    that nothing imports," citing prior finding `R3`
    (`docs/audit/2026-09-11-template-audit.md:81`) — dead scaffolding a
    stripped-down clone would otherwise inherit unexamined.~~ **Fixed** —
    `README.md`'s clone-and-strip section now names `spaceship` as the
    demo module to delete (quoting `src/spaceship/CLAUDE.md:90` directly)
    and correctly scopes the `src/templates/` deletion to
    `src/templates/spaceship/` rather than the whole directory.
  - ~~*What `src/app.module.ts` and `.env.example` need edited after each
    deletion.* Concretely, for `spaceship` alone: `src/app.module.ts:32`
    (`import { SpaceshipModule } from './spaceship/spaceship.module'`),
    `:55` (`notificationRecipientsScope` import), `:56`
    (`spaceshipCacheScope` import), `:81` (`spaceshipCacheScope` registered
    in the config scopes array) and `:98` (`SpaceshipModule` in the
    `imports` array) all reference it and would need removing; `.env.example:32-33`
    (`NOTIFICATION_EMPLOYEE_EMAILS`, `SPACESHIP_LIST_CACHE_TTL_SECONDS`) are
    both `spaceship`-only env vars that would become dead configuration if
    left behind. None of this is in the README or in `spaceship`'s own
    guide (which describes what to keep, not what else references it).~~
    **Fixed** — the README now lists all six `src/app.module.ts` reference
    points (lines 32, 55-56, 80-81, 98) and the one `.env.example` variable
    to remove.
  - ~~*What breaks if you delete a module something else imports.* This is
    exactly what Task 3's import graph and `M5` already answer: `(app)`,
    `queues` and `spaceship` form one mutually-dependent cycle (`M5`), so
    deleting any one of the three without also removing the other two leaves
    an unresolvable import — a fact a stripping developer needs *before*
    deleting `spaceship` on `src/spaceship/CLAUDE.md:90`'s advice, not after
    hitting a build error.~~ **Fixed** — the README now states the
    `(app)`/`queues`/`spaceship` cycle (`M2`, `M3`, `M5`) explicitly before
    the deletion steps, and tells the reader to re-run
    `pnpm run modularity:check -- --report` rather than trust a stale copy
    of the graph.

  ~~The point of citing `EXT1`, `EXT3`, `EXT4`, `EXT7`, `M5`, `R3` and
  `src/spaceship/CLAUDE.md:90` together is that a "clone and strip" recipe
  and a "lift one module" catalogue are both writable today from data this
  audit already produced — the gap is that nobody has written them into the
  one document a new consumer of this template would actually open first.
  This finding does not draft that content; establishing that it is missing,
  and that the material to write it exists, is the deliverable.~~ **Fixed by
  `fix/documentation-remediation` (commit `2bbbfa9`):** both recipes this
  finding said were writable-but-missing are now written, using the exact
  IDs and data cited throughout this finding. Re-tested by reading
  `README.md`'s `## Use a module in another project` and `## Clone the
  template and strip what you don't need` sections in full against every
  claim above.

### Prior-audit reconciliation

Every finding from `docs/audit/2026-09-11-template-audit.md` (32 IDs,
`B1`-`B3`, `N1`-`N7`, `D1`-`D5`, `C1`-`C5`, `TS1`-`TS3`, `L1`-`L3`, `R1`-`R4`,
`G1`-`G2`), verified against today's tree at branch point `aa9ab86`. Fourteen
of these were already re-verified in earlier sections of this audit (Task 5's
"Prior findings re-verified" under `### Contract conformance`, Task 6's pass
over the root `CLAUDE.md`'s "Known template-wide gaps," and Task 7's pass
over `D1`-`D4`); this table cites their work rather than repeating it and
adds fresh verification for the remaining eighteen (`N4`, `N7`, `D5`,
`C1`-`C5`, `R1`-`R4`, `G1`, `TS2`, `TS3`), each confirmed by opening the file
rather than trusting a grep hit alone, per this document's own house rule
(see "On grepping for evidence" in the plan this audit followed).

Do not edit `docs/audit/2026-09-11-template-audit.md` — this audit reports on
it; its own strike-throughs are the prior author's record, not this one's.

| ID | Status | Evidence |
|----|--------|----------|
| **B1** | Fixed | `pnpm run build` exits 0 (this audit's own gate table, measured at `ea4d7e1`). The 2026-09-11 audit already struck this through as "Fixed on `fix/build-and-lint`"; that branch has since reached `master`. |
| **B2** | Fixed | `grep -c '"dotenv"' package.json` → `1` (line 61). Re-verified by Task 6. |
| **B3** | Still open | `grep -n 'apk\|prisma' Dockerfile` → `:3` `RUN apk add dumb-init`, `:20` `RUN pnpm exec prisma generate` — a Debian base image with no `apk`, and a Prisma call in a TypeORM project. Re-verified by Task 6, unchanged; confirmed again here. |
| **N1** | Still open | `ls src/push-notification/abstract/` still lists `push-notification-abstract.module.ts.ts` (doubled extension); `src/app.module.ts:26` still imports it by that literal name. Re-verified by Task 5. |
| **N2** | Still open | Re-verified by Task 5: still exactly four competing error shapes; `queues`'s two new error classes join the existing POJO-constant shape rather than adding a fifth. |
| **N3** | Still open (for `templating` and `push-notification`) | Re-verified by Task 5: both named modules still ship only `forRoot`, no `forRootAsync`; every module that postdates 2026-09-11 does not repeat the gap. |
| **N4** | Still open, and worse | `find src -name "*.spec.ts" ! -name "*.unit.spec.ts"` returns the original four files unchanged (`src/app.controller.spec.ts`, `src/auth/email/email.controller.spec.ts`, `src/spaceship/spaceship.controller.spec.ts`, `src/spaceship/spaceship.service.spec.ts`) plus a fifth added since 2026-09-11: `src/queues/abstract/tests/queues.module.di.spec.ts`. Not re-verified elsewhere in this audit; first checked here. `DOC6` (Task 6) separately found `src/spaceship/CLAUDE.md`'s own account of this finding incomplete. |
| **N5** | Still open | Re-verified by Task 5: `find src -type d -name mocks` still returns only `src/cache/abstract/mocks`. |
| **N6** | Still open, now tracked as `M1` | Absolute `src/...` imports — this audit re-scoped and re-verified the same defect as `M1` (Task 3): four files, six specifiers, unchanged count from 2026-09-11. |
| **N7** | Still open | `EmailTemplateService` (`src/email/abstract/templates.abstract.ts`) and `TemplateRenderer`/`TEMPLATE_RENDERER` (`src/templates/template-renderer.interface.ts`) both still exist; `grep -rn "EmailTemplateService\|TemplateRenderer\b\|TEMPLATE_RENDERER" src --include='*.ts'` matches only their own definitions, no callers. Not re-verified elsewhere; first checked here. |
| **D1** | ~~Still open~~ **Fixed** (`fix/documentation-remediation`, commit `244afc7`) | Re-verified by Task 7 under `### Human guides (README.md)`: `src/cloud-storage/README.md` still documents a `src/modules/infrastructure/cloud-storage/` tree that does not exist. **Task 12 re-test:** the fictional tree was deleted and the real one documented; `grep -n "src/modules/infrastructure\|IPFSAdapterService" src/cloud-storage/README.md` now returns nothing. |
| **D2** | ~~Still open~~ **Fixed** (`fix/documentation-remediation`, commit `244afc7`) | Re-verified by Task 7: `src/email/README.md` still documents `utils/email-logger.adapter.ts`, `abstract/email-logger.interface.ts` and `src/config/email.config.ts`, none of which exist. **Task 12 re-test:** all three nonexistent paths removed; `grep -n "email-logger.adapter.ts\|email-logger.interface.ts\|src/config/email.config.ts" src/email/README.md` now returns nothing. |
| **D3** | ~~Still open~~ **Fixed** (`fix/documentation-remediation`, commit `244afc7`) | Re-verified by Task 7: `src/config-provider/README.md:25` still names `config-provider-error-codes.ts`; the real file is `abstract/config-provider.error.ts`. **Task 12 re-test:** renamed; `grep -n "config-provider-error-codes.ts" src/config-provider/README.md` now returns nothing. |
| **D4** | ~~Still open, gained a fifth file~~ **Fixed** (`fix/documentation-remediation`, commit `1dc5870`) | Re-verified by Task 7: four READMEs still teach `@nestjs/config`'s `ConfigType<...>`, plus a fifth this task's own grep surfaced, `src/common/observability/logger/README.md:82`. `@nestjs/config` is confirmed still not a dependency. **Task 12 re-test:** all five READMEs rewritten to the real `config-provider` pattern; `grep -rln "ConfigType<" src/cache/README.md src/cloud-storage/README.md src/email/README.md src/push-notification/README.md src/common/observability/logger/README.md` now returns nothing. |
| **D5** | ~~Still open, detailed further~~ **Fixed** (`fix/documentation-remediation`, commits `0f07a8c`, `019e165`) | The `### Root README` subsection (Task 8, finding `DOC10`) re-verified both halves: lines 1-27 and 86-98 of `README.md` remain unmodified `nestjs/nest` boilerplate, and the `npm install`/`pnpm` contradiction is still live — now cited with exact line numbers on both sides plus a same-file self-contradiction (`README.md:40` runs a `pnpm` command four lines below the `npm install` instruction) that `D5` itself did not note. **Task 12 re-test:** the boilerplate (including the false `LICENSE` link) was deleted and every command converted to `pnpm`; `grep -n -i "license" README.md` and `grep -nE '(^|[^p])npm (install|run)|\$ npm' README.md` both return nothing. |
| **C1** | Still open | `.env.example` (30 lines, read in full) still omits `NODE_ENV`, `PORT`, `SELF_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_IGNORE_EXPIRATION`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_SYNCHRONIZE`, `DB_LOGGING`, `EMAIL_ADAPTER`, `RESEND_API_KEY`, `RESEND_EMAIL_FROM`, `AWS_SES_REGION`, `AWS_S3_EXPIRES_IN_SECONDS`, `EXPO_ACCESS_TOKEN` and `GOOGLE_OAUTH_CALLBACK_URL`. Of the original list, only `AWS_REGION` has since been added. |
| **C2** | Still open | `src/auth/config/jwt.scope.ts:12` — `secret: Joi.string().default('Not A Safe Secret')`, unchanged. |
| **C3** | Still open | `grep -n origin src/main.ts` → `:12` `origin: '*'`, unchanged, no environment control. |
| **C4** | Still open | `src/common/middleware/request-exception.filter.ts:10` is still `@Catch(HttpException)` only, and `:27-31` still spreads `exception.getResponse()` straight into the response body. The set of module-specific errors that bypass it unmapped has grown since 2026-09-11: `CacheError`, `EmailError`, `CloudStorageError`, `ConfigProviderError`, and now `QueueProducerError`/`QueueConsumerError` too (`N2`). |
| **C5** | Still open | `src/auth/google/google.service.ts:56,89` — `this.logger.error('Google login: ', e)`, same two call sites, unchanged. |
| **TS1** | Still open | `grep -n '"strict"' tsconfig.json` returns nothing — no `strict` key at all. Re-verified by Task 6 and confirmed again here. |
| **TS2** | Still open | `src/app.scope.ts:11` and `src/email/config/email.scope.ts:23` both still declare `const validate = (raw) => {` with an untyped parameter. |
| **TS3** | Still open | `typescript-eslint` still sits at `package.json:80`, inside the `dependencies` block (`:33`-`:82`), above where `devDependencies` opens at `:83`. |
| **L1** | Fixed | Re-verified by Task 6; confirmed again by this audit's own gate table (`pnpm exec eslint` → 0 errors). |
| **L2** | Fixed | Re-verified by Task 6, same evidence — the invalid `ts/no-explicit-any` disable is gone. |
| **L3** | Partially fixed | Re-verified by Task 6: the tree is Prettier-clean (no more 20-file rewrite on lint), but the `lint` script still runs with `--fix` and CI still calls that script, so future formatting drift is silently auto-corrected in CI rather than failing the build. |
| **R1** | Fixed | `src/spaceship/spaceship.controller.ts` — all five handlers (`createSpaceship`, `getAllSpaceships`, `getSpaceshipById`, `updateSpaceship`, `deleteSpaceship`) now declare an explicit return type and carry at least one `@ApiResponse`. |
| **R2** | Fixed | `src/spaceship/spaceship.repository.ts:72-78` — `findByUuidOrFail` now throws `RequestException(Exceptions.spaceship.notFound(...))`, a real `404`, instead of the service/controller passing a `null` through to a `200`. |
| **R3** | Still open | `src/user/user.module.ts` is still an empty, unimported `@Module({})`. `src/auth/auth.service.ts` is still an empty `@Injectable()` that `AuthModule` still exports (`src/auth/auth.module.ts:18-19`). `src/auth/email/email.controller.ts` is still an empty `@Controller('email')` with zero handlers — it is now registered in `EmailModule`'s `controllers` array, but registering an empty controller does not give it a route. |
| **R4** | Fixed | `src/database/migrations/` now ships a real, CLI-generated migration (`1789754373950-AddAuth0IdToUser.ts`) alongside `.gitkeep` — the template no longer ships zero migration baseline. |
| **G1** | Partially fixed | New unit tests exist since 2026-09-11: `src/auth/auth0/auth0.service.unit.spec.ts` and `src/email/abstract/email-abstract.module.unit.spec.ts`. Still no tests for the jwt strategy, the google service, the auth-token service, the `database` module factory, any concrete email adapter (`aws-ses`/`resend`/`sendgrid`), `push-notification`, `templating`, any `cache` adapter, or `common/middleware`. |
| **G2** | Partially fixed | `grep -n 'pnpm test' bitbucket-pipelines.yml` returns nothing — `pnpm test` still never runs in CI, unchanged. But the finding's own premise is now half-stale: `bitbucket-pipelines.yml:15` already runs `pnpm run docs:check` before `lint`/`build`, and Step 3 of this task adds `pnpm run modularity:check` at `:16` — a third non-test gate sits in the pipeline today, while the test gate this finding named is still off. Turning it on is a scoped decision of its own, not made on this audit branch. |

~~**Tally: 7 fixed (`B1`, `B2`, `L1`, `L2`, `R1`, `R2`, `R4`), 22 still open
(`B3`, `N1`-`N7`, `D1`-`D5`, `C1`-`C5`, `TS1`-`TS3`, `R3`), 3 partially fixed
(`L3`, `G1`, `G2`), 0 superseded**~~ — `N6` is carried forward under a new ID
(`M1`) rather than replaced by a different verdict, so it is recorded as
"still open," not "superseded."

**Updated tally (Task 12, `fix/documentation-remediation`):** `D1`-`D5` are
now fixed (see the rows above), so as of this branch the count is **12
fixed** (`B1`, `B2`, `D1`-`D5`, `L1`, `L2`, `R1`, `R2`, `R4`), **17 still
open** (`B3`, `N1`-`N7`, `C1`-`C5`, `TS1`-`TS3`, `R3`), 3 partially fixed
(`L3`, `G1`, `G2`), 0 superseded. The original tally above is left struck
rather than deleted, per this document's own citation rule.
