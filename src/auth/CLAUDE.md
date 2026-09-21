# Auth — module guide

> Inherits the repo-root `CLAUDE.md` (always loaded). Read it first — this file
> adds only what is specific to `src/auth/`.

## Scope

Owns authentication: JWT issuance and verification, the Passport strategies, the
Google OAuth flow (web redirect and mobile ID-token), and the Auth0
resource-server exchange. Every provider is independent — Email, Google and
Auth0 do not import each other's code, each converts its own credential into
the app's own JWT via `AuthTokenService`, and `AuthGuard('jwt')` is the only
guard business routes ever need regardless of which provider a user logged in
through. Exports the pieces a feature module needs to protect a route.

Does not own: authorization. There are no roles or permissions in this template —
a project that needs them adds a guard here and documents it in this file. Also
does not own the `User` entity, which lives in `src/database/entities/user.entity.ts`.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `AuthModule` | `src/auth/auth.module.ts` | Import into any module with protected routes |
| `AuthTokenService` | `src/auth/core/auth-token/auth-token.service.ts` | `generateAuthToken`, `validateAuthToken` — injecting it requires importing `AuthTokenModule` (`src/auth/core/auth-token/auth-token.module.ts`); `AuthModule` does not re-export it |
| `AuthTokenPayload` | `src/auth/core/auth-token/auth-token.service.ts` | JWT payload shape |
| `AuthType` | `src/database/entities/auth-type.enum.ts` | `EMAIL` / `GOOGLE` / `AUTH0`; stored on `User.authType` |
| `jwtScope`, `JwtScopeConfig` | `src/auth/config/jwt.scope.ts` | JWT config |
| `googleScope`, `GoogleScopeConfig` | `src/auth/google/config/google.scope.ts` | Google OAuth config |
| `auth0Scope`, `Auth0ScopeConfig` | `src/auth/auth0/config/auth0.scope.ts` | Auth0 config |

Protecting a route needs two more imports that do not live here:
`AuthGuard('jwt')` from `@nestjs/passport` and `CurrentUser` from
`src/user/current-user.decorator.ts`.

## Configuration

`jwtScope` reads `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_IGNORE_EXPIRATION`.
`googleScope` reads `GOOGLE_OAUTH_ENABLED`, `GOOGLE_OAUTH_CLIENT_ID`,
`GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_AUDIENCE`,
`GOOGLE_OAUTH_CALLBACK_URL` and `SELF_URL`; when `enabled` is true the first
three become required, and `callbackUrl` derives from `selfUrl` when unset.
`auth0Scope` reads `AUTH0_ENABLED`, `AUTH0_DOMAIN`, `AUTH0_AUDIENCE` and
`AUTH0_ISSUER`; when `enabled` is true `domain` and `audience` become
required, and `issuer` derives from `domain` when unset (`https://<domain>/`).

All three are registered in the `scopes` array in `src/app.module.ts`.

## Rules

