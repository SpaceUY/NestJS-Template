# CLAUDE.md Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the NestJS template a two-level `CLAUDE.md` hierarchy — one lean root file carrying the project-wide invariants and a module map, plus one file per module under `src/` carrying only what is local to that module — so the template becomes a repeatable company standard for separation of concerns, reusability and standardization.

**Architecture:** Claude Code always loads the repo-root `CLAUDE.md`; a `CLAUDE.md` in a subdirectory is loaded lazily, only when a file in that subtree is read or edited. Inheritance is therefore *by location*, not by `@`-import. Root holds what is true everywhere (invariants, commands, module map, conventions). A shared reference — `docs/architecture/module-contract.md` — holds the adapter-module contract that every infrastructure module implements, so module files can point at it instead of restating it. Each module `CLAUDE.md` then holds only its own scope, public surface, config, rules, tests, extraction recipe and audited gaps. A validator script keeps every referenced path honest, which is precisely what the existing READMEs failed at.

**Tech Stack:** NestJS 11 · TypeScript 5.9 · TypeORM 1.0 + PostgreSQL · Joi · Jest 29 · pnpm 10.15.1 · Node 24 · Bitbucket Pipelines

**Spec:** This plan is self-contained. The audit that motivates it is reproduced in full under **Audit Findings** below, and Task 2 writes it to `docs/audit/2026-09-11-template-audit.md`. Executors read both sections of this file.

---

## Global Constraints

- Package manager is **pnpm 10.15.1** (`packageManager` field in `package.json`). Never write `npm`/`yarn` into any doc.
- Node **24.15.0** — matches `Dockerfile` and `bitbucket-pipelines.yml`.
- **This plan changes documentation and adds one validator script. It changes no application code.** Every defect found in the audit is *recorded*, not fixed. Fixing them is a separate, follow-up plan.
- Required H2 sections in every `src/**/CLAUDE.md`, spelled exactly: `## Scope`, `## Public surface`, `## Rules`, `## Tests`, `## Reuse`, `## Known gaps`. Optional additional sections: `## Configuration`, `## Internal`, `## Adding an adapter`.
- Every repo path written inside backticks in any `CLAUDE.md` must exist on disk. The validator enforces this.
- Module `CLAUDE.md` files are **never** `@`-imported into the root file — that would eagerly inline all of them and defeat lazy loading.
- Existing `README.md` files under `src/` stay where they are. `CLAUDE.md` is for the agent (rules, contracts, gaps); `README.md` is for the human (tutorials, recipes). Do not merge or delete them.
- Conventional commits, one commit per task, branch `chore/claude-md-hierarchy`. Never commit to `master`.
- Audit finding IDs (`B1`, `N3`, `C2`, …) are stable — cite them verbatim from module docs.

---

## Audit Findings

Audited 2026-09-11 against commit `7839d30` on `master`, with `pnpm install --frozen-lockfile` completed and all three gates executed.

| Gate | Result |
|---|---|
| `pnpm run build` | **FAILS** — 6 TypeScript errors, all in `src/app.module.ts` (finding `B1`) |
| `pnpm run lint` | **FAILS** — 23 errors, 8 warnings (findings `L1`-`L3`) |
| `pnpm test` | **PASSES** — 15 suites, 120 tests |

Two of the three gates the Bitbucket pipeline runs are red on `master` today.

### Blockers

| ID | Finding |
|----|---------|
| **B1** | `src/app.module.ts:72-76` references `emailConfig`, `awsConfig` and `ConfigType` — none of the three is imported. `emailScope` and `EMAIL_ADAPTERS` *are* imported (lines 18-21) but never used. The project does not compile as committed. |
| **B2** | `package.json` declares `"dotenv"` twice — `^16.0.0` at line 37 and `^17.4.2` at line 48. The later key silently wins (lockfile resolves 17.4.2). |
| **B3** | `Dockerfile` runs `apk add dumb-init` on `node:24.15.0`, a Debian-based image with no `apk`; and `pnpm exec prisma generate`, though the project uses TypeORM and has no Prisma dependency. The image cannot build. |

### Structural / naming inconsistency

| ID | Finding |
|----|---------|
| **N1** | `src/push-notification/abstract/push-notification-abstract.module.ts.ts` — doubled `.ts` extension, imported with that name from `src/app.module.ts:24`. |
| **N2** | Four competing error models. (a) POJO constant + plain `Error` subclass with `code`/`message`/`data`: `cache`, `cloud-storage`, `email`, `config-provider`. (b) `RequestException extends HttpException` + a central `Exceptions` registry: `auth`, `common`. (c) `PushNotificationException extends HttpException` + `PUSH_NOTIFICATION_ERRORS`, whose three codes are all `CLOUD_STORAGE_*` copy-paste leftovers (`src/push-notification/abstract/push-notification-error-codes.ts:5`, `:11`, `:16`). (d) `ApiException` (`src/common/exception/api.exception.ts`), a plain `Error` carrying no HTTP status, thrown three times from the cloud-storage default controller (`src/cloud-storage/abstract/cloud-storage.controller.ts:43`, `:58`, `:73`) for validation failures that intend a `400`. Because `RequestExceptionFilter` is `@Catch(HttpException)` and `ApiException` does not extend `HttpException`, all three escape the filter and surface as unhandled `500`s — so (d) is not merely a fourth shape but a live bug. See `C4`. |
| **N3** | Two competing adapter-wiring styles. (a) adapter-as-class bound through `forRoot`/`forRootAsync`: `email`, `cloud-storage`, `common/logger`, `cache`. (b) adapter-as-module bound through a provider token and `register`/`registerAsync`: `push-notification`, `templating`. `TemplateModule` has no `forRootAsync` at all; `PushNotificationAbstractModule` has none either and closes with a literal `// TODO: Add forRootAsync`. |
| **N4** | Test naming is split: 11 files use `*.unit.spec.ts`, 4 use `*.spec.ts` (`src/app.controller.spec.ts`, `src/auth/email/email.controller.spec.ts`, `src/spaceship/spaceship.controller.spec.ts`, `src/spaceship/spaceship.service.spec.ts`). |
| **N5** | Only `cache` ships reusable test doubles (`src/cache/abstract/mocks/`). No other abstract module does, so consumers hand-roll mocks. |
| **N6** | Import style is split. Absolute `src/...` specifiers appear in `src/spaceship/spaceship.module.ts:2`, `src/auth/jwt.strategy.ts:6-7`, `src/auth/google/google.controller.ts:3` and `src/auth/google/google.service.ts:5-6`; everything else is relative. `tsconfig.json` declares no `paths`, so these resolve only through `baseUrl: "./"` — and they break the moment a module is copied into another repo, which is the template's entire purpose. |
| **N7** | Dead duplicate abstractions of `TemplateService.compile`: `src/email/abstract/templates.abstract.ts` (`EmailTemplateService`) and `src/templates/template-renderer.interface.ts` (`TemplateRenderer` + `TEMPLATE_RENDERER` symbol). Neither has a caller. |

### Documentation drift

| ID | Finding |
|----|---------|
| **D1** | `src/cloud-storage/README.md` documents `cloud-storage.module.ts`, `cloud-storage-orchestrator.service.ts`, `cloud-storage.targets.ts`, `cloud-storage.tokens.ts`, `cloud-storage.config.ts`, an IPFS adapter and paths rooted at `src/modules/infrastructure/`. None of these exist. |
| **D2** | `src/email/README.md` documents `utils/email-logger.adapter.ts`, `abstract/email-logger.interface.ts` and `src/config/email.config.ts`. None exist — the real config is `src/email/config/email.scope.ts`. The file that does exist, `src/email/utils/execute-html-email-send.ts`, is undocumented. |
| **D3** | `src/config-provider/README.md` names `config-provider-error-codes.ts`; the real file is `src/config-provider/abstract/config-provider.error.ts`. |
| **D4** | `src/cache/README.md`, `src/email/README.md` and `src/push-notification/README.md` still teach `@nestjs/config` (`registerAs`, `ConfigType<typeof …>`), which the project replaced with config-provider scopes. `@nestjs/config` is not a dependency. |
| **D5** | Root `README.md` is unmodified NestJS boilerplate — no description of the template, and it instructs `npm install` while CI and Docker use pnpm. |

### Configuration and security

| ID | Finding |
|----|---------|
| **C1** | `.env.example` omits most keys the scopes actually read: `NODE_ENV`, `PORT`, `SELF_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_IGNORE_EXPIRATION`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_SYNCHRONIZE`, `DB_LOGGING`, `EMAIL_ADAPTER`, `RESEND_API_KEY`, `RESEND_EMAIL_FROM`, `AWS_SES_REGION`, `AWS_REGION`, `AWS_S3_EXPIRES_IN_SECONDS`, `EXPO_ACCESS_TOKEN`, `GOOGLE_OAUTH_CALLBACK_URL`. |
| **C2** | `src/auth/config/jwt.scope.ts:12` defaults `secret` to the literal `'Not A Safe Secret'`. An app with no `JWT_SECRET` set boots and signs tokens with a public constant. |
| **C3** | `src/main.ts:9-18` hardcodes `origin: '*'` with no environment control. |
| **C4** | `src/common/middleware/request-exception.filter.ts:27-32` spreads `exception.getResponse()` straight into the response body, which can surface internal detail on a 500. It also only `@Catch(HttpException)`, so the whole `CacheError` / `EmailError` / `CloudStorageError` / `ConfigProviderError` family bypasses it and reaches Nest's default handler unmapped. |
| **C5** | `src/auth/google/google.service.ts:56` and `:89` log the raw provider error on the token-verification path (`this.logger.error('Google login: ', e)`), which contradicts `src/common/logger/PRACTICES.md` ("never log sensitive data", "do not log then re-throw"). |

### Type strictness

| ID | Finding |
|----|---------|
| **TS1** | `tsconfig.json` does not set `"strict": true`, and explicitly disables `noImplicitAny`, `strictBindCallApply` and `forceConsistentCasingInFileNames`. This contradicts the SpaceDev standard ("TypeScript strict mode; no `any`"). `any` appears in every abstract module's `useFactory` signature, in `src/auth/google/google.strategy.ts:29` and in `src/email/abstract/templates.abstract.ts:2`. |
| **TS2** | `src/app.scope.ts:11` and `src/email/config/email.scope.ts:23` declare `const validate = (raw) => …` with an untyped parameter — implicitly `any`, permitted only because `noImplicitAny` is off. |
| **TS3** | `typescript-eslint` is listed under `dependencies` rather than `devDependencies` in `package.json`. |

### Lint

| ID | Finding |
|----|---------|
| **L1** | `pnpm run lint` exits 1 with **23 errors**, so the `test-build` step of `bitbucket-pipelines.yml` fails on every pull request today. The cause is flat-config ordering in `eslint.config.mjs`: the custom rules block sets `@typescript-eslint/no-explicit-any` to `'off'`, but `eslint.configs.recommended` and `tseslint.configs.recommended` are spread **after** it, and in flat config the later entry wins — so the rule is on. Sixteen of the errors are `no-explicit-any`; the rest are `no-unused-vars` (`src/auth/google/google.controller.ts:22`, `src/common/exception/exceptions.ts:8`, `src/cloud-storage/abstract/cloud-storage-abstract.module.unit.spec.ts:8`, and four unused Swagger imports in `src/push-notification/abstract/push-notification.controller.ts:9-12`). Either move the rules block after the recommended configs or fix the 23 errors — but decide deliberately, because "no `any`" *is* the SpaceDev standard and the config author's intent to disable it is the part that conflicts with it. |
| **L2** | `src/cache/redis-adapter/utils/logger.ts:25` carries an inline disable for `ts/no-explicit-any`, a rule name that does not exist in this config. ESLint reports it as an error (`Definition for rule 'ts/no-explicit-any' was not found`) and the `any` on the next line is flagged anyway. The correct prefix is `@typescript-eslint/`. |
| **L3** | The `lint` script is `eslint … --fix`, so running the CI lint command **rewrites 20 source files** with Prettier formatting (`prettier/prettier` is an `error` here). The committed tree is not Prettier-clean. CI does not notice because the rewrite happens before the report, but any developer running `pnpm run lint` gets an unrelated 20-file diff. CI should run `eslint` without `--fix`, and the tree should be formatted once. |

### Reference-module quality

| ID | Finding |
|----|---------|
| **R1** | `src/spaceship/spaceship.controller.ts` — no handler declares a return type and none carries `@ApiResponse`. `explicit-function-return-type` is only `warn` in `eslint.config.mjs`. |
| **R2** | `src/spaceship/spaceship.service.ts:30-32` returns `null` for a missing spaceship; the controller passes it straight through, so a miss is a `200` with `data: null` instead of a `404`. |
| **R3** | Dead scaffolding a new project would inherit: `src/user/user.module.ts` is an empty `@Module({})` that nothing imports; `src/auth/auth.service.ts` is an empty `@Injectable()` that `AuthModule` nevertheless exports; `src/auth/email/email.controller.ts` is an empty `@Controller('email')`. |
| **R4** | `src/database/migrations/` holds only `.gitkeep`. The template ships no migration baseline even though `DB_SYNCHRONIZE` exists and the company standard is migrations-only. |

### Testing

| ID | Finding |
|----|---------|
| **G1** | No tests exist for `auth` (jwt strategy, google service, auth-token), the `database` module factory, any `email` adapter, `push-notification`, `templating`, `cache` adapters (mocks exist, adapters untested), or `common/middleware`. |
| **G2** | `bitbucket-pipelines.yml` runs `pnpm run lint` and `pnpm run build` only — **CI never runs `pnpm test`**. `test/app.e2e-spec.ts` is unmodified Nest boilerplate. |

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `scripts/check-claude-docs.mjs` | Validates every `CLAUDE.md`: required sections present, referenced repo paths exist, root module map complete. |
| `docs/audit/2026-09-11-template-audit.md` | The findings above, as the citable source of truth for every `## Known gaps` section. |
| `docs/architecture/module-contract.md` | The adapter-module contract shared by all infrastructure modules — written once, referenced by each module doc. |
| `CLAUDE.md` | Root: identity, commands, invariants, module map, conventions. Always in context. |
| `src/config-provider/CLAUDE.md` | Config scope system — the foundation every other module reads config through. |
| `src/common/CLAUDE.md` | Cross-cutting primitives: exceptions, middleware, decorators, module-validation util. |
| `src/common/logger/CLAUDE.md` | Logger abstraction, adapters, and the logging practices contract. |
| `src/database/CLAUDE.md` | TypeORM wiring, entity conventions, migration rules. |
| `src/auth/CLAUDE.md` | JWT + Google OAuth, token issuance, strategy conventions. |
| `src/cache/CLAUDE.md` | Cache abstraction, extensions, mocks. |
| `src/cloud-storage/CLAUDE.md` | Storage abstraction, S3/local adapters, default controller. |
| `src/email/CLAUDE.md` | Email abstraction and its four adapters. |
| `src/push-notification/CLAUDE.md` | Push abstraction and the Expo adapter. |
| `src/templating/CLAUDE.md` | Template compilation service layer. |
| `src/templates/CLAUDE.md` | Template assets and the typed registry. |
| `src/spaceship/CLAUDE.md` | The reference domain module — the pattern new domain modules copy. |

