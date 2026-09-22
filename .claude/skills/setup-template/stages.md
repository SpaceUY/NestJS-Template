# The fourteen stages

One stage per message. Ask with `AskUserQuestion`, recommended option first,
and record the answer in the setup sheet. Write nothing to the repository
before stage 14.

Each stage below gives the question, the options, what each answer resolves to,
and what to check before moving on. **Plain:** is the same question with the
jargon taken out — use it verbatim when explain-mode is on, and as the
explanation when someone picks "I don't know" at any other time.

Every stage's option list ends with **"No sé qué es esto / I don't know —
explain it"**. `SKILL.md` says what to do when it is picked: explain, say what
you would choose, ask again, and offer to park it if they still cannot answer.

---

## 1. Preflight

Establish the ground first, then ask the one question that sets the tone for
the other thirteen.

```bash
node -v && pnpm -v          # Node 24.15.0, pnpm 10.15.1 — never npm or yarn
pnpm install
ls .env 2>/dev/null || echo "no .env"
```

If `.env` is missing, say you will create it from `.env.example` at stage 14 —
do not copy it yet. If `.env` already exists, read it: its current values become
the recommended option at every later stage, and the developer is configuring an
existing project rather than a fresh clone.

Then say what the wizard will cover — the thirteen decisions in the stage index
— and ask:

> **How much should I explain as we go?**
>
> - **Explain each decision first** — what it is, what changes, what I'd pick.
>   Slower, and you can answer everything without knowing the codebase.
> - **Just the questions** — you know this stack; I'll keep it terse and use
>   the config key names directly.
> - **Somewhere in between** — terse by default, and I explain whenever you ask.

Recommend the first. It costs a few extra lines per stage and it is the
difference between a wizard a product manager can finish and one they abandon
at stage 5.

This setting is not permanent: "explicame esto" at any stage switches it on for
that stage, and "dale, más corto" switches it off. Honour both immediately.

Record the answer in the sheet — if the session is interrupted, the register is
part of what you resume.

---

## 2. Deployment topology

The first real decision, and the one most other defaults hang off. It is about
what sits in front of the process, because that is what decides whether
`req.ip` is the client or a proxy.

**Plain:** when someone uses the app, does their request arrive here directly,
or does it pass through something else first? The app has to know, because
otherwise it cannot tell one visitor from another — it either counts everybody
as the same person, or lets anyone claim to be somebody else.

> **Where will this run?**
>
> - **Behind a load balancer** — ECS, Elastic Beanstalk, an ALB, nginx,
>   Cloudflare. The app never sees the client directly.
> - **Directly on an instance** — an EC2 box with an elastic IP, a VPS. Clients
>   connect to this process.
> - **Local development only** — for now; this can be re-run later.

**Behind a load balancer** → `TRUST_PROXY=<hop count>`. One ALB is `1`; a
CDN in front of an ALB is `2`. A specific address or CIDR list is also accepted
— ask which shape they want if they know their topology precisely, otherwise
recommend the hop count. Ask the follow-up:

> **How many application instances?** One, or several behind that balancer?

*Several* matters: the throttler's counters live in this process's memory, so N
instances allow N times the configured limit. Say that plainly and offer three
ways out, in the order they are usually right:

1. Accept it, and set `RATE_LIMIT_LIMIT` to the per-instance share you actually
   want. Simplest, and the effective ceiling is still finite.
2. Rate-limit in front of the app instead — ALB rules, a WAF, an API gateway —
   and set `RATE_LIMIT_ENABLED=false`. The guard stays bound and never blocks,
   which is the explicit off switch rather than a silent one.
3. Pass a shared `storage` to `ThrottlerModule.forRootAsync` in
   `src/app.module.ts`, backed by the Redis this template already runs. Exact
   across instances, at the cost of a Redis round trip on the request path.
   This is the only answer that edits code, so record it as a code edit for
   stage 14.