1. Protect a route with the guard plus the decorator — for example, in a
   controller of your own:
   ```ts
   @UseGuards(AuthGuard('jwt'))
   @ApiBearerAuth()
   @Controller('me')
   export class ProfileController {
     @Get()
     async profile(@CurrentUser() user: User): Promise<User> { /* … */ }
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
6. Never log a token, an ID token, or a raw provider error. A rejected
   `verifyIdToken` carries the submitted token in its message, so
   `src/auth/google/google.service.ts` logs the error's *kind* and nothing
   else (`_logProviderFailure`). Follow that shape for any new provider.
7. `GoogleModule` and `Auth0Module` are imported unconditionally by
   `src/auth/auth.module.ts` and only *log* when their `enabled` flag is false.
   A project not using one of them removes the import rather than relying on
   the flag — this is what keeps the three providers independent: dropping one
   never requires touching another's code.
8. Adding a provider means a new directory `src/auth/<provider>/` with its own
   `config/<provider>.scope.ts`, service (or strategy, for a Passport-driven
   flow like `src/auth/google/`), controller and module. Add the enum member to
   `AuthType`, and remember that changing that enum changes the `User.authType`
   Postgres enum, which needs a migration.
9. `src/auth/auth0/` is a resource-server flow, not a Passport strategy: the
   client obtains its access token from Auth0 directly (Universal Login, an SPA
   SDK, etc.) and calls `POST /auth/auth0/login` with it in the body (validated
   by `Auth0LoginDto`). `Auth0Service.login` verifies the token by calling
   Auth0's `/userinfo` with it — a request that fails for anything invalid,
   expired or revoked — then checks the token's own `iss`/`aud` claims against
   `auth0Conf.issuer`/`auth0Conf.audience` to reject a token minted for a
   different application on the same tenant (confused-deputy/token
   substitution). Reading those claims without a local signature check is safe
   here specifically because `/userinfo` already proved the token is
   genuinely Auth0-signed; only after both checks pass does it find-or-create
   the `User` by `auth0Id` and return the app's own JWT via `AuthTokenService`,
   the same as `GoogleController`'s callback does. No local JWKS verification:
   `jwks-rsa`'s `jose` dependency is ESM-only and breaks this template's Jest
   setup, and it would be redundant work for an endpoint that only runs once
   per login, not on every request.

   The client must request the `AUTH0_AUDIENCE` value as the `audience` when it
   obtains the access token from Auth0 (e.g. the SPA SDK's `audience` option).
   Without it, Auth0 issues an opaque access token instead of a JWT, the `iss`/
   `aud` check has nothing to decode, and login always fails with the same
   generic `invalidCredentials` — fails safe, but worth getting right when
   wiring up a client.

   Auth0 auto-provisions on first login rather than splitting register/login
   like `GoogleService` does — Auth0's own Universal Login already covers the
   sign-up UX, so there is no separate "register" step here. One consequence:
   if a user already exists under a different provider with the same email
   (e.g. they signed up with Google), first Auth0 login hits `User.email`'s
   unique constraint, which surfaces through the generic catch as
   `invalidCredentials` — no account link, no distinct error. That is
   intentional per rule 5 (stay generic, never reveal whether an account
   exists), not a bug; account linking is out of scope here.

## Tests

`src/auth/auth0/auth0.service.unit.spec.ts` covers `Auth0Service.login`: new
user provisioning, an existing user matched by `auth0Id`, syncing a drifted
name/email, an unverified email, a failed `/userinfo` call, a wrong-audience
token, a wrong-issuer token, and a malformed token. Mock the `User` repository
with `getRepositoryToken(User)`, `AuthTokenService` with a plain jest object,
and stub `global.fetch`.

The rest of the module is covered too, one spec per file:

- `src/auth/jwt.strategy.unit.spec.ts` — a wrong `type` returns `null` without
  reaching the database; an unknown `uuid` throws `RequestException`; a valid
  payload returns the `User`.
- `src/auth/core/auth-token/auth-token.service.unit.spec.ts` — the signed
  payload shape and that nothing else leaks into it, plus two tests that boot
  `AuthTokenModule` and sign a real token to prove `expiresIn` is applied, and
  dropped when `ignoreExpiration` is set.
- `src/auth/google/google.service.unit.spec.ts` — both `register` and `login`
  end to end against a mocked `OAuth2Client`, and the `C5` invariant: the
  provider error's message never reaches the log, and an application-level
  rejection is not logged as a provider failure at all.
- `src/auth/google/google.strategy.unit.spec.ts` — existing user, first
  sign-in provisioning, and a repository failure reaching `done(err)`.
- `src/auth/google/google.controller.unit.spec.ts` and
  `src/auth/auth0/auth0.controller.unit.spec.ts` — delegation only; the
  controllers hold no logic and must not gain any.

Mock the `User` repository with `getRepositoryToken(User)`, and `OAuth2Client`
with a plain jest object. Name files `*.unit.spec.ts`.
The empty email provider directory and its legacy-named controller stub were
deleted (finding `R3`); there is no email/password provider to test yet.

## Reuse

Couples to `src/config-provider/`, `src/database/entities/user.entity.ts`,
`src/common/exception/` and `src/user/current-user.decorator.ts` — port those
first. `auth` depends on `database` for both `User` and `AuthType`.
`src/auth/google/` and `src/auth/auth0/` are independently droppable;
The email provider directory no longer exists — it was an empty scaffold
(finding `R3`). Email/password login is not implemented; write it yourself.
See `src/auth/README.md`'s `## Reuse` for the peer-dependency list and the
step order.

## Known gaps

See `docs/audit/2026-09-11-template-audit.md`.

- **`C2`** — ~~`jwtScope` defaults `secret` to `'Not A Safe Secret'`, so an app with
  no `JWT_SECRET` signs tokens with a public constant.~~ **Fixed on
  `fix/security-defaults`:** `secret` is `Joi.string().required()` with no
  default, so the app refuses to boot without `JWT_SECRET`.
- **`C5`** — ~~raw provider errors logged on the Google token path.~~ **Fixed on
  `fix/security-defaults`:** both catch blocks log the error's constructor name
  only, and no longer log at all when the failure is an expected
  `RequestException`.
- **`R3`** — ~~`auth.service.ts` is an empty `@Injectable()` that `AuthModule`
  still exports, alongside an empty email controller and module.~~
  **Fixed on `chore/dead-code-and-error-model`:** both deleted, and `AuthModule`
  no longer provides or exports `AuthService`.
- **`N6`** — ~~`src/auth/jwt.strategy.ts`, `src/auth/google/google.controller.ts`
  and `src/auth/google/google.service.ts` use absolute `src/...` imports, against
  invariant `T5`.~~ **Fixed on `feature/queues-decoupling`** (also tracked as
  `M1`): every specifier in those files is relative now, and
  `docs/audit/module-independence-baseline.json` records no `abs-import`
  entry at all, so `pnpm run modularity:check` fails on the next one.
- **`G1`** — ~~no tests.~~ **Fixed on `test/coverage-auth`:** every service,
  strategy and controller in the module has a spec. What is still not covered is
  the module wiring itself — `GoogleModule` and `Auth0Module` only log when
  their provider is disabled, and that log is not asserted.