**Modified:**

| Path | Change |
|---|---|
| `package.json` | Add one script: `"docs:check"`. |
| `bitbucket-pipelines.yml` | Add `pnpm run docs:check` to the `test-build` step. |

Nothing under `src/**/*.ts` is touched by this plan.

---

## Module Doc Template

Every file created in Tasks 5-15 follows this exact skeleton. Required sections are marked; optional ones are included only where they apply.

````markdown
# <Module name> — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded) and
> `docs/architecture/module-contract.md`. Read those first — this file adds
> only what is specific to `src/<module>/`.

## Scope
<What this module owns. Then an explicit "Does not own:" line — the boundary
is the point of the section.>

## Public surface
<Table: Import | From | Purpose. Only what other modules may import.>

## Internal            [optional]
<Paths nothing outside this module may import, and why.>

## Configuration       [optional]
<The scope object, its env keys, and where it is registered.>

## Rules
<Numbered, imperative, module-specific. No restating root invariants.>

## Adding an adapter   [optional — adapter modules only]
<Numbered steps, concrete file names.>

## Tests
<What to mock, which naming convention, what a new test must cover.>

## Reuse
<Exactly what to copy to lift this module into another repo, its peer
dependencies, and what it depends on inside this template.>

## Known gaps
<Audited defects with IDs from docs/audit/2026-09-11-template-audit.md.
An agent reading this must not copy these patterns and must not silently
"fix" them either — they are tracked, not open season.>
````

---

### Task 1: Docs validator

The verification harness for every later task. Build it first so each doc lands green.

> If the team wants zero added tooling, this task can be dropped — later tasks then verify by manual inspection. Everything else in the plan stands unchanged.

**Files:**
- Create: `scripts/check-claude-docs.mjs`
- Modify: `package.json` (scripts block, after `"lint"`)

**Interfaces:**
- Consumes: nothing.
- Produces: `pnpm run docs:check` — exits `0` when all `CLAUDE.md` files pass, exits `1` and prints one `path:reason` line per violation otherwise.

- [ ] **Step 1: Write the validator**

Create `scripts/check-claude-docs.mjs`:

```js
#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage']);

const REQUIRED_SECTIONS = [
  '## Scope',
  '## Public surface',
  '## Rules',
  '## Tests',
  '## Reuse',
  '## Known gaps',
];

// A backticked string is checked only when it names a file (known extension) or
// a directory (trailing slash) — so extensionless module specifiers like
// `src/cache/abstract/cache.service` and prose like `src/...` are ignored.
// A leading `!` inverts the assertion: the path is documented as NOT existing,
// which is how a doc records drift in a neighbouring file without the validator
// treating that citation as its own error.
const PATH_LIKE =
  /^!?(src|docs|scripts|test)\/[\w./-]+(\.(ts|mjs|js|json|md|pug|yml)|\/)$/;

/**
 * Recursively collects every CLAUDE.md path under `dir`, repo-relative.
 * @param {string} dir Absolute directory to walk.
 * @returns {Promise<string[]>} Repo-relative CLAUDE.md paths.
 */
async function collectDocs(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await collectDocs(full)));
    else if (entry.name === 'CLAUDE.md') found.push(relative(ROOT, full));
  }
  return found;
}

/**
 * Extracts repo-path-looking strings from backtick spans, dropping any
 * trailing `:12` or `:12-34` line reference.
 * @param {string} text Markdown source.
 * @returns {string[]} Candidate repo paths.
 */
function referencedPaths(text) {
  return [...text.matchAll(/`([^`\n]+)`/g)]
    .map((m) => m[1].replace(/:\d+(-\d+)?$/, ''))
    .filter((candidate) => PATH_LIKE.test(candidate));
}

/**
 * Runs every rule over every CLAUDE.md and reports violations.
 * @returns {Promise<string[]>} Human-readable violation lines.
 */
async function check() {
  const violations = [];
  const docs = await collectDocs(ROOT);

  for (const doc of docs) {
    const text = await readFile(join(ROOT, doc), 'utf8');

    if (doc !== 'CLAUDE.md') {
      for (const section of REQUIRED_SECTIONS) {
        if (!text.includes(`\n${section}\n`)) {
          violations.push(`${doc}: missing required section "${section}"`);
        }
      }
    }

    for (const reference of referencedPaths(text)) {
      const mustBeAbsent = reference.startsWith('!');
      const path = mustBeAbsent ? reference.slice(1) : reference;
      const present = existsSync(join(ROOT, path));

      if (!mustBeAbsent && !present) {
        violations.push(`${doc}: references missing path "${path}"`);
      }
      if (mustBeAbsent && present) {
        violations.push(
          `${doc}: "${path}" is documented as absent but now exists`,
        );
      }
    }
  }

  const rootText = await readFile(join(ROOT, 'CLAUDE.md'), 'utf8');
  for (const doc of docs.filter((d) => d !== 'CLAUDE.md')) {
    if (!rootText.includes(doc)) {
      violations.push(`CLAUDE.md: module map does not list "${doc}"`);
    }
  }

  return violations;
}

const violations = await check();
if (violations.length > 0) {
  console.error(`docs:check failed with ${violations.length} violation(s):`);
  for (const line of violations) console.error(`  ${line}`);
  process.exit(1);
}
console.log('docs:check passed');
```

- [ ] **Step 2: Register the script**

In `package.json`, directly after the `"lint"` entry, add:

```json
    "docs:check": "node scripts/check-claude-docs.mjs",
```

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm run docs:check`

Expected: FAIL — no root `CLAUDE.md` exists yet, so the final `readFile(join(ROOT, 'CLAUDE.md'))` throws `ENOENT`. That is the correct red state; Task 3 turns it green.

- [ ] **Step 4: Commit**

```bash
git checkout -b chore/claude-md-hierarchy
git add scripts/check-claude-docs.mjs package.json
git commit -m "chore: add CLAUDE.md documentation validator"
```

---

### Task 2: Audit findings document

**Files:**
- Create: `docs/audit/2026-09-11-template-audit.md`

**Interfaces:**
- Consumes: nothing.
- Produces: stable finding IDs `B1-B3`, `N1-N7`, `D1-D5`, `C1-C5`, `T1-T3`, `R1-R4`, `G1-G2`, cited by every `## Known gaps` section in Tasks 5-15.

- [ ] **Step 1: Write the document**

Copy the **Audit Findings** section of this plan (from the `### Blockers` heading through the `G2` row) verbatim into `docs/audit/2026-09-11-template-audit.md`, under this header:

```markdown
# NestJS Template — Audit, 2026-09-11

Audited against commit `7839d30` on `master`.

`node_modules` was not installed in the audited checkout, so `pnpm lint`,
`pnpm test` and `pnpm build` were not executed. Every finding below comes from
static reading of the source, `package.json` and `pnpm-lock.yaml`. Re-run the
three commands before closing any finding.

Finding IDs are stable and are cited from the `## Known gaps` section of each
module's `CLAUDE.md`. When a finding is fixed, strike it here rather than
deleting it, so the citations stay resolvable.
```

- [ ] **Step 2: Verify every path the audit cites actually exists**

Findings `D1` and `D2` deliberately name paths that do *not* exist — that is the
finding. Everything else must resolve:

```bash
grep -oE '`(src|docs|scripts|test)/[^`]+`' docs/audit/2026-09-11-template-audit.md \
  | tr -d '`' | sed -E 's/:[0-9]+(-[0-9]+)?$//' | sort -u \
  | grep -vE '^src/(config/email\.config\.ts|modules/infrastructure/)$' \
  | while read -r p; do test -e "$p" || echo "MISSING: $p"; done