**Directly on an instance** → leave `TRUST_PROXY` commented out. Say why,
because it reads backwards: with it on and no proxy in front, any client can
send `X-Forwarded-For: 1.2.3.4` and decide what `req.ip` returns — which is also
what the rate limiter keys on, so a client can hand itself a fresh bucket per
request. Off is not a weaker setting here, it is the correct one.

**Local development only** → same as directly on an instance, and note in the
sheet that stage 4 should keep `NODE_ENV=DEV`.

### What this stage does *not* ask, and should say once

The security headers need no decision. `src/main.ts` applies `helmet()` with its
defaults, first in the middleware stack, so every response carries them —
including the Swagger page, which `src/swagger.bootstrap.unit.spec.ts` boots and
checks against the emitted policy. Nothing is relaxed and nothing needs to be.

Two consequences do follow from this stage's answer, though, and are worth one
line each:

- `upgrade-insecure-requests` is on, so TLS should terminate at the load
  balancer even for a staging host served over plain HTTP.
- `connect-src` falls back to `default-src 'self'`, so Swagger's "Try it out"
  reaches this API and no other. If the document ever gains a `.addServer()`
  pointing elsewhere, that host has to be added to the directive.

---

## 3. Rate limiting

**Plain:** how many requests may one person make before the app starts refusing
them? This is the brake that stops somebody hammering the login page with a
list of stolen passwords. Too tight and real users hit it; too loose and it is
not a brake.

> **What allowance should a client get?** The window and the number of requests
> in it, per client.

Recommend the shipped `60000` ms / `100` requests and say what they are for: a
ceiling on abuse, not a quota. A browser session or a polling dashboard stays
well under them; credential stuffing against the public auth routes does not.

Resolves to `RATE_LIMIT_TTL_MS` and `RATE_LIMIT_LIMIT`. Neither may be `0` —
the scope rejects it, because `0` would either lock the API out or disable the
guard while leaving it registered.

If stage 2 chose option 2 (rate-limit in front), add `RATE_LIMIT_ENABLED=false`
and say the limits above become documentation of the ALB's rules rather than
the app's.

The health endpoints are exempt either way, via `skipUnthrottledPath` — without
that, a load balancer reads the `429` it caused and takes healthy instances out
of rotation.

---

## 4. Public surface

**Plain:** a handful of things about how the app is reached from outside — is
this the real deployment or a test one, what address it answers on, which
websites are allowed to call it, and whether the interactive API documentation
page is published for anyone who finds it.

Five values, one message. Recommend the `.env.example` defaults and ask for the
ones only the developer knows.

| Key | Ask | Note |
|---|---|---|
| `NODE_ENV` | `DEV`, `TEST` or `PROD` | Drives the CORS and Swagger rules below |
| `PORT` | default `5000` | Must be 1024-65535 |
| `SELF_URL` | the app's own public URL | Google OAuth derives its callback from it |
| `CORS_ORIGINS` | comma-separated allowlist | **Required** and never `*` when `NODE_ENV=PROD` |
| `SWAGGER_ENABLED` | leave unset unless asked for | Defaults to off in `PROD`, on elsewhere |

Say the Swagger rule out loud if they want docs on a prod-like environment: set
the flag, do not lie about `NODE_ENV` — that would silently re-allow a wildcard
`CORS_ORIGINS`.

---

## 5. Database

**Plain:** where the database lives and how to log into it. Either one long
connection string or the five pieces listed separately — the same information,
two spellings. If you do not have it, this is the most common thing to park.

> **How is the connection configured?** A single `DATABASE_URL`, or the five
> discrete `DB_*` keys?

The URL wins when both are present. With neither form complete the app throws at
startup — `src/database/database.module.ts` — rather than booting without a
database.

Then ask for the values. The ones in `.env.example` are what
`docker-compose.yml` creates, so they are the right recommendation for a local
setup and the wrong one for anything else.

`DB_SYNCHRONIZE` stays `false`. Offer `true` only if the answer to stage 2 was
local-only, and say it is local development only. `DB_LOGGING` is `true` locally
and usually `false` in production.

