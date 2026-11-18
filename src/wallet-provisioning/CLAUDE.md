# Wallet provisioning — agent guide

> Inherits the repo-root `CLAUDE.md` (always loaded). Read it first — this file
> adds only what is specific to `src/wallet-provisioning/`.

Backend half of adding a card to Apple Wallet and Google Wallet from the app (in-app push
provisioning). The mobile half is the `expo-wallet-provisioning` package; both follow the
contract in `## Public surface`.

## Scope

Owns: the two app endpoints that fetch encrypted card data from the card processor, the
`wallet_provisioning` rows (one per attempt and token), the token state machine that applies
processor webhooks to them, and the reminder hook for an abandoned add flow.

Does not own: cards (a project's `CardResolver` says where they come from), push or email
delivery (a project's `WalletProvisioningHooks` decides), the processor (an adapter module
provides `TokenizationProvider`; `pomelo-adapter/` is the one written so far), or the entity,
which lives in `src/database/entities/wallet-provisioning.entity.ts` with every other entity.

Layout: `abstract/` holds the three contracts, the module error, the mocks and the dynamic
module; the core (controller, services, repository, `token-transitions.ts`) sits at the module
root; `pomelo-adapter/` is the processor adapter and can be deleted.

## Public surface

| Import | From | Purpose |
|---|---|---|
| `WalletProvisioningAbstractModule.forRoot({ adapter, cardResolver, hooks })` | `abstract/wallet-provisioning-abstract.module.ts` | Registered once in `src/app.module.ts`; global |
| `CardResolver`, `UnconfiguredCardResolver` | `abstract/card-resolver.ts` | Contract a project implements; placeholder that knows no cards |
| `WalletProvisioningHooks`, `NoopWalletProvisioningHooks` | `abstract/wallet-provisioning-hooks.ts` | Contract for the abandoned-flow reminder; placeholder |
| `TokenizationProvider` | `abstract/tokenization-provider.ts` | Contract a processor adapter implements |
| `TokenEventsService.apply(event)` | `token-events.service.ts` | What a processor's webhook controller calls with a `TokenEvent` |
| `WalletProvisioningService.findPaginated` | `wallet-provisioning.service.ts` | Admin listing for a project's own back office (no route) |
| `PomeloAdapterModule`, `PomeloWebhooksModule` | `pomelo-adapter/` | The Pomelo processor |

Routes (behind `AuthGuard('jwt')`, user by `uuid`):

| Route | Body | Response |
|---|---|---|
| `POST /cards/me/wallet/apple-pay` | `{ cardId?, certificates[], nonce, nonceSignature }` (base64) | `{ activationData, encryptedPassData, ephemeralPublicKey }` |
| `POST /cards/me/wallet/google-pay` | `{ cardId?, serverSessionId }` | `{ opc, googleOpc }` |

The template's `ResponseInterceptor` wraps successes as `{ success: true, data: <response> }`; the
app (and the Wallet extension template) read `data`. Errors arrive as
`{ success: false, statusCode, message }`: 400 when the card is missing, inactive or someone
else's (`WALLET_CARD_NOT_ELIGIBLE` internally; the code is not in the body), 502 when the
processor fails (`WALLET_PROVIDER_UNAVAILABLE`). Pomelo webhooks:
`POST /wallet-provisioning/webhooks/pomelo/token-lifecycle` and `.../token-notification`.

## Rules

1. **Pomelo depends on the core, never the other way.** Nothing outside `pomelo-adapter/`
   imports from it or names Pomelo. A new processor is a sibling folder with its own module
   that provides `TokenizationProvider`, its own webhook controller and its own config scope.
   `modularity:check` cannot see this (it compares top-level folders); the removability check in
   `## Tests` does.
2. **Never log or store provisioning data**: certificates, nonce, nonce signature, activation
   data, encrypted pass data, ephemeral key, OPCs, the server session id, card numbers (`T4`).
   Logs carry the card uuid or processor card id and an error code. Adapters throw
   `WalletProvisioningError` without the processor's response body: it can echo the nonce.
3. **No processor detail reaches the app.** Processor failures become a bare 502.
4. **The Google Pay call to the processor times out below 7 s** (`POMELO_REQUEST_TIMEOUT_MS`,
   default 6500, validated `< 7000`): the app gives up at 8 s and Google Wallet at 10 s.
5. **The state machine is pure and table-tested** (`token-transitions.ts`). Writes are
   compare-and-set on `(id, status, tokenExternalId)` with up to 3 attempts; the unique index
   on `tokenExternalId` settles two first events racing for a new token.
6. **Webhooks acknowledge what cannot be applied** (unknown status or event, missing ids) with
   2XX, and answer 5XX when applying fails, so the processor retries. A failing hook never
   fails the webhook.
7. `findForUser` must return only the user's own cards: a card id of another user answers the
   same 400 as a missing one.

## Tests

- `token-transitions.unit.spec.ts`: every transition (late OTP, completion after abandonment,
  abandonment only over pending rows, status reasons).
- `token-events.service.unit.spec.ts`: claiming, creating, the races and the reminder, against
  an in-memory repository with the same compare-and-set semantics.
- `wallet-provisioning.service.unit.spec.ts`: eligibility, dedupe, 400/502 and that nothing
  sensitive is logged. `wallet-provisioning.module.di.spec.ts` compiles the module with the
  three contract mocks.
- `pomelo-adapter/*.unit.spec.ts`: paths per network, timeout, auth cache, signature (constant
  time), IP allowlist, payload mapping and webhook responses.
- **Removability check** (run by hand when touching imports): in a throwaway copy, delete
  `pomelo-adapter/` and its lines in `src/app.module.ts`, register a stub adapter module, and
  run `pnpm build && pnpm test -- src/wallet-provisioning`. Both must pass.

## Reuse

Needs `src/auth/` (JWT guard, `@CurrentUser`), `src/database/` (entity, base entity),
`src/config-provider/`, `src/common/` (logger, `RequestException`). No peer packages: the
Pomelo client uses Node's `fetch`. `src/main.ts` must create the app with `rawBody: true` for
the webhook signature.

To use it, implement `CardResolver` (and usually `WalletProvisioningHooks` with a push) and pass
them to `forRoot` in place of the placeholders.

To drop Pomelo: delete `pomelo-adapter/`, its two modules and `pomeloTokenizationScope` from
`src/app.module.ts`, and the `POMELO_*` block of `.env.example`; pass another adapter module to
`forRoot`. The entity and migration stay.

To drop the whole module: delete `src/wallet-provisioning/`, the entity and its spec, its
entry in `TypeOrmModule.forFeature`, generate a migration dropping the table (`T8`), remove
its lines from `src/app.module.ts`, the `WALLET PROVISIONING` block of `.env.example`, its row
in the root `CLAUDE.md` map and `README.md` catalogue, and its `TIERS` entry in
`scripts/check-module-independence.mjs`. `rawBody` can stay.

`README.md`'s `## Reuse` is the human version of this section (`T7`).

## Known gaps

- **Visa is untested end to end.** The Visa Apple Pay path comes from an annex Pomelo sent and
  is unconfirmed; Visa on Google Pay has no path and is rejected until
  `POMELO_VISA_GOOGLE_PAY_PATH` is set.
- **One processor.** Only the Pomelo adapter exists.
- **No admin route.** `findPaginated` exists; each project's back office exposes it.
- **The Pomelo token cache is per instance**, in memory. Several instances each ask Pomelo for a
  token; fine for client credentials, but not shared.