```

Expected: no output. Any `MISSING:` line means a typo in the copied table — fix it before committing.

- [ ] **Step 3: Commit**

```bash
git add docs/audit/2026-09-11-template-audit.md
git commit -m "docs: record 2026-09-11 template audit findings"
```

---

### Task 3: Root CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

**Interfaces:**
- Consumes: `docs/audit/2026-09-11-template-audit.md` (Task 2).
- Produces: the eight invariants `T1`-`T8`, cited by name from every module doc; and the module map the validator checks for completeness.

- [ ] **Step 1: Write the root file**

Create `CLAUDE.md`:

````markdown
# SpaceDev NestJS Template

A reusable NestJS backend template. Every top-level directory under `src/` is a
module built to be lifted into another repository on its own. That portability
is a hard requirement, not an aspiration — it is the reason this template
exists, and it is what the invariants below protect.

## How this file relates to the module files

This file is always in context. A `CLAUDE.md` inside a module directory loads
lazily — only when you read or edit a file in that subtree. So: what is true
everywhere lives here; what is true of one module lives in that module's file.
Module files are never `@`-imported here, because that would inline all of them
into every session and defeat the lazy loading.

Before changing anything under `src/<module>/`, read `src/<module>/CLAUDE.md`.

## Module map

| Directory | Agent guide | Human guide |
|---|---|---|
| `src/config-provider` | `src/config-provider/CLAUDE.md` | `src/config-provider/README.md` |
| `src/common` | `src/common/CLAUDE.md` | `src/common/README.md` |
| `src/common/logger` | `src/common/logger/CLAUDE.md` | `src/common/logger/README.md` |
| `src/database` | `src/database/CLAUDE.md` | — |
| `src/auth` | `src/auth/CLAUDE.md` | — |
| `src/cache` | `src/cache/CLAUDE.md` | `src/cache/README.md` |
| `src/cloud-storage` | `src/cloud-storage/CLAUDE.md` | `src/cloud-storage/README.md` |
| `src/email` | `src/email/CLAUDE.md` | `src/email/README.md` |
| `src/push-notification` | `src/push-notification/CLAUDE.md` | `src/push-notification/README.md` |
| `src/templating` | `src/templating/CLAUDE.md` | `src/templating/README.md` |
| `src/templates` | `src/templates/CLAUDE.md` | `src/templates/README.md` |
| `src/spaceship` | `src/spaceship/CLAUDE.md` | — |

`src/user` holds only `src/user/current-user.decorator.ts`; see finding `R3`.

Shared references: `docs/architecture/module-contract.md` (the adapter-module
contract), `docs/audit/2026-09-11-template-audit.md` (known defects),
`src/common/logger/PRACTICES.md` (logging rules).

## Commands

```bash
pnpm install                  # pnpm 10.15.1, Node 24.15.0 — never npm or yarn
pnpm run start:dev            # watch mode
pnpm run build                # nest build
pnpm test                     # jest, rootDir src, testRegex .*\.spec\.ts$
pnpm run test:e2e             # jest --config ./test/jest-e2e.json
pnpm run lint                 # eslint --fix
pnpm run docs:check           # validates every CLAUDE.md
pnpm run db:migration:generate -- src/database/migrations/<Name>
pnpm run db:migration:run
pnpm run db:migration:revert
```

A local Postgres is available through `docker-compose.yml`.

## Invariants

These hold in every module. Module files cite them by ID rather than restating
them.

**T1 — Consumers depend on abstractions, never on adapters.** Inject the
abstract class (`EmailService`, `CacheService`, `LoggerService`,
`CloudStorageService`, `TemplateService`, `PushNotificationService`,
`ConfigProviderService`). A concrete adapter class is named in exactly one
place: the `forRoot`/`forRootAsync`/`register` call in `src/app.module.ts`.
Importing `S3AdapterService` or `ResendAdapterService` from a feature module is
always wrong.

**T2 — All configuration flows through a config scope.** Never read
`process.env` outside `src/config-provider/env-adapter/env-config.adapter.ts`
and `src/database/data-source.ts` (the TypeORM CLI entry point, which runs
outside the Nest container). Define a scope with `defineConfigScope`, validate
it with Joi, register it in `src/app.module.ts`, inject it with
`@Inject(xScope.KEY)`. See `src/config-provider/CLAUDE.md`.

**T3 — Every module owns its error type.** An adapter catches the provider SDK's
error and rethrows the module's own error class, so no caller ever depends on
`ioredis`, `@aws-sdk/*` or `resend` internals. The template currently has four
competing error shapes — finding `N2`; the POJO-constant + `Error`-subclass form
used by `src/cache/abstract/cache.error.ts` is the one to follow for new work.

**T4 — No secrets in code, no secrets in logs.** Secrets come from a config
scope backed by `env` or `sm`. Never log a token, key, password, or raw provider
error. See `src/common/logger/PRACTICES.md`.

**T5 — Imports inside a module are relative.** `../abstract/cache.service` —
never `src/cache/abstract/cache.service`. A module that reaches for an absolute
`src/...` specifier stops working the moment it is copied into another repo.
Four files still violate this (finding `N6`); do not add a fifth.

**T6 — Named exports, explicit return types, no `any`.** No default exports.
Every function and method declares its return type.
`@typescript-eslint/no-explicit-any` is enforced, and already failing on 16
pre-existing sites (finding `L1`) — do not add a seventeenth.

**T7 — Every module carries its own `CLAUDE.md`.** A new top-level directory
under `src/` is not done until it has one, built from the skeleton in
`docs/architecture/module-contract.md` and listed in the module map above.
`pnpm run docs:check` enforces the listing.

**T8 — Schema changes are migrations, generated by the CLI.** Never hand-write a
migration file, never rely on `DB_SYNCHRONIZE` outside local development. See
`src/database/CLAUDE.md`.

## Conventions

- **Files:** `kebab-case.ts`, suffixed by role — `*.service.ts`, `*.controller.ts`,
  `*.module.ts`, `*.scope.ts`, `*.error.ts`, `*.interfaces.ts`, `*.entity.ts`,
  `*.dto.ts`, `*.const.ts`.
- **Layout of an infrastructure module:** `abstract/` holds the contract, the
  dynamic module, the error type and shared interfaces; `<provider>-adapter/`
  holds one implementation each; `config/` holds that module's scope.
- **Layering:** Controller → Service → Repository. Controllers orchestrate and
  never log (`src/common/logger/PRACTICES.md`); business logic lives in services.
- **DTOs:** `class-validator` decorators plus `@ApiProperty`. The global
  `ValidationPipe` in `src/main.ts` runs with `transform` and
  `forbidNonWhitelisted`.
- **Entities:** extend `src/database/entities/base.entity.ts`. `id` (integer) is
  internal; `uuid` is the only identifier an API response may expose.
- **Tests:** co-located, `*.unit.spec.ts` for isolated unit tests. The four
  `*.spec.ts` files are legacy (finding `N4`); new tests use `*.unit.spec.ts`.
- **Git:** branches `feature/` `fix/` `chore/` `hotfix/`; conventional commits;
  PRs only, never a direct push to `master`.

## Before you finish

1. `pnpm run lint`
2. `pnpm test`
3. `pnpm run build`
4. `pnpm run docs:check` if you touched any `CLAUDE.md`
5. Confirm the diff is minimal and touches no module you were not asked to change.

## Known template-wide gaps

Recorded in `docs/audit/2026-09-11-template-audit.md`. The ones that will bite
you first:

**`pnpm run build` and `pnpm run lint` both fail on `master` right now.** That is
the baseline — it is not something you broke.

- **`B1`** — `src/app.module.ts` does not compile: `emailConfig`, `awsConfig` and
  `ConfigType` are referenced but never imported. Six TypeScript errors.
- **`L1`** — `pnpm run lint` exits 1 with 23 errors, so the pipeline is red on
  every PR. `eslint.config.mjs` spreads the recommended configs *after* its own
  rules block, which silently re-enables `@typescript-eslint/no-explicit-any`.
- **`L3`** — the `lint` script runs with `--fix`, so invoking it rewrites 20
  files with Prettier formatting. **Check `git status` after linting** and do not
  commit that reformat alongside unrelated work.
- **`B2`** — `package.json` declares `dotenv` twice.
- **`B3`** — `Dockerfile` uses `apk` on a Debian image and runs `prisma generate`
  in a TypeORM project.
- **`G2`** — CI runs lint and build only; `pnpm test` never runs in the pipeline,
  even though all 120 tests pass.
- **`TS1`** — `tsconfig.json` is not in strict mode, contrary to the SpaceDev
  standard.

Do not fix these opportunistically as part of unrelated work. They are tracked;
raise them, scope them, fix them deliberately.
````

- [ ] **Step 2: Verify**

Run: `pnpm run docs:check`

Expected: FAIL with exactly **thirteen** `CLAUDE.md: references missing path …`
lines — the twelve module docs named in the module map that Tasks 5-15 still have
to write, plus `docs/architecture/module-contract.md`, which Task 4 clears. Each
later task removes one.

There will be **no** `module map does not list` lines: that check iterates over
the module docs that exist on disk, and none do yet.

Any `references missing path` line naming something *other* than those thirteen
is a real typo in the file just written; fix it now.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add root CLAUDE.md with template invariants and module map"
```

---

### Task 4: Adapter-module contract reference

**Files:**
- Create: `docs/architecture/module-contract.md`

**Interfaces:**
- Consumes: root invariants `T1`-`T8` (Task 3).
- Produces: the canonical adapter-module contract and the module-doc skeleton, referenced by the `>` blockquote header of every file in Tasks 5-15.

- [ ] **Step 1: Write the contract**

Create `docs/architecture/module-contract.md`:

````markdown
# Adapter module contract

Every infrastructure module in this template — `cache`, `cloud-storage`,
`email`, `push-notification`, `templating`, `config-provider`,
`common/logger` — implements the same shape. This document defines it once so
module `CLAUDE.md` files do not restate it.

## The shape

```text
src/<module>/
├── abstract/
│   ├── <module>.service.ts          abstract class — the DI token and contract
│   ├── <module>.interfaces.ts       shared types
│   ├── <module>.error.ts            error-code constant + Error subclass
│   ├── <module>-abstract.module.ts  dynamic module: forRoot / forRootAsync
│   └── mocks/                       reusable jest doubles
├── <provider>-adapter/
│   ├── <provider>-adapter-config.interface.ts
│   └── <provider>-adapter.service.ts   extends the abstract service
├── config/
│   └── <module>.scope.ts            config scope, if the module needs config
├── CLAUDE.md
└── README.md
```

## The five rules

1. **The abstract class is the injection token.** NestJS resolves by class
   reference, so `providers: [{ provide: CacheService, useClass: adapter }]`
   makes `constructor(private readonly cache: CacheService)` work in any
   consumer. No string token is needed for the main contract.
2. **An adapter is a plain class extending the abstract service.** It takes its
   configuration through its constructor and knows nothing about NestJS
   modules. This is what makes it unit-testable with `new AdapterService(cfg)`
   and no testing module.
3. **The abstract module exposes `forRoot` and `forRootAsync`.** `forRoot`
   binds an adapter class (`useClass`) for adapters with no runtime config;
   `forRootAsync` takes `{ imports?, inject?, useFactory, isGlobal? }` and is
   the path for anything config-dependent. Both accept `isGlobal`.
   `forRootAsync` is the default choice.
4. **Adapters translate errors.** Catch the provider SDK error, throw the
   module's own error class carrying a code from the module's constant map.
   `src/cache/redis-adapter/redis-adapter.service.ts` is the reference.
5. **The module ships mocks.** `abstract/mocks/` exports a jest-backed double
   per abstract class so consumers test against the contract rather than
   hand-rolling a stub. `src/cache/abstract/mocks/cache.service.mock.ts` is the
   reference; it is currently the only one (finding `N5`).

## The two registration styles

The template contains both. New modules use style A.

**Style A — adapter as class** (`email`, `cloud-storage`, `common/logger`,
`cache`). The abstract module binds the adapter class or a factory directly:

```ts
EmailAbstractModule.forRootAsync({
  isGlobal: true,
  inject: [emailScope.KEY],
  useFactory: (email: EmailScopeConfig) =>
    new ResendAdapterService({ resendApiKey: email.resendApiKey, emailFrom: email.from }),
});
```

**Style B — adapter as module** (`push-notification`, `templating`). The adapter
ships its own `register`/`registerAsync` dynamic module that binds a provider
token; the abstract module imports it and aliases the token to the abstract
class. It exists because those adapters were written before style A settled.
It costs an extra indirection and neither of the two modules using it has a
working `forRootAsync` (finding `N3`). Do not add new modules in this style.

## Writing a module CLAUDE.md

Use this skeleton. Required sections — `## Scope`, `## Public surface`,
`## Rules`, `## Tests`, `## Reuse`, `## Known gaps` — are enforced by
`scripts/check-claude-docs.mjs`.

```markdown
# <Module name> — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded) and
> `docs/architecture/module-contract.md`. Read those first — this file adds
> only what is specific to `src/<module>/`.

## Scope
## Public surface
## Internal            [optional]
## Configuration       [optional]
## Rules
## Adding an adapter   [optional — adapter modules only]
## Tests
## Reuse
## Known gaps
```

Three habits keep these files useful:

- **Write the boundary, not the tutorial.** `## Scope` must contain an explicit
  "Does not own:" line. The recipes belong in `README.md`.
- **Cite, don't restate.** Root invariants are `T1`-`T8`; defects are the IDs in
  `docs/audit/2026-09-11-template-audit.md`. Repeating their text means two
  copies to keep in sync, and the READMEs already show how that ends (`D1`-`D5`).
- **Mark deliberately-absent paths with `!`.** `scripts/check-claude-docs.mjs`
  asserts that every backticked file or directory path exists. When a doc has to
  name a path that does *not* exist — a file a stale README invented, a scope a
  project would add later — write it as `` `!src/thing.ts` ``. The validator then
  asserts the opposite, so the note also fails the day someone creates the file
  and forgets to update the doc.
````

- [ ] **Step 2: Verify**

Run: `pnpm run docs:check`

Expected: FAIL with exactly **twelve** `references missing path` lines — the
module docs still to be written. The `docs/architecture/module-contract.md` line
from Task 3 is now gone. The validator scans `CLAUDE.md` files alone, so this
document itself is checked only through the references other docs make to it.

Also confirm the paths this document names are real:

```bash
for p in src/cache/abstract/mocks/cache.service.mock.ts \
         src/cache/redis-adapter/redis-adapter.service.ts \
         scripts/check-claude-docs.mjs; do test -e "$p" || echo "MISSING: $p"; done
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/module-contract.md
git commit -m "docs: add shared adapter module contract reference"
```

---

### Task 5: config-provider module guide

The foundation — every other module reads configuration through it, so it is documented first.

**Files:**
- Create: `src/config-provider/CLAUDE.md`

**Interfaces:**
- Consumes: `docs/architecture/module-contract.md` (Task 4), invariant `T2` (Task 3).
- Produces: the scope-authoring rules that Tasks 8-13 reference as "see `src/config-provider/CLAUDE.md`".

- [ ] **Step 1: Write the file**

Create `src/config-provider/CLAUDE.md`:

````markdown
# Config provider — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded) and
> `docs/architecture/module-contract.md`. Read those first — this file adds
> only what is specific to `src/config-provider/`.

## Scope

Owns configuration resolution for the whole application: source adapters that
fetch a raw string by key, the dynamic module that wires them to named source
slots, and the `defineConfigScope` utility that declares a typed, validated
group of keys.

Does not own: the scopes themselves. A scope lives next to the module that
consumes it (`src/auth/config/jwt.scope.ts`, `src/database/config/database.scope.ts`,
`src/email/config/email.scope.ts`, `src/cloud-storage/s3-adapter/config/s3.scope.ts`,
`src/push-notification/expo-adapter/config/expo.scope.ts`), except `src/app.scope.ts`
which is application-level.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `defineConfigScope` | `src/config-provider/abstract/define-config-scope.util.ts` | Declare a typed scope |
| `configSources` (aliased `from`) | `src/config-provider/abstract/config-source.util.ts` | `from.env(key)`, `from.sm(key)`, `from.from(name)(key)` |
| `ConfigProviderAbstractModule` | `src/config-provider/abstract/config-provider-abstract.module.ts` | `forRoot` / `forRootAsync`, registered once in `src/app.module.ts` |
| `ConfigProviderService` | `src/config-provider/abstract/config-provider.service.ts` | Source adapter contract — extend to add a source |
| `ReloadableConfigProviderService` | `src/config-provider/abstract/reloadable-config-provider.service.ts` | Extend when a source supports `reload()` |
| `reloadableSourceToken` | `src/config-provider/abstract/config-provider-tokens.ts` | Inject a source's reload handle |
| `ConfigProviderError`, `CONFIG_PROVIDER_ERRORS` | `src/config-provider/abstract/config-provider.error.ts` | Error type and codes |
| `EnvConfigAdapter` | `src/config-provider/env-adapter/env-config.adapter.ts` | Named only in `src/app.module.ts` |
| `SecretsManagerConfigAdapter` | `src/config-provider/secrets-manager-adapter/secrets-manager-config.adapter.ts` | Named only in `src/app.module.ts` |

## Configuration

Registered once, globally, in `src/app.module.ts`. Sources are named slots;
`env` and `sm` are the two conventional names, and `from.env` / `from.sm` are
shorthand for them. `scopes` lists every scope in the application — a scope that
is not listed there is never resolved and its `KEY` will not inject.

## Rules

1. A scope is `defineConfigScope<T>(name, fields, validate, options?)`. Always
   pass a `validate` callback — a scope without one injects raw
   `string | undefined` values and every consumer then has to coerce.
2. Validation is Joi, and it does the coercion: `Joi.number()` for ports,
   `Joi.boolean()` for flags, `Joi.string().valid(...)` for enums. The raw values
   arriving from any source are strings.
3. Type the `validate` parameter — `(raw: Record<string, unknown>)`. Two existing
   scopes leave it implicit (finding `TS2`); do not copy them.
4. `scope.KEY` is a plain string token (`CONFIG_SCOPE_<NAME>`). Inject with
   `@Inject(xScope.KEY) private readonly conf: XScopeConfig`. Always annotate the
   property with the scope's exported config type.
5. Put a secret behind `from.sm(...)` and a non-secret behind `from.env(...)`.
   One scope may mix both; the module resolves each field independently.
6. Never default a secret to a usable literal. `src/auth/config/jwt.scope.ts:12`
   does exactly that (finding `C2`) — it is the anti-pattern, not the pattern.
7. `{ live: true }` opts a scope into hot reload via a `Proxy`. Reserve it for
   values that genuinely change at runtime (feature flags, rate limits, rotating
   credentials). Application config must stay static.
8. Every key a scope reads must appear in `.env.example`. Most currently do not
   (finding `C1`) — add yours.
9. Misconfiguration must fail at startup, not at first use. Unknown source names
   and duplicate scope keys already throw during module construction; keep new
   checks in the same place.

## Adding a source adapter

1. Create `src/config-provider/<name>-adapter/<name>-config.adapter.ts` extending
   `ConfigProviderService` (or `ReloadableConfigProviderService` if it can
   refresh), implementing `get` and `getOrThrow`.
2. Add its options interface as `<name>-config.interfaces.ts` alongside.
3. Throw `ConfigProviderError` with a code from `CONFIG_PROVIDER_ERRORS` on
   fetch failure — never leak the SDK's error.
4. Register it as a named source in the `sources` map in `src/app.module.ts`.
5. Reference it from scopes with `from.from('<name>')('KEY')`.
6. Add `src/config-provider/<name>-adapter/<name>-config.adapter.unit.spec.ts`.

## Tests

`src/config-provider/abstract/config-provider-abstract.module.unit.spec.ts`,
`src/config-provider/env-adapter/env-config.adapter.unit.spec.ts` and
`src/config-provider/secrets-manager-adapter/secrets-manager-config.adapter.unit.spec.ts`
are the reference. A source adapter is a plain class — test it with `new`, not a
testing module. Mock `@aws-sdk/client-secrets-manager` at module level with
`jest.mock`. A new scope needs a test proving the validator rejects bad input and
coerces good input.

## Reuse

Copy `src/config-provider/` whole. It depends only on `@nestjs/common` and, for
the Secrets Manager source, `@aws-sdk/client-secrets-manager`; the env source
needs `dotenv`. Joi is a dependency of the *scopes*, not of this module — a
consuming project may validate with Zod or anything else.

Nothing inside `src/config-provider/` imports from another module of this
template, which is what makes it the first thing to lift.

## Known gaps

See `docs/audit/2026-09-11-template-audit.md`.

- **`D3`** — `src/config-provider/README.md` names a `config-provider-error-codes.ts`
  that does not exist; the real file is `abstract/config-provider.error.ts`.
- **`C1`** — `.env.example` is missing most keys the scopes read.
- **`C2`** — `jwtScope` defaults its secret to a public literal.
- **`TS2`** — `src/app.scope.ts` and `src/email/config/email.scope.ts` take an
  untyped `raw`.
````

- [ ] **Step 2: Verify**

Run: `pnpm run docs:check`

Expected: **eleven** `references missing path` lines — the
`src/config-provider/CLAUDE.md` one is gone. No `missing required section` line
anywhere, and no violation naming `src/config-provider/CLAUDE.md`: the file now
exists, carries all six required sections, and every path it cites resolves.

- [ ] **Step 3: Commit**

```bash
git add src/config-provider/CLAUDE.md
git commit -m "docs(config-provider): add module guide"
```

---

### Task 6: common module guide

**Files:**
- Create: `src/common/CLAUDE.md`

**Interfaces:**
- Consumes: Task 4 contract, invariant `T3`.
- Produces: the error-model ruling that Tasks 9-13 cite.

- [ ] **Step 1: Write the file**

Create `src/common/CLAUDE.md`:

````markdown
# Common — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded) and
> `docs/architecture/module-contract.md`. Read those first — this file adds
> only what is specific to `src/common/`.

## Scope

Cross-cutting primitives with no domain of their own: the HTTP exception
vocabulary, the global response interceptor and exception filter, shared
decorators, and the dynamic-module validation helper. `src/common/logger/` is a
full module in its own right and has its own guide.

Does not own: anything business-specific, and anything a single module could own
instead. A helper used by exactly one module belongs in that module.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `RequestException`, `ExceptionInfo` | `src/common/exception/core/ExceptionBase.ts` | HTTP exception carrying an `errorCode` |
| `Exceptions` | `src/common/exception/exceptions.ts` | Central registry of `ExceptionInfo` values |
| `ERROR_CODES`, `ErrorCode` | `src/common/enums.ts` | Generic error-code constants |
| `MiddlewareModule` | `src/common/middleware/middleware.module.ts` | Registers the global interceptor and filter; imported by `src/app.module.ts` |
| `validateAdapterModule`, `AdapterModuleLike` | `src/common/utils/nest-module-validation.ts` | Fail-fast guard for `forRoot` adapter arguments |
| `Html` | `src/common/decorators/html-content-type.ts` | Sets `Content-Type: text/html` on a handler |

## Internal

`src/common/exception/api.exception.ts` (`ApiException`) is a plain `Error` and
carries no HTTP status. Its only callers are three throws in the cloud-storage
default controller (`src/cloud-storage/abstract/cloud-storage.controller.ts:43`,
`:58`, `:73`), and since `RequestExceptionFilter` catches only `HttpException`,
every one of them escapes the filter and becomes an unhandled `500` where a `400`
was intended (findings `N2`, `C4`). Do not import it and do not add callers —
throw `RequestException` instead.

## Rules

1. **Two error layers, and they do not mix.** A *module* error
   (`CacheError`, `EmailError`, `CloudStorageError`, `ConfigProviderError`) is a
   plain `Error` subclass with `code`, `message` and optional `data` — it carries
   no HTTP semantics, because the module has no idea it is behind HTTP. An
   *HTTP* error is `RequestException`, constructed from an `ExceptionInfo` in the
   `Exceptions` registry, and only application and domain code throws it.
2. Adding an HTTP error means adding an entry to `Exceptions` — a static object
   for a fixed message, or a function of parameters for a dynamic one (see
   `Exceptions.database.alreadyExists`). Do not construct `HttpException`
   directly and do not invent a parallel registry.
3. The global `ResponseInterceptor` wraps every successful response as
   `{ success: true, data }`, except when the handler already returned a `data`
   key or the response is `text/html`. Handlers return plain values and must not
   wrap themselves.
4. `RequestExceptionFilter` only catches `HttpException`. Module errors reaching
   the controller layer are currently unmapped (finding `C4`) — catch them in the
   service and rethrow a `RequestException`.
5. A response body must never carry internal detail — no stack, no provider
   message, no SQL. Finding `C4` records where the filter is loose about this.
6. `validateAdapterModule(adapter, 'XModule.forRoot')` goes at the top of any
   `forRoot` that accepts an adapter *module*. Style-A modules that accept an
   adapter *class* do not need it.
7. Nothing in `src/common/` may import from a feature module. The dependency
   arrow points one way.

## Tests

Nothing under `src/common/` outside `logger/` has a test (finding `G1`). New
work here ships `*.unit.spec.ts` alongside. `validateAdapterModule` is a pure
function — test the four accepted shapes and the throwing case directly.
`ResponseInterceptor` and `RequestExceptionFilter` are tested by constructing a
fake `ArgumentsHost` / `ExecutionContext`, not by booting the app.

## Reuse

`src/common/exception/`, `src/common/utils/` and `src/common/decorators/` are
self-contained — copy the files you need, they depend only on `@nestjs/common`
and, for the interceptor, `rxjs` and `express` types.

`src/common/middleware/` is opinionated about response shape. Copy it only if the
target project wants the `{ success, data }` envelope; otherwise take the filter
and leave the interceptor.

## Known gaps

See `docs/audit/2026-09-11-template-audit.md`.

- **`N2`** — four competing error models across the template, and `ApiException`'s
  three callers in the cloud-storage default controller escape the global filter
  as `500`s.
- **`C4`** — the filter spreads `exception.getResponse()` into the body and
  catches only `HttpException`.
- **`G1`** — no tests for the middleware, the utils or the decorators.
````

- [ ] **Step 2: Verify**

Run: `pnpm run docs:check`

Expected: ten missing-path lines remain; nothing referencing `src/common/CLAUDE.md`.

- [ ] **Step 3: Commit**

```bash
git add src/common/CLAUDE.md
git commit -m "docs(common): add module guide"
```

---

### Task 7: logger module guide

**Files:**
- Create: `src/common/logger/CLAUDE.md`

**Interfaces:**
- Consumes: Task 6 (`src/common/CLAUDE.md`), `src/common/logger/PRACTICES.md`.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Write the file**

Create `src/common/logger/CLAUDE.md`:

````markdown
# Logger — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded),
> `docs/architecture/module-contract.md` and `src/common/CLAUDE.md`. Read those
> first — this file adds only what is specific to `src/common/logger/`.

**`src/common/logger/PRACTICES.md` is binding.** It defines how to write a log
line: structured `LogInput` only, past-tense event names, level by signal,
controllers stay log-free, never log then rethrow, never log a secret. Read it
before adding any log statement anywhere in the codebase.

## Scope

Owns the logging abstraction and its adapters. Consumers depend on the abstract
`LoggerService` and never on a logging library.

Does not own: request/response access logging, which
`src/common/middleware/response.interceptor.ts` does.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `LoggerService` | `src/common/logger/abstract/logger.service.ts` | The contract and the DI token — inject this |
| `LogInput`, `LogTelemetryHook` | `src/common/logger/abstract/logger.interfaces.ts` | Log payload shape; telemetry hook signature |
| `LoggerAbstractModule` | `src/common/logger/abstract/logger-abstract.module.ts` | `forRoot` / `forRootAsync` |
| `NestLoggerAdapter` | `src/common/logger/nest-adapter/nest-logger.adapter.ts` | Default adapter; named in `src/app.module.ts` and in self-defaulting services |
| `PinoLoggerAdapter` | `src/common/logger/pino-adapter/pino-logger.adapter.ts` | Peer dep `pino`; named only in `src/app.module.ts` |
| `WinstonLoggerAdapter` | `src/common/logger/winston-adapter/winston-logger.adapter.ts` | Peer dep `winston`; named only in `src/app.module.ts` |

## Rules

1. Inject `LoggerService`. Call `this.logger.setContext(MyService.name)` in the
   constructor — every line then carries the class name.
2. `log(input)` takes a `LogInput` object, never a string. Interpolating values
   into `message` destroys machine-parseability; put them in `data`.
3. `data` carries counts, IDs and flags. Never whole arrays, whole entities,
   tokens, keys or PII.
4. A **reusable** service (an adapter shipped as part of a module) takes
   `logger?: LoggerService` as its last constructor parameter and falls back to
   `new NestLoggerAdapter(...)` when it is absent. That keeps the module usable
   without `LoggerAbstractModule` registered — `ResendAdapterService` is the
   reference. An **application** service simply injects `LoggerService`.
5. `telemetryHook` on `forRoot`/`forRootAsync` is the single integration point
   for OpenTelemetry or Datadog. A throwing hook must never break the caller;
   `LoggerService.emitTelemetry` already guarantees that.
6. `Logger` from `@nestjs/common` is still used directly in
   `src/common/middleware/`, `src/auth/google/google.module.ts` and
   `src/auth/google/google.service.ts`. That is legacy — new code injects
   `LoggerService`.

## Adding an adapter

1. Create `src/common/logger/<name>-adapter/<name>-logger.adapter.ts` extending
   `LoggerService`.
2. Implement `setContext`, `log`, `warn`, `error`, `debug`.
3. End each level method with `this.emitTelemetry(level, input, context)` so the
   hook fires without the adapter knowing anything about telemetry.
4. Declare the logging library as a peer dependency; do not add it to
   `dependencies`.
5. Add `<name>-logger.adapter.unit.spec.ts` alongside.

## Tests

This is the best-tested module in the template — five `*.unit.spec.ts` files
covering the abstract module, the serializer and all three adapters. Follow
`src/common/logger/nest-adapter/nest-logger.adapter.unit.spec.ts`: construct the
adapter directly, spy on the underlying library, assert the emitted shape.
`src/common/logger/abstract/serialize-error.unit.spec.ts` covers circular
references and must keep passing.

## Reuse

Copy `src/common/logger/` whole, minus the adapter directories you do not want.
`abstract/` and `nest-adapter/` need only `@nestjs/common`. `pino-adapter/` needs
`pino` (and `pino-pretty` for the dev preset); `winston-adapter/` needs
`winston`. Take `PRACTICES.md` with it — the practices are the valuable half.

## Known gaps

See `docs/audit/2026-09-11-template-audit.md`.

- **`C5`** — `src/auth/google/google.service.ts` logs the raw provider error on
  the token path, against this module's own practices.
- Direct `@nestjs/common` `Logger` use persists in middleware and the Google
  auth module.
````

- [ ] **Step 2: Verify**

Run: `pnpm run docs:check`

Expected: nine missing-path lines remain; nothing referencing `src/common/logger/CLAUDE.md`.

- [ ] **Step 3: Commit**

```bash
git add src/common/logger/CLAUDE.md
git commit -m "docs(logger): add module guide"
```

---

### Task 8: database module guide

**Files:**
- Create: `src/database/CLAUDE.md`

**Interfaces:**
- Consumes: Task 5 (scope rules), invariant `T8`.
- Produces: the entity and migration conventions Task 15 references.

- [ ] **Step 1: Write the file**

Create `src/database/CLAUDE.md`:

````markdown
# Database — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded). Read it first — this file
> adds only what is specific to `src/database/`.

## Scope

Owns the TypeORM connection, the entity definitions, the base entity, and the
migration directory. Global (`@Global()`), so `TypeOrmModule` is available
everywhere without re-importing.

Does not own: repositories or queries. Those live in the service of the module
that owns the data — `src/spaceship/spaceship.service.ts` is the reference.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `DatabaseModule` | `src/database/database.module.ts` | Imported once by `src/app.module.ts` |
| `BaseEntity` | `src/database/entities/base.entity.ts` | Every entity extends it |
| `User` | `src/database/entities/user.entity.ts` | Auth identity |
| `Spaceship` | `src/database/entities/spaceship.entity.ts` | Example domain entity |
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
   `src/spaceship/spaceship.service.ts` looks rows up by `uuid` for exactly this
   reason.
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
   loading the relation — `Spaceship.captainId` is the pattern.

## Tests

No test covers this module (finding `G1`). Service tests mock the repository
with `getRepositoryToken(Entity)` and a plain jest object — see
`src/spaceship/spaceship.service.spec.ts`. Do not spin up a real database in a
unit test; integration coverage belongs in `test/`.

## Reuse

`src/database/entities/base.entity.ts` and the migration scripts in
`package.json` transfer to any TypeORM project unchanged.

`src/database/database.module.ts` and `src/database/config/database.scope.ts`
carry this template's config-provider dependency — port them together with
`src/config-provider/`, or rewrite the factory against whatever config mechanism
the target project uses.

`User` is coupled to `src/auth/core/auth-type.enum.ts`; take `auth` with it or
drop the `authType` column.

## Known gaps

See `docs/audit/2026-09-11-template-audit.md`.

- **`R4`** — `src/database/migrations/` holds only `.gitkeep`; the template ships
  no baseline migration.
- **`G1`** — the connection factory's URL/host branching is untested.
- **`C1`** — no `DB_*` key appears in `.env.example`.
````

- [ ] **Step 2: Verify**

Run: `pnpm run docs:check`

Expected: eight missing-path lines remain; nothing referencing `src/database/CLAUDE.md`.

- [ ] **Step 3: Commit**

```bash
git add src/database/CLAUDE.md
git commit -m "docs(database): add module guide"
```

---

### Task 9: auth module guide

**Files:**
- Create: `src/auth/CLAUDE.md`

**Interfaces:**
- Consumes: Tasks 5 and 8.
- Produces: the guard/`@CurrentUser()` convention Task 15 references.

- [ ] **Step 1: Write the file**

Create `src/auth/CLAUDE.md`:

````markdown
# Auth — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded). Read it first — this file
> adds only what is specific to `src/auth/`.

## Scope

Owns authentication: JWT issuance and verification, the Passport strategies, and
the Google OAuth flow (web redirect and mobile ID-token). Exports the pieces a
feature module needs to protect a route.

Does not own: authorization. There are no roles or permissions in this template —
a project that needs them adds a guard here and documents it in this file. Also
does not own the `User` entity, which lives in `src/database/entities/user.entity.ts`.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `AuthModule` | `src/auth/auth.module.ts` | Import into any module with protected routes |
| `AuthTokenService` | `src/auth/core/auth-token/auth-token.service.ts` | `generateAuthToken`, `validateAuthToken` |
| `AuthTokenPayload` | `src/auth/core/auth-token/auth-token.service.ts` | JWT payload shape |
| `AuthType` | `src/auth/core/auth-type.enum.ts` | `EMAIL` / `GOOGLE`; stored on `User.authType` |
| `jwtScope`, `JwtScopeConfig` | `src/auth/config/jwt.scope.ts` | JWT config |
| `googleScope`, `GoogleScopeConfig` | `src/auth/google/config/google.scope.ts` | Google OAuth config |

Protecting a route needs two more imports that do not live here:
`AuthGuard('jwt')` from `@nestjs/passport` and `CurrentUser` from
`src/user/current-user.decorator.ts`.

## Configuration

`jwtScope` reads `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_IGNORE_EXPIRATION`.
`googleScope` reads `GOOGLE_OAUTH_ENABLED`, `GOOGLE_OAUTH_CLIENT_ID`,
`GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_AUDIENCE`,
`GOOGLE_OAUTH_CALLBACK_URL` and `SELF_URL`; when `enabled` is true the first
three become required, and `callbackUrl` derives from `selfUrl` when unset.

Both are registered in the `scopes` array in `src/app.module.ts`.

## Rules

1. Protect a route with the guard plus the decorator:
   ```ts
   @UseGuards(AuthGuard('jwt'))
   @ApiBearerAuth()
   @Controller('spaceships')
   export class SpaceshipController {
     @Get()
     async list(@CurrentUser() user: User): Promise<Spaceship[]> { /* … */ }
   }
   ```
   `@ApiBearerAuth()` is not optional — without it the Swagger document lies.
2. A module with protected routes imports `AuthModule`, which re-exports
   `PassportModule` so `AuthGuard('jwt')` resolves.
3. `JwtStrategy.validate` loads the `User` by `uuid` and rejects any token whose
   `type` is not `'auth'`. Tokens for other purposes (verification, reset) must
   carry a different `type` and be verified through `AuthTokenService`, never
   through the JWT guard.
4. Auth failures throw `RequestException(Exceptions.auth.*)`. Add new cases to
   `src/common/exception/exceptions.ts` — do not construct `HttpException` here.
5. Auth failure messages stay generic. `invalidCredentials` must not reveal
   whether the account exists.
6. Never log a token, an ID token, or a raw provider error.
   `src/auth/google/google.service.ts` currently does (finding `C5`).
7. `GoogleModule` is imported unconditionally by `src/auth/auth.module.ts` and
   only *logs* when `GOOGLE_OAUTH_ENABLED` is false. A project not using Google
   OAuth removes the import rather than relying on the flag.
8. Adding a provider means a new directory `src/auth/<provider>/` with its own
   `config/<provider>.scope.ts`, strategy, service, controller and module — the
   shape of `src/auth/google/`. Add the enum member to `AuthType`, and remember
   that changing that enum changes the `User.authType` Postgres enum, which needs
   a migration.

## Tests

The module is untested (finding `G1`) — it is the highest-value gap in the
template. What new tests must cover:

- `JwtStrategy.validate` — wrong `type` returns `null`; unknown `uuid` throws
  `RequestException`; a valid payload returns the `User`.
- `AuthTokenService` — the signed payload shape, and that `expiresIn` is omitted
  when `ignoreExpiration` is set.
- `GoogleService.register` / `login` — existing user, wrong `authType`, and an
  undefined ticket payload.

Mock the `User` repository with `getRepositoryToken(User)`, and `OAuth2Client`
with a plain jest object. Name files `*.unit.spec.ts`.
`src/auth/email/email.controller.spec.ts` is a legacy-named stub for an empty
controller — do not extend it.

## Reuse

Copy `src/auth/` whole. It depends on `src/config-provider/` (both scopes),
`src/database/entities/user.entity.ts` (the `User` shape and `uuid`),
`src/common/exception/` (`RequestException`, `Exceptions`) and
`src/user/current-user.decorator.ts`. Port those four first.

Peer dependencies: `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`,
`passport-google-oauth20`, `google-auth-library`, `ms`.

Drop `src/auth/google/` entirely for a JWT-only project; nothing else in the
module references it except the import in `src/auth/auth.module.ts`.

## Known gaps

See `docs/audit/2026-09-11-template-audit.md`.

- **`C2`** — `jwtScope` defaults `secret` to `'Not A Safe Secret'`, so an app with
  no `JWT_SECRET` signs tokens with a public constant.
- **`C5`** — raw provider errors logged on the Google token path.
- **`R3`** — `src/auth/auth.service.ts` is an empty `@Injectable()` that
  `AuthModule` still exports; `src/auth/email/` is an empty controller and module.
- **`N6`** — `src/auth/jwt.strategy.ts`, `src/auth/google/google.controller.ts`
  and `src/auth/google/google.service.ts` use absolute `src/...` imports, against
  invariant `T5`.
- **`G1`** — no tests.
````

- [ ] **Step 2: Verify**

Run: `pnpm run docs:check`

Expected: seven missing-path lines remain; nothing referencing `src/auth/CLAUDE.md`.

- [ ] **Step 3: Commit**

```bash
git add src/auth/CLAUDE.md
git commit -m "docs(auth): add module guide"
```

---

### Task 10: cache module guide

**Files:**
- Create: `src/cache/CLAUDE.md`

**Interfaces:**
- Consumes: Task 4 contract.
- Produces: the extension and mock conventions cited as reference by Tasks 11-13.

- [ ] **Step 1: Write the file**

Create `src/cache/CLAUDE.md`:

````markdown
# Cache — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded) and
> `docs/architecture/module-contract.md`. Read those first — this file adds
> only what is specific to `src/cache/`.

This module is the reference implementation of the contract: style-A
registration, error translation, and the only module that ships mocks.

## Scope

Owns a provider-agnostic key/value cache and the extension mechanism that
exposes provider-specific operations without bloating the base contract.

Does not own: HTTP response caching, memoization, or the choice of what to cache
— the consuming service decides that.

Not currently registered in `src/app.module.ts`; wire it when a project needs it.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `CacheService` | `src/cache/abstract/cache.service.ts` | The contract: `get`, `set`, `del`, `clear` — inject this |
| `CacheAbstractModule` | `src/cache/abstract/cache-abstract.module.ts` | `forRoot` / `forRootAsync` |
| `CacheListExtension` | `src/cache/abstract/extensions/cache-list.extension.ts` | List operations |
| `CacheKeysExtension` | `src/cache/abstract/extensions/cache-keys.extension.ts` | Pattern key scan |
| `CacheError`, `CACHE_ERRORS` | `src/cache/abstract/cache.error.ts` | Error type and codes |
| `CACHE_ADAPTER_CLIENT`, `CACHE_LOGGER` | `src/cache/abstract/cache.tokens.ts` | Raw client / logger — advanced use only |
| `MockCacheService` and siblings | `src/cache/abstract/mocks/` | Test doubles |
| `RedisCacheAdapterService` | `src/cache/redis-adapter/redis-adapter.service.ts` | Named only in `src/app.module.ts` |

## Rules

1. Inject `CacheService`. The base contract stores strings — serialize with
   `JSON.stringify` on write and parse on read; that is the consumer's job, not
   the cache's.
2. An **extension** is a cohesive bundle of provider-specific operations, opt-in
   at registration. It exists so a project pulls in only what it uses and so the
   developer is deliberate about the dependency. Do not widen `CacheService`
   with provider-specific methods — add or extend an extension instead, and
   discuss it with the team first.
3. Enable extensions by passing implementation classes:
   `extensions: { list: RedisCacheListExtension, keys: RedisCacheKeysExtension }`.
   The abstract module wires `CACHE_ADAPTER_CLIENT` and `CACHE_LOGGER` and binds
   each by `useClass`. Omit the key and the provider is never created.
4. Inject an extension by its abstract class:
   `@Inject(CacheListExtension) private readonly lists: CacheListExtension`. Add
   `@Optional()` when the feature should degrade rather than fail if the
   extension was not enabled.
5. Every operation throws `CacheError` with a `CACHE_<OPERATION>_FAILED` code and
   operation context in `data`. Callers never see an `ioredis` error.
6. Startup is fail-fast, not fail-soft: the Redis adapter checks the connection
   in `onModuleInit` and calls `process.exit(1)` if the server is unreachable
   within five seconds. That is deliberate — a silently cache-less service is
   worse than one that will not boot. It is also why startup failures are not
   thrown as `CacheError`.
7. Avoid `keys('*')` against a production keyspace. The extension documents this
   and it holds.
8. `CACHE_ADAPTER_CLIENT` hands out the raw `ioredis` client. Injecting it
   couples your code to Redis — justify it or add an extension instead.

## Adding an adapter

1. Create `src/cache/<provider>-adapter/<provider>-adapter.service.ts` extending
   `CacheService`, implementing `get`, `set`, `del`, `clear` and exposing
   `client` and `logger`.
2. Add `<provider>-adapter-config.interface.ts` for the constructor options.
3. Wrap every provider call and rethrow `CacheError` with the matching
   `CACHE_ERRORS` code.
4. Implement the extensions the provider supports under
   `<provider>-adapter/extensions/`, each extending the abstract extension class.
5. Register through `CacheAbstractModule.forRootAsync` in `src/app.module.ts`.
6. Add `*.unit.spec.ts` for the adapter and each extension.

## Tests

No adapter test exists yet (finding `G1`), but the doubles do — consumers use
them:

```ts
providers: [
  { provide: CacheService, useClass: MockCacheService },
  { provide: CacheListExtension, useClass: MockCacheListExtension },
]
```

Every mock method is a `jest.fn()` with a sane default (`null` for gets, `0` for
counts, `[]` for lists). Adapter tests construct the adapter with `new` and mock
`ioredis` at module level.

## Reuse

Copy `src/cache/abstract/` plus the adapter directories you want. `abstract/`
depends only on `@nestjs/common`; `redis-adapter/` needs `ioredis`.

Nothing here imports from another module of this template — with
`src/config-provider/`, this is among the cleanest modules to lift.

## Known gaps

See `docs/audit/2026-09-11-template-audit.md`.

- **`D4`** — `src/cache/README.md` still shows `@nestjs/config` `ConfigType`
  registration; the project uses config-provider scopes and `@nestjs/config` is
  not a dependency.
- **`G1`** — no adapter or extension tests.
- **`L2`** — `src/cache/redis-adapter/utils/logger.ts:25` disables a rule named
  `ts/no-explicit-any`, which does not exist; ESLint errors on the bogus name and
  flags the `any` anyway. The prefix should be `@typescript-eslint/`.
- The module is not registered in `src/app.module.ts`, so no scope file exists
  for it yet; a project enabling it adds `!src/cache/config/cache.scope.ts`.
````

- [ ] **Step 2: Verify**

Run: `pnpm run docs:check`

Expected: six missing-path lines remain; nothing referencing `src/cache/CLAUDE.md`.

- [ ] **Step 3: Commit**

```bash
git add src/cache/CLAUDE.md
git commit -m "docs(cache): add module guide"
```

---

### Task 11: cloud-storage module guide

**Files:**
- Create: `src/cloud-storage/CLAUDE.md`

- [ ] **Step 1: Write the file**

Create `src/cloud-storage/CLAUDE.md`:

````markdown
# Cloud storage — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded) and
> `docs/architecture/module-contract.md`. Read those first — this file adds
> only what is specific to `src/cloud-storage/`.

## Scope

Owns file upload, retrieval and deletion behind a provider-agnostic contract,
with an optional mountable controller.

Does not own: file metadata persistence, virus scanning, or image processing. A
project that needs those adds a domain module that consumes `CloudStorageService`.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `CloudStorageService` | `src/cloud-storage/abstract/cloud-storage.service.ts` | `uploadFile`, `getFile`, `deleteFile` — inject this |
| `CloudStorageAbstractModule` | `src/cloud-storage/abstract/cloud-storage-abstract.module.ts` | `forRoot` / `forRootAsync` |
| `CloudStorageError`, `CLOUD_STORAGE_ERRORS` | `src/cloud-storage/abstract/cloud-storage.error.ts` | Error type and codes |
| `UploadFileDto` | `src/cloud-storage/abstract/dto/upload-file.dto.ts` | Upload payload |
| `FileResponseDto` | `src/cloud-storage/abstract/dto/file-response.dto.ts` | Response shape |
| `CloudStorageController` | `src/cloud-storage/abstract/cloud-storage.controller.ts` | Mounted only via `useDefaultController: true` |
| `S3AdapterService` | `src/cloud-storage/s3-adapter/s3-adapter.service.ts` | Named only in `src/app.module.ts` |
| `LocalAdapterService` | `src/cloud-storage/local-adapter/local-adapter.service.ts` | Named only in `src/app.module.ts` |
| `s3Scope`, `S3ScopeConfig` | `src/cloud-storage/s3-adapter/config/s3.scope.ts` | S3 config |

## Configuration

`s3Scope` reads `AWS_S3_BUCKET_NAME`, `AWS_REGION`, `AWS_ACCESS_KEY`,
`AWS_SECRET_ACCESS_KEY` and `AWS_S3_EXPIRES_IN_SECONDS` (default `3600`).
Registered in `src/app.module.ts`, which currently wires `S3AdapterService`
through `forRootAsync` with `useDefaultController: true`.

`LocalAdapterService` takes no configuration and writes to a project-level
`/files` directory — development only. Because it needs no config it is the one
adapter here that suits `forRoot`.

## Rules

1. Inject `CloudStorageService`. Never inject `S3AdapterService` or
   `LocalAdapterService` (invariant `T1`).
2. Adapter selection belongs in the `useFactory` in `src/app.module.ts` — local
   for development, S3 for deployed environments. Do not branch on the
   environment inside a service.
3. `useDefaultController` defaults to `false`. Mounting it exposes
   `POST /cloud-storage`, `GET /cloud-storage/:fileKey` and
   `DELETE /cloud-storage/:fileKey` **with no authentication**. For anything
   beyond a demo, leave it off and write a controller that applies
   `AuthGuard('jwt')` and your own authorization.
4. Adapters throw `CloudStorageError` with a `CLOUD_STORAGE_ERRORS` code. An
   `@aws-sdk` error must never escape the adapter.
5. A file key is opaque. Never build one from user-supplied input without
   validating it; `CLOUD_STORAGE_ERRORS.INVALID_KEY` exists for that rejection.
6. AWS credentials are optional in `S3AdapterConfig` precisely so deployed
   environments can use the task IAM role. Prefer the role; set explicit keys
   only for local work.
7. Presigned URLs are time-bounded by `expiresInSeconds`. Keep it short; do not
   raise it to paper over a slow client.

## Adding an adapter

1. Create `src/cloud-storage/<provider>-adapter/<provider>-adapter.service.ts`
   extending `CloudStorageService`.
2. Add `<provider>-adapter-config.interface.ts` for the constructor options.
3. Add `config/<provider>.scope.ts` if it needs configuration.
4. Translate every SDK error into `CloudStorageError`.
5. Register it in the `forRootAsync` factory in `src/app.module.ts`.
6. Add `<provider>-adapter.service.unit.spec.ts`.

## Tests

This module is reasonably covered:
`src/cloud-storage/abstract/cloud-storage-abstract.module.unit.spec.ts`,
`src/cloud-storage/local-adapter/local-adapter.service.unit.spec.ts` and
`src/cloud-storage/s3-adapter/s3-adapter.service.unit.spec.ts`. Follow the local
adapter test: `jest.mock('node:fs/promises')` and `jest.mock('uuid')` at module
level, construct with `new`, assert both the happy path and the thrown
`CloudStorageError`. No mocks directory exists yet (finding `N5`) — adding
`abstract/mocks/cloud-storage.service.mock.ts` would follow `src/cache/abstract/mocks/`.

## Reuse

Copy `src/cloud-storage/abstract/` plus the adapters you want.

- `abstract/` needs `@nestjs/common`, `@nestjs/swagger`, `class-validator` and
  `@types/multer`.
- `s3-adapter/` needs `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`,
  and its scope depends on `src/config-provider/`.
- `local-adapter/` needs `uuid` and nothing else.

Drop `cloud-storage.controller.ts` if the target project brings its own.

## Known gaps

See `docs/audit/2026-09-11-template-audit.md`.

- **`D1`** — `src/cloud-storage/README.md` documents an orchestrator, a targets
  enum, a tokens file, a config file and an IPFS adapter, all under a
  `!src/modules/infrastructure/` path. None of it exists. Trust this file and the
  source, not that README.
- **`N2`**, **`C4`** — `src/cloud-storage/abstract/cloud-storage.controller.ts`
  throws `ApiException` at lines 43, 58 and 73. `ApiException` is a plain `Error`,
  and the global filter catches only `HttpException`, so these three validation
  failures return an unhandled `500` instead of a `400`. If you mount this
  controller, fix that first.
- **`N5`** — no `abstract/mocks/`.
- **`C1`** — `AWS_REGION` and `AWS_S3_EXPIRES_IN_SECONDS` are missing from
  `.env.example`.
````

- [ ] **Step 2: Verify**

Run: `pnpm run docs:check`

Expected: five missing-path lines remain; nothing referencing `src/cloud-storage/CLAUDE.md`.

- [ ] **Step 3: Commit**

```bash
git add src/cloud-storage/CLAUDE.md
git commit -m "docs(cloud-storage): add module guide"
```

---

### Task 12: email module guide

**Files:**
- Create: `src/email/CLAUDE.md`

- [ ] **Step 1: Write the file**

Create `src/email/CLAUDE.md`:

````markdown
# Email — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded) and
> `docs/architecture/module-contract.md`. Read those first — this file adds
> only what is specific to `src/email/`.

## Scope

Owns email delivery behind a provider-agnostic contract, with four adapters:
AWS SES, SendGrid, Resend and a console adapter for local development.

Does not own: template rendering. `EmailService` takes **pre-rendered** content.
Compiling a template is `src/templating/`'s job, and the caller wires the two
together — `src/app.controller.ts` shows the pattern. This separation is
deliberate: it is what lets either side be swapped alone.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `EmailService` | `src/email/abstract/email.service.ts` | `sendEmail`, `sendEmailBatch` — inject this |
| `EmailAbstractModule` | `src/email/abstract/email-abstract.module.ts` | `forRoot` / `forRootAsync` |
| `SendRenderedEmailParams`, `MailingResponse` and siblings | `src/email/abstract/email.interface.ts` | Call and response shapes |
| `RenderedEmailContent` | `src/email/abstract/email.types.ts` | The `{ html }` payload |
| `EmailError`, `EMAIL_ERRORS` | `src/email/abstract/email.error.ts` | Error type and codes |
| `emailScope`, `EmailScopeConfig`, `EMAIL_ADAPTERS` | `src/email/config/email.scope.ts` | Config and the adapter enum |
| `AwsSesAdapterService` | `src/email/aws-ses-adapter/aws-ses-adapter.service.ts` | Named only in `src/app.module.ts` |
| `SendgridAdapterService` | `src/email/sendgrid-adapter/sendgrid-adapter.service.ts` | Named only in `src/app.module.ts` |
| `ResendAdapterService` | `src/email/resend-adapter/resend-adapter.service.ts` | Named only in `src/app.module.ts` |
| `ConsoleAdapterService` | `src/email/console-adapter/console-adapter.service.ts` | Named only in `src/app.module.ts` |

## Internal

`src/email/abstract/templates.abstract.ts` (`EmailTemplateService`) duplicates
`TemplateService.compile` and has no callers (finding `N7`). Do not import it.
`src/email/utils/execute-html-email-send.ts` is an internal helper — not part of
the surface.

## Configuration

`emailScope` reads `EMAIL_ADAPTER` (one of `AWS_SES`, `SENDGRID`, `RESEND`,
`CONSOLE`; defaults to `CONSOLE`), `EMAIL_FROM`, `SENDGRID_API_KEY`,
`RESEND_API_KEY`, `RESEND_EMAIL_FROM`, `AWS_SES_REGION`, `AWS_ACCESS_KEY` and
`AWS_SECRET_ACCESS_KEY`.

Defaulting to `CONSOLE` is intentional: a developer with no credentials gets a
working app that prints emails instead of a boot failure.

## Rules

1. Inject `EmailService`. Never an adapter class (invariant `T1`).
2. Render first, then send. Compile with `TemplateService` and pass the result as
   `content: { html }`.
3. Adapter selection is the `useFactory` in `src/app.module.ts`, switching on
   `emailScope`'s `adapter` value against the `EMAIL_ADAPTERS` constants, with
   `ConsoleAdapterService` as the fallback branch.
4. Adapters accept an optional `logger?: LoggerService` last parameter and fall
   back to `new NestLoggerAdapter(...)` — so the module works with no logger
   registered. `ResendAdapterService` is the reference. Pass the injected logger
   through `inject: [LoggerService]` in the factory when one exists.
5. Adapters throw `EmailError` with an `EMAIL_ERRORS` code. A `@sendgrid/mail`,
   `resend` or `@aws-sdk/client-ses` error must never escape.
6. Never log a recipient address, an API key or message content. Log the outcome
   and a provider message ID.
7. Batch sends go through `sendEmailBatch`, not a loop over `sendEmail`.
8. Template names and subjects come from `src/templates/template.const.ts`. Do
   not inline a subject string at the call site.

## Adding an adapter

1. Create `src/email/<provider>-adapter/<provider>-adapter.service.ts` extending
   `EmailService`.
2. Add `<provider>-adapter-config.interface.ts` for the constructor options.
3. Accept `logger?: LoggerService` as the last constructor parameter with the
   `NestLoggerAdapter` fallback.
4. Translate provider errors into `EmailError`.
5. Add the provider to `EMAIL_ADAPTERS` and the scope's fields in
   `src/email/config/email.scope.ts`.
6. Add a branch to the factory in `src/app.module.ts`.
7. Add `<provider>-adapter.service.unit.spec.ts`.

## Tests

No test exists for this module (finding `G1`). Adapters are plain classes —
construct with `new`, mock the provider SDK at module level with `jest.mock`,
assert the mapped payload and the thrown `EmailError`. `ConsoleAdapterService` is
the easiest place to start. No `abstract/mocks/` exists yet (finding `N5`).

## Reuse

Copy `src/email/abstract/` plus the adapters you want.

- `abstract/` needs only `@nestjs/common`.
- `aws-ses-adapter/` needs `@aws-sdk/client-ses`; `sendgrid-adapter/` needs
  `@sendgrid/mail`; `resend-adapter/` needs `resend`; `console-adapter/` needs
  nothing.

`src/email/config/email.scope.ts` depends on `src/config-provider/` and `joi`.
Adapters reference `LoggerService` from `src/common/logger/` — port that too, or
drop the optional logger parameter.

## Known gaps

See `docs/audit/2026-09-11-template-audit.md`.

- **`B1`** — the email factory in `src/app.module.ts` references `emailConfig`,
  `awsConfig` and `ConfigType`, none of which is imported; the app does not
  compile. It should use the already-imported `emailScope`.
- **`D2`** — `src/email/README.md` documents `utils/email-logger.adapter.ts`,
  `abstract/email-logger.interface.ts` and `!src/config/email.config.ts`, none of
  which exist, and still teaches `@nestjs/config`.
- **`N7`** — `abstract/templates.abstract.ts` is dead code.
- **`N5`**, **`G1`** — no mocks, no tests.
````

- [ ] **Step 2: Verify**

Run: `pnpm run docs:check`

Expected: four missing-path lines remain; nothing referencing `src/email/CLAUDE.md`.

- [ ] **Step 3: Commit**

```bash
git add src/email/CLAUDE.md
git commit -m "docs(email): add module guide"
```

---

### Task 13: push-notification module guide

**Files:**
- Create: `src/push-notification/CLAUDE.md`

- [ ] **Step 1: Write the file**

Create `src/push-notification/CLAUDE.md`:

````markdown
# Push notification — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded) and
> `docs/architecture/module-contract.md`. Read those first — this file adds
> only what is specific to `src/push-notification/`.

**This module uses style-B registration** (adapter as module + provider token).
It is the older shape. Read the "two registration styles" section of the contract
before changing anything here, and do not copy style B into a new module.

## Scope

Owns push delivery behind a provider-agnostic contract, with an Expo adapter.

Does not own: device-token storage. Persisting and revoking tokens per user is a
domain concern; the template does not model it.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `PushNotificationService` | `src/push-notification/abstract/push-notification.service.ts` | The contract — inject this |
| `PushNotificationAbstractModule` | `src/push-notification/abstract/push-notification-abstract.module.ts.ts` | `forRoot` only |
| `IPushNotification` and siblings | `src/push-notification/abstract/push-notification.interface.ts` | Payload shapes |
| `PushNotificationDto` | `src/push-notification/abstract/dto/push-notification.dto.ts` | Request DTO |
| `PushNotificationException` | `src/push-notification/abstract/push-notification.exception.ts` | Error type |
| `PUSH_NOTIFICATION_ERRORS`, `IErrorDefinition` | `src/push-notification/abstract/push-notification-error-codes.ts` | Error definitions |
| `PUSH_NOTIFICATION_PROVIDER` | `src/push-notification/abstract/push-notification-provider.const.ts` | Token an adapter module must provide |
| `ExpoAdapterModule` | `src/push-notification/expo-adapter/expo-adapter.module.ts` | Named only in `src/app.module.ts` |
| `expoScope`, `ExpoScopeConfig` | `src/push-notification/expo-adapter/config/expo.scope.ts` | Expo config |

Note the module file's real name: `push-notification-abstract.module.ts.ts`,
with a doubled extension (finding `N1`). Import it exactly as written until that
is fixed.

## Configuration

`expoScope` reads `EXPO_ACCESS_TOKEN`. `src/app.module.ts` registers
`PushNotificationAbstractModule.forRoot` with
`ExpoAdapterModule.registerAsync({ inject: [expoScope.KEY], … })` and
`useDefaultController: true`.

## Rules

1. Inject `PushNotificationService`. Never `ExpoAdapterService`.
2. An adapter module must bind its service to `PUSH_NOTIFICATION_PROVIDER` and
   export that token — that is the seam the abstract module aliases to
   `PushNotificationService`.
3. `useDefaultController` defaults to **`true`** here, unlike cloud-storage.
   `PushNotificationController` is a **test endpoint** that sends to an arbitrary
   token with no authentication. Set it to `false` for anything deployed, and
   pass your own guarded controller through `controllers`.
4. Send in chunks. `sendNotificationByChunks` exists because Expo rate-limits
   large sends; do not loop over the single-send method.
5. A device token is a credential. Never log it, never return it in a response.
6. Failures throw `PushNotificationException`, which is an `HttpException` — this
   module does not follow the plain-`Error` shape the other adapter modules use
   (finding `N2`). Do not use it as the model for a new module's errors.

## Adding an adapter

1. Create `src/push-notification/<provider>-adapter/` with a service extending
   `PushNotificationService`, a config interface, a config-token const and a
   module exposing `register`/`registerAsync`.
2. Bind the service to `PUSH_NOTIFICATION_PROVIDER` in that module's providers
   and export the token — mirror `src/push-notification/expo-adapter/expo-adapter.module.ts`.
3. Add `config/<provider>.scope.ts` and register it in `src/app.module.ts`.
4. Pass the adapter module as `adapter:` to `PushNotificationAbstractModule.forRoot`.
5. Add `<provider>-adapter.service.unit.spec.ts`.

## Tests

No test exists (finding `G1`). The Expo adapter is the place to start: mock
`expo-server-sdk` at module level, assert chunking behaviour and the thrown
`PushNotificationException`. No `abstract/mocks/` exists (finding `N5`).

## Reuse

Copy `src/push-notification/` whole; `expo-adapter/` needs `expo-server-sdk`.
`config/expo.scope.ts` depends on `src/config-provider/` and `joi`.

Be aware you are also copying findings `N1`, `N2` and `N3` — a project lifting
this module should plan to rename the module file, convert the error type to the
plain-`Error` shape, and add `forRootAsync`.

## Known gaps

See `docs/audit/2026-09-11-template-audit.md`.

- **`N1`** — `push-notification-abstract.module.ts.ts` has a doubled extension.
- **`N2`** — `PUSH_NOTIFICATION_ERRORS` contains three entries whose codes are all
  `CLOUD_STORAGE_*` copy-paste leftovers, and they describe file upload, not push.
- **`N3`** — no `forRootAsync`; the file ends with `// TODO: Add forRootAsync`.
  Also, `forRoot` mutates the caller's `controllers` array with `push`.
