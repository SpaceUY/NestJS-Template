# NestJS Template — Audit, 2026-09-11

Audited against commit `7839d30` on `master`, with `pnpm install --frozen-lockfile`
completed and all three gates executed:

| Gate | Result |
|---|---|
| `pnpm run build` | **FAILS** — 6 TypeScript errors, all in `src/app.module.ts` (finding `B1`) |
| `pnpm run lint` | **FAILS** — 23 errors, 8 warnings (findings `L1`-`L3`) |
| `pnpm test` | **PASSES** — 15 suites, 120 tests |

Two of the three gates the Bitbucket pipeline runs are red on `master` today.

Finding IDs are stable and are cited from the `## Known gaps` section of each
module's `CLAUDE.md`. When a finding is fixed, strike it here rather than
deleting it, so the citations stay resolvable.

### Blockers

| ID | Finding |
|----|---------|
| **B1** | `src/app.module.ts:72-76` references `emailConfig`, `awsConfig` and `ConfigType` — none of the three is imported. `emailScope` and `EMAIL_ADAPTERS` *are* imported (lines 18-21) but never used. The project does not compile as committed. |
| **B2** | `package.json` declares `"dotenv"` twice — `^16.0.0` at line 38 and `^17.4.2` at line 49. The later key silently wins (lockfile resolves 17.4.2). |
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
