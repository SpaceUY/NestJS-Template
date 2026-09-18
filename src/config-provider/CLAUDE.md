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
| `ConfigProviderService` | `src/config-provider/abstract/config-provider.service.ts` | Source adapter contract — extend to add a source. Also owns `protected logger` and `setLogger()` |
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
7. Source adapters do not declare a logger. `ConfigProviderService` owns a
   `protected logger` defaulting to `new NestLoggerAdapter(<adapter class
   name>)`, and the module optionally injects the container's `LoggerService`
   and calls `setLogger()` on `useClass` and `useFactory` sources. A `useValue`
   source is deliberately left alone — that instance belongs to the caller, who
   may already hold or share it; call `setLogger()` on it yourself if you want
   the container logger. Never log a secret value or a raw provider error
   (invariant `T4`): a `JSON.parse` failure on a secret payload embeds part of
   that payload in its message.
8. `{ live: true }` opts a scope into hot reload via a `Proxy`. Reserve it for
   values that genuinely change at runtime (feature flags, rate limits, rotating
   credentials). Application config must stay static.
9. Every key a scope reads must appear in `.env.example`. Most currently do not
   (finding `C1`) — add yours.
10. Misconfiguration must fail at startup, not at first use. Unknown source names
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