- **`D4`** — `src/push-notification/README.md` teaches `@nestjs/config` and `npm`.
- **`G1`**, **`N5`** — no tests, no mocks.
````

- [ ] **Step 2: Verify**

Run: `pnpm run docs:check`

Expected: three missing-path lines remain. The doubled-extension path
`src/push-notification/abstract/push-notification-abstract.module.ts.ts` must
**not** be reported missing — it really does exist under that name.

- [ ] **Step 3: Commit**

```bash
git add src/push-notification/CLAUDE.md
git commit -m "docs(push-notification): add module guide"
```

---

### Task 14: templating and templates guides

These two directories are one concern split across a service layer and an asset layer; documenting them together keeps the boundary explicit.

**Files:**
- Create: `src/templating/CLAUDE.md`
- Create: `src/templates/CLAUDE.md`

- [ ] **Step 1: Write the templating guide**

Create `src/templating/CLAUDE.md`:

````markdown
# Templating — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded) and
> `docs/architecture/module-contract.md`. Read those first — this file adds
> only what is specific to `src/templating/`.

**Style-B registration** (adapter as module + provider token), like
`src/push-notification/`. Do not copy the style into a new module.

## Scope

Owns compiling a template to HTML: the abstract service, the dynamic module and
the pug adapter.