Close the stage by saying the schema comes from migrations, generated by the
CLI:

```bash
pnpm run db:migration:run                                  # on a fresh database
pnpm run db:migration:generate src/database/migrations/<Name>
```

No `--` before that path — pnpm 10 consumes it and TypeORM then fails with
`Not enough non-option arguments`.

---

## 6. Auth

**Plain:** how people prove who they are. When someone logs in the app hands
them a signed pass, and that signature needs a secret nobody else has — I can
generate one. Then: do you also want a "log in with Google" button, or an
Auth0 account?

Three questions, asked together because they share a block.

**JWT.** `JWT_SECRET` is the one key `.env.example` ships blank on purpose: with
no value the app refuses to boot rather than sign tokens with a shared constant.
Offer to generate it:

```bash
printf 'JWT_SECRET=%s\n' "$(openssl rand -base64 48)" >> .env    # at stage 14
```

Generate it **into `.env`**. Do not print it, do not put it in `.env.example`,
do not let it reach a commit. `JWT_EXPIRES_IN` defaults to `7d`;
`JWT_IGNORE_EXPIRATION` stays `false`.

**Google OAuth.** Off by default — with `GOOGLE_OAUTH_ENABLED=false` the
strategy is never constructed and every `/auth/google` route answers 404.
Turning it on makes `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` and
`GOOGLE_OAUTH_AUDIENCE` required — the app will not boot without them.
`GOOGLE_OAUTH_CALLBACK_URL` is optional; absent, it derives
`${SELF_URL}/auth/google/callback`, which is why stage 4 asked for `SELF_URL`.

**Auth0.** Same shape. `AUTH0_DOMAIN` and `AUTH0_AUDIENCE` are required when
`AUTH0_ENABLED=true`; `AUTH0_ISSUER` derives `https://${AUTH0_DOMAIN}/`.

Say once, before moving on, what this module does not give them: there is no
email/password login and no refresh or revocation flow. A project that needs
either writes it. `src/auth/CLAUDE.md` has the detail.

---

## 7. Redis, cache and queues

**Plain:** Redis is a fast scratch memory the app keeps beside it. Here it does
two jobs: it remembers recent answers so they are not recomputed on every
visit, and it holds the list of work to do later, like sending an email without
making the user wait for it. As the template ships, the app expects it to be
running.

> **Does this project need Redis?** It backs two things here — the cache and
> the BullMQ job queues — and `src/app.module.ts` registers both
> unconditionally, so as it ships the app expects Redis reachable at runtime.

**Keep it** → ask for `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`. The password
is one of the nine keys where blank is legal; the compose container has none.

**Drop one or both** → this is a module removal, three edits each: the
registration in `src/app.module.ts`, the scope in that file's `scopes` array,
the keys in `.env.example`. `src/redis.scope.ts` is shared, so it goes only when
both have. Two consequences to name:

- Removing `cache` leaves `src/health/` without its cache probe. Delete
  `src/cache/abstract/` only after dropping `cache.health-indicator.ts`, its
  spec and the `isConfigured()` branch in the controller — the injection is
  `@Optional()`, but the import still has to resolve.
- Removing `queues` while `src/spaceship/` is still present does not compile.
  Stage 13 removes it; if they are dropping queues, do stage 13 first.

`RABBITMQ_URL` stays or goes with `queues`. The RabbitMQ and SQS adapters ship
complete but unwired — only BullMQ is registered, deliberately, since three
brokers at once means three live connections for one queue.
`src/queues/README.md`'s *Switching the template's broker* has the edit.

---

## 8. Email

**Plain:** does the app need to send real emails yet — a welcome message, a
password reset? Until it does, it can print them to the log instead, which
needs no account and no keys and is the right answer while you are building.

Four adapters exist, which is one too many for a single question. Ask the
coarse one first:

> **Does this project send real email yet?**
>
> - **Not yet** — print messages to the log instead.
> - **Yes, through AWS** — SES, using the same AWS credentials as file storage.
> - **Yes, through a mail service** — SendGrid or Resend.

