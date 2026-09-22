---
name: setup-template
description: Configure a clone of this NestJS template — deployment topology, rate limiting, database, auth and each optional module — one decision at a time, applying nothing until a final submit.
disable-model-invocation: true
---

# Setting up the template for a new project

Turns a clone of this template into a configured project by asking one decision
at a time, and applying nothing until the person running it submits.

Whoever is running it: a backend developer who knows every key by name, and
someone who has never opened this repository, are both expected users. The
protocol below is written so the same fourteen questions serve both.

## The protocol

1. **One stage per message.** Ask the stage's question with `AskUserQuestion`,
   recommended option first. Never bundle two stages into one message. Ask in
   whatever language the person is writing in.
2. **Nothing is written to the repo before stage 14.** Not `.env`, not
   `src/app.module.ts`, not a deleted directory. Reading and running
   `pnpm install` are fine; changing tracked files is not.
3. **Keep a setup sheet** in the scratchpad directory — one line per answered
   stage, with the exact keys and values the answer resolves to. It is what
   stage 14 applies and what you resume from if the session is interrupted.
4. **Never invent a value.** A hostname, a bucket name, an API key or an origin
   list that the developer has not given you is a question, not a default.
   Defaults that live in `.env.example` are not inventions — offer them as the
   recommended option and say they come from that file.
5. **Skipping is an answer.** Every stage offers "leave as it ships" or "remove
   this module". Record which one.
6. **Every question carries a way out.** See below — it is not optional, and it
   is what makes the wizard usable by someone who is not a backend developer.

`stages.md` in this directory holds the fourteen stages: the question, its
plain-language framing, the options, what each answer resolves to, and what to
verify afterwards. Read it when the person starts the wizard, not before.

## Nobody has to already know the answer

Stage 1 asks how much explaining to do, and that setting holds for the whole
run. Independently of it, **every** question offers this as its last option:

> **No sé qué es esto / I don't know — explain it**

Picking it is not an error and not a detour. Answer it like this:

1. **Say what the thing is** in two or three sentences, with no jargon and no
   config keys. "Rate limiting" is "how many requests one person can make
   before the app starts refusing them, so nobody can hammer it."
2. **Say what actually changes** between the options, in consequences the
   person can judge: what breaks, what it costs, what someone would notice.
   Not "sets `TRUST_PROXY`" — "without this, the app thinks every visitor is
   the same visitor."
3. **Say which one you would pick and why**, in one sentence.
4. **Ask the same question again.** Do not decide for them and move on.

If they still cannot answer after that, the question is not theirs to answer.
Offer to **park it**: record the stage as pending, keep the shipped default in
the sheet, and carry on. Parked stages are listed on their own at the submit,
as the handoff for whoever does know. A wizard that stalls at stage 5 because
someone does not have the database URL is worse than one that finishes with
three things marked pending.

The option also covers "I want to talk about this first". Treat any answer that
is a question as that option — explain, discuss for as long as they want, then
re-ask.