Does not own: the template files. Those are assets in `src/templates/` — see
`src/templates/CLAUDE.md`. Nor does it own delivery; `src/email/` takes the
compiled HTML.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `TemplateService` | `src/templating/abstract/template.service.ts` | `compile(nameOrPath, params)` — inject this |
| `TemplateModule` | `src/templating/template.module.ts` | `forRoot` only |
| `TEMPLATE_PROVIDER` | `src/templating/abstract/template-provider.const.ts` | Token an adapter module must provide |
| `PugAdapterModule`, `PugAdapterConfig` | `src/templating/pug-adapter/pug-adapter.module.ts` | Named only in `src/app.module.ts` |

## Configuration

`PugAdapterModule.register({ baseDir })` — `baseDir` defaults to the process
working directory, which is why the paths in `src/templates/template.const.ts`
are repo-relative. `src/app.module.ts` registers
`TemplateModule.forRoot({ adapter: PugAdapterModule.register({}), isGlobal: true })`.

`nest-cli.json` copies `**/*.pug` into `dist` as assets. A new engine's file
extension must be added there or templates will be missing from the build.

## Rules

1. Inject `TemplateService`. Never `PugAdapterService`.
2. Address a template through `TEMPLATE_PATHS[TEMPLATES.X]` from
   `src/templates/template.const.ts`. Never pass a hand-written path string.