`Not yet` is `EMAIL_ADAPTER=CONSOLE`: it logs the message instead of sending it
and needs nothing else, not even `EMAIL_FROM`. `Yes, through a mail service`
takes a follow-up for which of the two.

Any adapter other than `CONSOLE` makes `EMAIL_FROM` and that provider's
credential **required**:
the app refuses to boot without them and the error names the missing variable.

| Adapter | Also required |
|---|---|
| `SENDGRID` | `SENDGRID_API_KEY` |
| `RESEND` | `RESEND_API_KEY`; `RESEND_EMAIL_FROM` optionally overrides `EMAIL_FROM` |
| `AWS_SES` | `AWS_SES_REGION`, plus `AWS_ACCESS_KEY` and `AWS_SECRET_ACCESS_KEY` from the S3 block — the SES adapter builds its client with an explicit credentials object and never falls back to the ambient AWS chain |

Do not fill a credential with a plausible placeholder. It passes validation and
fails at the first send, which is exactly what the check exists to prevent — ask,
or leave the adapter on `CONSOLE` until they have the key.

If they pick `AWS_SES`, say that adapter re-throws the raw AWS SDK rejection
instead of translating it into the module's error type. A caller that catches
`EmailError` will not catch that one.

---

## 9. Cloud storage

**Plain:** does the app need to keep files people upload — photos, PDFs,
attachments? They go to Amazon S3, which needs an account. Nothing breaks if
you say no now: the app only complains the first time something actually tries
to upload.

> **Does this project upload files to S3?**

**No** → leave the whole block commented, as it ships, or remove the module.
Leaving it is cheap: the S3 client is built on first use, so an unconfigured
block costs a `CLOUD_STORAGE_NOT_CONFIGURED` error on the first upload rather
than a boot failure.

**Yes** → `AWS_S3_BUCKET_NAME`, `AWS_REGION`, `AWS_ACCESS_KEY`,
`AWS_SECRET_ACCESS_KEY`, `AWS_S3_EXPIRES_IN_SECONDS`. Blank is **not** the same
as absent in this scope: `AWS_ACCESS_KEY=` fails validation even though the
email scope tolerates the same key blank. Comment it out or give it a value.

Either way, ask the second question — it is the one that gets missed:

> **Keep the default upload controller?** `useDefaultController: true` in
> `src/app.module.ts` mounts `POST /cloud-storage`, `GET /cloud-storage/:fileKey`
> and `DELETE /cloud-storage/:fileKey`, and this template binds no global
> authentication guard. As wired, those three routes are open to anyone who can
> reach the app, rate-limited and nothing more.

Recommend `useDefaultController: false` for anything public-facing, with the
project mounting its own guarded controller. If they keep it, record that the
routes need a guard before the app is exposed and say so again at the submit.

---

## 10. Push notifications

**Plain:** does the app need to send the notifications that pop up on a phone's
screen? This goes through Expo, which is the usual route for a React Native
app. No mobile app, no need for this.

> **Does this project send push notifications through Expo?**

**No** → remove the module. Nothing else imports it, so it is the three standard
edits.

**Yes** → `EXPO_ACCESS_TOKEN` is optional; Expo accepts unauthenticated sends at
a lower rate limit. The key ships commented because a blank value is rejected —
absent is fine, `=` is not.

Same second question as stage 9, and the same answer: `useDefaultController:
true` mounts `POST /push-notification/:token/send`, which sends a notification to
any device token in the URL, with no guard in front of it. It exists for testing.
Recommend turning it off for any deployed environment.

One thing to say while they decide: a push token is a credential, and
`src/push-notification/CLAUDE.md` records where provider prose can reach a log
line. Delivery here is best-effort — a failed send is not retried.

---

## 11. Analytics

**Plain:** does the app need to record what people do in it — signed up,
clicked, bought — so someone can look at that later? It either sends those to
PostHog, or prints them to the log until somebody sets up an account.

