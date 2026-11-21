# Wallet provisioning

Lets the app add a card to **Apple Wallet** and **Google Wallet** (in-app push provisioning).
The app asks this module for the card's encrypted data; the module asks the card processor;
the wallet then talks to the card network. The processor's webhooks report what happened to
each token, and the module keeps one row per attempt and token.

Mobile side: the `expo-wallet-provisioning` package, documented in the React Native guidelines
under **Modules**. The team guide there also lists what to ask Apple, Google and the processor.

## What it does

- `POST /cards/me/wallet/apple-pay` and `POST /cards/me/wallet/google-pay` for the signed-in
  user (see `CLAUDE.md` for bodies and errors).
- Token webhooks (Pomelo: `token-lifecycle` and `token-notification`) applied to a state
  machine: requested → OTP → activated / suspended / disabled / inactive, abandoned, failed.
- When a user leaves the add flow unfinished, calls `onProvisioningAbandoned` so the project can
  send a reminder push (Apple asks for it).

## Configuration

| Variable                                                                         | Default        | Notes                                                                              |
| -------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------- |
| `WALLET_PROVISIONING_DEDUPE_SECONDS`                                             | 60             | Repeated requests share one attempt row                                            |
| `WALLET_PROVISIONING_CLAIM_WINDOW_MINUTES`                                       | 30             | How old an attempt a webhook can claim                                             |
| `POMELO_BASE_URL`, `POMELO_CLIENT_ID`, `POMELO_CLIENT_SECRET`, `POMELO_AUDIENCE` | —              | Pomelo API credentials                                                             |
| `POMELO_WEBHOOK_API_SECRET`                                                      | —              | Base64, the same secret as Pomelo's transaction webhooks                           |
| `POMELO_ALLOWED_IPS`                                                             | blank          | Comma-separated IPs (each one validated at boot); blank skips the IP check         |
| `POMELO_REQUEST_TIMEOUT_MS`                                                      | 6500           | Must stay below 7000                                                               |
| `POMELO_*_PATH`                                                                  | Pomelo's paths | Visa paths are unconfirmed; Visa on Google Pay needs `POMELO_VISA_GOOGLE_PAY_PATH` |

Register the Pomelo webhook URLs with Pomelo:
`https://<host>/wallet-provisioning/webhooks/pomelo/token-lifecycle` and
`https://<host>/wallet-provisioning/webhooks/pomelo/token-notification`.

## Running it

As shipped, the module boots with `UnconfiguredCardResolver`: every request answers 400
because the template has no cards. A project replaces it:

```ts
@Injectable()
export class MyCardResolver extends CardResolver {
  constructor(private readonly cards: CardsRepository) { super(); }
  async findForUser(userUuid: string, cardUuid?: string): Promise<ResolvedCard | null> { /* the user's card */ }
  async findByExternalId(externalId: string): Promise<OwnedCard | null> { /* card + owner */ }
}

WalletProvisioningAbstractModule.forRoot({
  adapter: PomeloAdapterModule,
  cardResolver: MyCardResolver,
  hooks: MyWalletHooks, // e.g. sends a push through PushNotificationService
}),
PomeloWebhooksModule,
```

## Reuse

Lifts with `src/auth/`, `src/database/` (the entity and its migration), `src/config-provider/`
and `src/common/`. No extra npm packages. `src/main.ts` must keep `rawBody: true` (the
webhook signature is computed over the raw body).

### Dropping Pomelo

1. Delete `src/wallet-provisioning/pomelo-adapter/`.
2. In `src/app.module.ts`, remove `PomeloAdapterModule`, `PomeloWebhooksModule` and
   `pomeloTokenizationScope`, and pass your processor's adapter module to `forRoot`.
3. Delete the `POMELO_*` lines from `.env.example`.

The entity, the migration and every other file stay.

### Deleting the module

1. Delete `src/wallet-provisioning/`, `src/database/entities/wallet-provisioning.entity.ts`
   and its spec, and remove `WalletProvisioning` from `TypeOrmModule.forFeature` in
   `src/database/database.module.ts`.
2. Generate a migration that drops the `wallet_provisioning` table.
3. Remove its lines from `src/app.module.ts` and the `WALLET PROVISIONING` block of
   `.env.example`.
4. Remove its row from the module map in the root `CLAUDE.md`, the catalogue in the root
   `README.md`, and `TIERS` in `scripts/check-module-independence.mjs`.

Then `pnpm run docs:check && pnpm run modularity:check && pnpm test`. `CLAUDE.md` carries the
same lists.