3. `compile` returns HTML and nothing more. It does not send, store, or wrap.
4. An adapter module binds its service to `TEMPLATE_PROVIDER` and also aliases
   `TemplateService` with `useExisting`, then exports both —
   `src/templating/pug-adapter/pug-adapter.module.ts` is the reference.
5. Template parameters are typed through `TemplateParamsMap` in
   `src/templates/template-params.interface.ts`. Adding a template means adding
   its entry there.
6. `TemplateModule` has no `forRootAsync` (finding `N3`). An engine needing
   async config uses the adapter's own `registerAsync` — `PugAdapterModule`
   already has one — and passes the result as `adapter:`.

## Adding an adapter

1. Create `src/templating/<engine>-adapter/<engine>-adapter.service.ts`
   implementing `TemplateService`.
2. Create `<engine>-adapter.module.ts` with `register`/`registerAsync` binding
   `TEMPLATE_PROVIDER` and aliasing `TemplateService` via `useExisting`.
3. Add the engine's file extension to `compilerOptions.assets` in `nest-cli.json`.
4. Pass the module as `adapter:` to `TemplateModule.forRoot` in `src/app.module.ts`.
5. Add `<engine>-adapter.service.unit.spec.ts`.

## Tests

No test exists (finding `G1`). `PugAdapterService` is a plain class — construct
it with a fixture `baseDir`, compile a small fixture template, assert the HTML,
and assert the failure path for a missing file.

