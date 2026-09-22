# Auth — human guide

> The agent-facing rules and boundaries live in [`src/auth/CLAUDE.md`](./CLAUDE.md).
> This file is the recipe: what the module actually does today, how to
> configure and call each provider, and what it costs to lift into another
> project.

JWT-based authentication for the template. Two providers ship implemented,
`src/auth/google/` and `src/auth/auth0/` — see the table below. Whichever provider a user
logs in through, the flow ends the same way: a call to
`AuthTokenService.generateAuthToken` that returns the app's own JWT, and every
other module protects a route the same way afterward, with `AuthGuard('jwt')`.

**Before you lift this module:** one of its three provider directories is an
empty scaffold, not working code, and the other two are independently
optional. See [`## Reuse`](#reuse) below for what actually needs to travel
with it.

## Provider status

| Provider | Endpoint(s) | State |
|---|---|---|
| Google OAuth | `GET /auth/google/web`, `GET /auth/google/callback`, `POST /auth/google/mobile/register`, `POST /auth/google/mobile/login` | Implemented — 404 while `GOOGLE_OAUTH_ENABLED=false` |
| Auth0 | `POST /auth/auth0/login` | Implemented — 404 while `AUTH0_ENABLED=false` |
| Email | none | **Not implemented, and no scaffold either** — deliberately, rather than leaving empty files that look like a starting point. `AuthType.EMAIL` is still the `User.authType` default, but no code path issues a token for it: write the login/registration flow yourself. |

## Configuration

`jwtScope` (`src/auth/config/jwt.scope.ts`): `JWT_SECRET` — **required, with
no default. The app refuses to start without it.** `JWT_EXPIRES_IN` (default
`7d`), `JWT_IGNORE_EXPIRATION` (default `false`).

`googleScope` (`src/auth/google/config/google.scope.ts`): `GOOGLE_OAUTH_ENABLED`
(default `false`). When `true`, `GOOGLE_OAUTH_CLIENT_ID`,
`GOOGLE_OAUTH_CLIENT_SECRET` and `GOOGLE_OAUTH_AUDIENCE` become required.
`GOOGLE_OAUTH_CALLBACK_URL` defaults to `${SELF_URL}/auth/google/callback`
when unset (`SELF_URL` itself defaults to `http://localhost:5000`).

`auth0Scope` (`src/auth/auth0/config/auth0.scope.ts`): `AUTH0_ENABLED`
(default `false`). When `true`, `AUTH0_DOMAIN` and `AUTH0_AUDIENCE` become
required. `AUTH0_ISSUER` defaults to `https://<AUTH0_DOMAIN>/` when unset.

All three scopes are registered once, in the `scopes` array in
`src/app.module.ts`.

## Turning a provider off

Set `GOOGLE_OAUTH_ENABLED=false` or `AUTH0_ENABLED=false` and leave the rest of
that provider's variables empty. The application starts, and for that provider:

- every route answers **404**, as if it had never been written;
- nothing that needs a credential is built — in Google's case the Passport
  strategy is never constructed, which is what used to take the whole
  application down at boot with `OAuth2Strategy requires a clientID option`;
- one `warn` line at startup says the provider is off.

Two things the flag does not do. The paths are still *mapped* — they answer
404 rather than not existing — so they remain in the Swagger document; and the
provider's module is still in the dependency graph. Neither is fixable from a
config flag: the value is read asynchronously, after NestJS has already
collected every controller in the application. To make a provider disappear
entirely, drop it — see [`## Reuse`](#reuse) below, *Dropping a provider*.

`JWT_*` is unaffected by either flag. `AuthGuard('jwt')`, `AuthTokenService`
and every protected route in the application keep working with both providers
off; you simply have no way to issue a token until you add a login flow of
your own.

## Using Google OAuth

**Web.** `GET /auth/google/web` starts the Passport `'google'` handshake —
`src/auth/google/google.strategy.ts` requests the `email` and `profile`
scopes. Google redirects back to `GET /auth/google/callback`, where
`GoogleStrategy.validate` finds or creates the `User` by email, and the
controller returns the JWT as a plain string response body via
`AuthTokenService.generateAuthToken`.

**Mobile.** The client obtains a Google ID token itself (the native Google
Sign-In SDK) and calls `POST /auth/google/mobile/register` (first time) or
`POST /auth/google/mobile/login` (afterward) with `{ "idToken": "..." }` in
the body. `GoogleService` verifies the ID token against `GOOGLE_OAUTH_AUDIENCE`
or `GOOGLE_OAUTH_CLIENT_ID`, then either creates a new `User` — `register`,
rejecting one that already exists — or looks one up by email and requires
`authType === GOOGLE` — `login`, rejecting a user who signed up through a
different provider. Both paths return the app's JWT the same way the web
callback does.

## Using Auth0

The client obtains its own access token from Auth0 directly (Universal Login,
an SPA SDK, etc.), **requesting `AUTH0_AUDIENCE` as the token's `audience`** —
without it, Auth0 issues an opaque access token instead of a JWT, and login
always fails with the same generic error. It then calls
`POST /auth/auth0/login` with `{ "accessToken": "..." }` in the body
(`Auth0LoginDto`).

`Auth0Service.login` calls Auth0's own `/userinfo` endpoint with the token — a
request that fails for anything invalid, expired or revoked — then checks the
token's `iss`/`aud` claims against `auth0Scope`'s configured `issuer` and
`audience` to reject a token minted for a different application on the same
tenant. It also rejects an unverified email
(`userInfo.email_verified === false`), then finds or creates the `User` by
`auth0Id` — syncing `email`/`name` if they drifted — and returns the app's
JWT. There is no separate register step: Auth0's own Universal Login already
covers sign-up.

One consequence worth knowing before wiring a client: if a user already
exists under a different provider with the same email (e.g. they signed up
through Google), the first Auth0 login for that email hits `User.email`'s
unique constraint and surfaces as the generic `invalidCredentials` error — by
design (auth failures never reveal whether an account exists), not a bug, and
there is no account-linking here.

## Protecting a route

Import `AuthModule` — it re-exports `PassportModule`, so `AuthGuard('jwt')`
resolves — and guard the route with `AuthGuard('jwt')` plus `@ApiBearerAuth()`.
See `src/auth/CLAUDE.md`'s Rule 1 for the exact shape. `JwtStrategy.validate`
(`src/auth/jwt.strategy.ts`) loads the `User` by the `uuid` carried in the
token's `userId` claim and rejects any token whose `type` claim isn't
`'auth'`.

## Reuse

**Two supported workflows.** Clone the template whole, or lift only the modules
you need — this one is written for both. What follows is the second case: what
`src/auth/` needs in order to compile in another project.

**What to port first.** `src/config-provider/` (both scopes it defines and
uses), `src/database/entities/user.entity.ts` (the `User` shape, `uuid`,
`authType`), `src/common/exception/` (`RequestException`, `Exceptions.auth.*`)
and `src/common/observability/logger/`. `src/auth/` will not compile until
those four exist in the target project.

The logger is the cheap one: every use of it here is `@Optional()`, so the
module boots whether or not the target project registers
`LoggerAbstractModule` — but the import has to resolve, so the files travel. `CurrentUser` travels inside the module —
`src/auth/decorators/current-user.decorator.ts` — so there is nothing to port
for it.

**Peer dependencies.**

```bash
pnpm add @nestjs/jwt @nestjs/passport passport passport-jwt passport-google-oauth20 google-auth-library ms joi class-validator
```

`src/auth/auth0/` adds none of its own — it calls Auth0's `/userinfo` with the
runtime's built-in `fetch`, not an SDK.

**Dropping a provider.** `src/auth/google/` and `src/auth/auth0/` are
independent of each other; drop either directory and remove its import from
`src/auth/auth.module.ts` — nothing else in the module references either one.
This is the real removal; the `ENABLED` flag above is the runtime switch, and
it cannot unmap the routes on its own.
Dropping both leaves only the JWT core (`AuthTokenService`, `JwtStrategy`);
at that point you still need to write your own login endpoint before this
module authenticates anyone.

## Known gaps

See `src/auth/CLAUDE.md`'s `## Known gaps`.