> **Where do product events go?** `CONSOLE` or `POSTHOG`.

`CONSOLE` logs events instead of sending them. `POSTHOG` requires
`POSTHOG_API_KEY`; `POSTHOG_HOST` defaults to `https://us.i.posthog.com`.

Capture is fire-and-forget by design — this module ships no error type, so a
failed send does not surface to the caller. Say that if they pick `POSTHOG`, so
nobody waits for an error that will not come.

Not needed at all? Three edits, like any other adapter module.

---

## 12. Observability

**Plain:** tracing records how long each request spent in each part of the app,
so that when something is slow you can see where instead of guessing. It needs
somewhere to send those recordings. Without one, tracing is simply off and
nothing else changes — this is a safe park.

> **Is there an OTLP collector to send traces to?**

**Yes** → `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_SERVICE_NAME`. The default
points at the Jaeger container in `docker-compose.yml`, UI on
`http://localhost:16686`. `OTEL_EXPORTER_OTLP_HEADERS` stays commented unless
they need it — a blank value throws on the first line of `src/main.ts`, before
Nest starts.

**No** → leave `OTEL_EXPORTER_OTLP_ENDPOINT` unset and tracing is off.

These three are the one deliberate exception to reading `process.env` directly:
the tracing bootstrap runs before Nest's DI container exists. Tracing is
all-or-nothing process-wide — there is no per-module switch.

---

## 13. Reference domain module

**Plain:** the template ships with one small worked example — a "spaceship"
feature with its own screen's worth of endpoints, its own database table and a
background email. It is there to show how the pieces fit, and it is written to
be thrown away. Keep it while people are learning the codebase; delete it
before the project ships.

> **Keep `src/spaceship/`?** It is the worked example — an entity, a controller,
> a cache-aside read, a queued email — written to be deleted. It imports nine of
> the other directories.

**Delete it** → follow the seven-step checklist in `src/spaceship/README.md`'s
*Deleting it*. It is longer than three edits because the module owns an entity,
two config scopes and an email template. Step 3 generates a migration that drops
the table; that is a CLI migration like any other, and it needs a reachable
database, so flag it as a developer task if the database is not up.

**Keep it** → `NOTIFICATION_EMPLOYEE_EMAILS` (blank is valid and means "notify
nobody" — the job logs a warning and returns) and
`SPACESHIP_LIST_CACHE_TTL_SECONDS`.

Deleting it is what frees `auth`, `email`, `queues`, `templates`, `templating`
and `cache` to come out on their own. If any earlier stage chose to remove one
of those, this stage runs before it at the submit — order the edits accordingly.

---

## 14. Submit

The only stage that writes. Follow the submit contract in `SKILL.md`: show the
resolved `.env`, the file edits, the deletions and what is left to someone
else; ask once; then apply, run the five gates, and report each result.

**Write the summary in the register stage 1 established.** Someone who needed
every stage explained will not read a list of environment keys, and a confirm
step nobody understands is not a confirm step. In explain-mode, describe each
group of changes in one plain sentence — "emails will be printed to the log
instead of sent" — with the keys underneath for whoever reads it later.

**The parked list is the most important part of the summary for a
non-technical run,** and it goes above the file edits, not in a footnote. One
line each: what was asked, what is in place meanwhile, and what happens if
nobody comes back to it. If every stage was parked, say so plainly — the run
still produced a working local configuration and a clear handoff, which is a
success, not a failure.

Two things to repeat at the top, if they apply, because they are the ones that
become someone else's incident:

- default controllers kept without a guard (stages 9 and 10) — in plain terms,
  "anyone who can reach this app can upload files to it";
- `RATE_LIMIT_ENABLED=false` with nothing in front actually rate-limiting — "no
  limit on how fast someone can hammer this".

After the gates pass, boot the app once against its real dependencies if the
wizard changed any wiring in `src/app.module.ts`. A green `test:cov` mocks
exactly the layer these edits touch.