## Reuse

Copy `src/templating/` whole; `pug-adapter/` needs `pug` and `@types/pug`.
Nothing here imports from another module of this template. Take
`src/templates/` with it if you want the typed registry, and copy the
`nest-cli.json` asset entry.

## Known gaps

See `docs/audit/2026-09-11-template-audit.md`.

- **`N3`** — `TemplateModule` has no `forRootAsync`, and no
  `validateAdapterModule` guard on any async path.
- **`N7`** — `src/templates/template-renderer.interface.ts` duplicates this
  contract and is dead.
- **`G1`** — no tests.
````

- [ ] **Step 2: Write the templates guide**

Create `src/templates/CLAUDE.md`:

````markdown
# Templates (assets) — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded). Read it first — this file
> adds only what is specific to `src/templates/`.

## Scope

Owns the template files themselves and the typed registry naming them: paths,
subjects and per-template parameter types.

Does not own: anything executable. **There is no Nest module, provider or
service in this directory, and none may be added.** Compilation lives in
`src/templating/` — see `src/templating/CLAUDE.md`.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `TEMPLATES`, `TEMPLATE_PATHS`, `TEMPLATE_SUBJECTS` | `src/templates/template.const.ts` | The registry — the single source of truth |
| `Template`, `TemplateParamsMap` | `src/templates/template-params.interface.ts` | Template union and parameter type map |
| `WelcomeParams` | `src/templates/onboarding/welcome.interface.ts` | Parameters for the welcome template |
| `VerificationParams` | `src/templates/auth/verification.interface.ts` | Parameters for the verification template |
| barrel | `src/templates/index.ts` | Re-exports the registry and the param types |