**Keep the option list to three substantive choices plus that one.** Four real
options and an escape hatch does not fit, and a stage with four is a stage with
a missing first question — ask the coarse one ("do you already have a mail
provider?") and put the detail in the follow-up.

**When explain-mode is on,** lead with two or three sentences of context before
the question, every stage, without being asked. Keep the config key names out
of the question and in the setup sheet, where they belong.

## Stage index

| # | Stage | Decides |
|---|---|---|
| 1 | Preflight | toolchain, `.env`, containers, and how much to explain |
| 2 | Deployment topology | `TRUST_PROXY`, and what security headers depend on it |
| 3 | Rate limiting | `RATE_LIMIT_TTL_MS`, `RATE_LIMIT_LIMIT`, `RATE_LIMIT_ENABLED` |
| 4 | Public surface | `NODE_ENV`, `PORT`, `SELF_URL`, `CORS_ORIGINS`, `SWAGGER_ENABLED` |
| 5 | Database | `DATABASE_URL` or `DB_*`, `DB_SYNCHRONIZE`, `DB_LOGGING` |
| 6 | Auth | `JWT_*`, Google OAuth, Auth0 |
| 7 | Redis, cache and queues | `REDIS_*`, or removal of `cache` / `queues` |
| 8 | Email | `EMAIL_ADAPTER` and that provider's credential |
| 9 | Cloud storage | the S3 block, or removal of `cloud-storage` |
| 10 | Push notifications | `EXPO_ACCESS_TOKEN`, or removal of `push-notification` |
| 11 | Analytics | `ANALYTICS_ADAPTER`, or removal of `analytics` |
| 12 | Observability | `OTEL_*` |
| 13 | Reference domain module | keep or delete `src/spaceship/` |
| 14 | **Submit** | one confirmation, then everything is applied |

## The submit

Stage 14 is the only stage that changes the repository. Present, in this order:

1. **The resolved `.env`,** every key with its value, secrets shown as
   `<generated, written to .env>` and never printed.
2. **The file edits,** each as `path — what changes`. Module removals are
   three edits each: the registration in `src/app.module.ts`, its scope in that
   file's `scopes` array, its keys in `.env.example`.
3. **The deletions,** directory by directory.
4. **What is left to someone else** — every parked stage, each as "what was
   asked, what default is in place meanwhile, and what breaks if nobody
   revisits it" — plus a migration to generate or a credential they said they
   would fill in later. This is the handoff list; write it so the person
   reading it was not in the conversation.

Then ask once: apply, go back to a stage, or abort. On "apply", make the edits,
then run the five gates and report each result:

```bash
pnpm run docs:check
pnpm run modularity:check
pnpm run lint:ci
pnpm run test:cov
pnpm run build
```

A module removal that leaves `modularity:check` red means the removal order was
wrong, not that the check is. Fix it before reporting done.

## Rules that hold in every stage

- **Secrets go to `.env` and nowhere else.** `.env` is gitignored; `.env.example`
  is not. Generate `JWT_SECRET` into `.env` with `openssl rand -base64 48`
  redirected there — do not print it, do not put it in `.env.example`, do not
  let it reach a commit or a log line.
- **A blank value is a value.** `KEY=` hands the config scope an empty string
  and Joi rejects it for every key but the nine `.env.example` marks `blank ok`.
  To leave something unset, comment the line out.
- **`.env.example` and the scopes are a closed set.** No scope may read a key
  that file does not declare, and it may not declare a key no scope reads. Add
  or remove keys on both sides in the same edit.
- **Schema changes are migrations, generated by the CLI** (`T8`). Never
  hand-write one, and never set `DB_SYNCHRONIZE=true` outside a local machine.
- **Delete `spaceship` before anything it imports.** It imports nine of the
  other directories, so it comes out first or the others do not come out at all.
- Everything else the root `CLAUDE.md` says still applies — invariants `T1`-`T8`
  are not suspended because a wizard is running.

## Common mistakes

| Mistake | What happens |
|---|---|
| Writing `.env` as you go instead of at the submit | An abort at stage 9 leaves a half-configured file the developer has to unpick. |
| Setting `TRUST_PROXY` because the app is "in AWS" | On an instance reached directly, a spoofed `X-Forwarded-For` then decides `req.ip` — and the client's rate-limit bucket. |
| Leaving `TRUST_PROXY` unset behind a load balancer | Every client is counted as the proxy, so the whole deployment shares one rate-limit bucket. |
| Removing a module without its scope | `src/app.module.ts` keeps a `scopes` entry for a scope nothing reads, and the keys stay in `.env.example`. |
| Deleting a module `spaceship` imports, first | The tree stops compiling and the cause looks like the wrong module. |
| Reporting done on a clean `tsc` | Three defects reached `master` that only booting the app found. Boot it when the wizard changed wiring. |
| Answering "I don't know" with the explanation and then your own choice | The person learns nothing and owns a decision they did not make. Explain, then ask again. |
| Letting a parked stage quietly become a default | It stops being a decision and becomes a surprise. Parked means listed at the submit, by name. |
| Using key names as the question | `CORS_ORIGINS` is not a question. "Which websites are allowed to call this API?" is. |
