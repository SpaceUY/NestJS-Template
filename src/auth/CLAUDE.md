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
| `AuthType` | `src/auth/core/auth-type.enum.ts` | `EMAIL` / `GOOGLE` / `AUTH0`; stored on `User.authType` |
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
`auth0Scope` reads `AUTH0_ENABLED`, `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`,
`AUTH0_ISSUER` and `AUTH0_JWKS_URI`; when `enabled` is true `domain` and
`audience` become required, and `issuer`/`jwksUri` derive from `domain` when
unset (`https://<domain>/` and `https://<domain>/.well-known/jwks.json`).

All three are registered in the `scopes` array in `src/app.module.ts`.

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

## Tests

`src/auth/auth0/auth0.service.unit.spec.ts` covers `Auth0Service.login`: new
user provisioning, an existing user matched by `auth0Id`, syncing a drifted
name/email, an unverified email, a failed `/userinfo` call, a wrong-audience
token, a wrong-issuer token, and a malformed token. Mock the `User` repository
with `getRepositoryToken(User)`, `AuthTokenService` with a plain jest object,
and stub `global.fetch`.

The rest of the module is still untested (finding `G1`). What new tests must
cover:

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
`passport-google-oauth20`, `google-auth-library`, `ms`. `src/auth/auth0/` adds
none — it calls Auth0's `/userinfo` with the runtime's built-in `fetch`.

Drop `src/auth/google/` or `src/auth/auth0/` entirely for a project not using
that provider; nothing else in the module references either one except the
import in `src/auth/auth.module.ts`.

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