## Internal

`src/templates/template-renderer.interface.ts` (`TemplateRenderer`,
`TEMPLATE_RENDERER`) duplicates `TemplateService` and has no callers
(finding `N7`). Do not import it.

## Rules

1. A template is three files in a subdirectory named for its domain:
   `<name>.pug`, `<name>.interface.ts` exporting its params type, and entries in
   the registry.
2. Every new template gets an entry in all three registry maps — `TEMPLATES`,
   `TEMPLATE_PATHS`, `TEMPLATE_SUBJECTS` — plus a line in `TemplateParamsMap`.
   All four, or the type map silently drifts from the path map.
3. Paths in `TEMPLATE_PATHS` are repo-relative (`src/templates/...`) because the
   pug adapter's `baseDir` defaults to the process working directory. Changing
   one requires changing the other.
4. Subjects live in `TEMPLATE_SUBJECTS`, never inline at the call site.
5. Templates render data that is already safe. Escape by default; a raw
   interpolation of user-supplied content is an XSS bug in an email client.
6. `nest-cli.json` copies `**/*.pug` into `dist`. A template in another format
   will not ship until that list includes its extension.

## Tests

Untested (finding `G1`), and mostly declarative. What is worth testing is the
registry's internal consistency: every key of `TEMPLATES` has an entry in
`TEMPLATE_PATHS` and `TEMPLATE_SUBJECTS`, and every path resolves to a file on
disk.

## Reuse

Copy `src/templates/` whole, or take `template.const.ts` and
`template-params.interface.ts` as the pattern and supply your own templates. The
directory depends on nothing — no NestJS import, no runtime dependency.

## Known gaps

See `docs/audit/2026-09-11-template-audit.md`.

- **`N7`** — `template-renderer.interface.ts` is dead code duplicating
  `TemplateService`.
- **`G1`** — no registry-consistency test.
````

- [ ] **Step 3: Verify**

Run: `pnpm run docs:check`

Expected: one missing-path line remains — `src/spaceship/CLAUDE.md`.

- [ ] **Step 4: Commit**

```bash
git add src/templating/CLAUDE.md src/templates/CLAUDE.md
git commit -m "docs(templating): add templating and templates module guides"
```

---

### Task 15: spaceship reference domain module guide

The one file a developer starting a new feature will read. It documents the domain-module pattern, using `spaceship` as the worked example.

**Files:**
- Create: `src/spaceship/CLAUDE.md`

**Interfaces:**
- Consumes: Tasks 8 (entities, `uuid`) and 9 (guards, `@CurrentUser()`).
- Produces: the domain-module recipe the root file's invariant `T7` points at.

- [ ] **Step 1: Write the file**

Create `src/spaceship/CLAUDE.md`:

````markdown
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
````

- [ ] **Step 2: Verify**

Run: `pnpm run docs:check`

Expected: `docs:check passed`. Every module doc now exists, every required
section is present, every referenced path resolves, and the root module map is
complete.

- [ ] **Step 3: Commit**

```bash
git add src/spaceship/CLAUDE.md
git commit -m "docs(spaceship): add reference domain module guide"
```

---

### Task 16: Wire the validator into CI and point the README at the docs

**Files:**
- Modify: `bitbucket-pipelines.yml` (the `test-build` step's `script` list)
- Modify: `README.md` (insert a section after the `## Description` heading)

**Interfaces:**
- Consumes: `pnpm run docs:check` (Task 1) and every doc from Tasks 2-15.
- Produces: nothing downstream.

- [ ] **Step 1: Add the check to the pipeline**

In `bitbucket-pipelines.yml`, in the `&test-build` step, insert one line
immediately after `- pnpm run lint`:

```yaml
          - pnpm run docs:check
```

Leave `pnpm run build` where it is. Do **not** add `pnpm test` in this task —
finding `G2` is real, but turning tests on in CI will surface unrelated failures
and belongs to the follow-up plan, not to a documentation change.

- [ ] **Step 2: Point the README at the documentation**

In `README.md`, immediately after the `Nest framework TypeScript starter
repository.` line under `## Description`, insert:

```markdown
## SpaceDev template documentation

This is the SpaceDev reusable NestJS template. Each top-level directory under
`src/` is a module designed to be lifted into another project on its own.

- `CLAUDE.md` — project invariants, commands and the module map. Start here.
- `docs/architecture/module-contract.md` — the contract every adapter module implements.
- `docs/audit/2026-09-11-template-audit.md` — known defects, cited by ID from each module guide.
- `src/<module>/CLAUDE.md` — rules, public surface and extraction recipe for that module.
- `src/<module>/README.md` — human-facing recipes and examples for that module.

Run `pnpm run docs:check` after editing any `CLAUDE.md`.
```

The rest of the stock NestJS README is left alone — replacing it is finding `D5`
and belongs to the follow-up plan.

- [ ] **Step 3: Verify**

Run:

```bash
pnpm run docs:check
grep -n "docs:check" bitbucket-pipelines.yml package.json
grep -n "SpaceDev template documentation" README.md
```

Expected: `docs:check passed`; `docs:check` appears once in
`bitbucket-pipelines.yml` and once in `package.json`; the README heading is
found once.

Then confirm nothing under `src/**/*.ts` was modified across the whole branch:

```bash
git diff --name-only master...HEAD | grep -E '^src/.*\.ts$' || echo "no source files touched"
```

Expected: `no source files touched`.

- [ ] **Step 4: Commit — local only**

```bash
git add bitbucket-pipelines.yml README.md
git commit -m "chore: run docs:check in CI and link template docs from README"
```

**Do not push. Do not open a pull request. Do not add a remote.** The work stays
on the local `chore/claude-md-hierarchy` branch; publishing it is the repository
owner's call, not this plan's. Never commit to `master` either.

---

## Self-Review

Run these checks after the last task, before requesting review.

**1. Coverage.** Every top-level directory under `src/` that contains a module
has a `CLAUDE.md`: `auth`, `cache`, `cloud-storage`, `common`, `common/logger`,
`config-provider`, `database`, `email`, `push-notification`, `spaceship`,
`templates`, `templating`. `src/user` is intentionally excluded and is called out
in the root module map — confirm that note is still there.

```bash
for d in src/*/; do
  test -f "$d/CLAUDE.md" || echo "no CLAUDE.md: $d"
done
```

Expected output: `no CLAUDE.md: src/user/` and nothing else.

**2. Every audit finding is reachable.** Each ID must be cited from at least one
module doc or from the root file, so an agent working in that area meets it:

```bash
for id in B1 B2 B3 N1 N2 N3 N4 N5 N6 N7 D1 D2 D3 D4 D5 \
          C1 C2 C3 C4 C5 TS1 TS2 TS3 L1 L2 L3 R1 R2 R3 R4 G1 G2; do
  grep -rlq "\`$id\`" --include=CLAUDE.md . || echo "uncited finding: $id"
done
```

Expected: `C3`, `D5`, `TS3` and `L2` may be reported — they are template-wide or
single-file and live only in the audit document. Any other ID appearing here
means a module doc is missing a gap it should warn about; add it.

**3. No duplicated rules.** Grep the module docs for text that restates a root
invariant rather than citing it. If more than one file spells out the same rule
in full, cut it down to the `T<n>` citation — a rule in two places is a rule that
will drift, which is precisely how `D1`-`D5` happened.

**4. Terminology is consistent.** `forRoot` / `forRootAsync` / `register` /
`registerAsync`, "scope" (never "config module"), "adapter" (never "provider" for
an implementation class — `provider` means a NestJS provider), "style A" /
"style B" exactly as defined in `docs/architecture/module-contract.md`.

**5. The validator actually runs.** `pnpm run docs:check` exits 0, and breaking
it on purpose (add a backticked `src/nope.ts` to any doc) exits 1 with a
`references missing path` line. Undo the edit.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-11-claude-md-hierarchy.md`. Two execution options:

**1. Subagent-Driven (recommended)** — a fresh subagent per task, review between tasks, fast iteration. Sixteen tasks, each ending green on `pnpm run docs:check`.

**2. Inline Execution** — execute tasks in this session using executing-plans, batched with checkpoints.

Which approach?
