# Versus

A French → English translation training app: generate a short text to
translate, get sentence-by-sentence AI correction with a deterministic
score, turn tricky sentences into spaced-repetition flashcards, and track
progress over time. Sign-in is Google/Apple only, with a free tier (7
exercises/month) and a "Versus Upper" subscription (unlimited) via Stripe.

This is a real implementation (Next.js 16 App Router, Prisma/SQLite,
Auth.js, Anthropic, Stripe) of the design in [`design/`](./design) (the
original Claude Design handoff) and the product/algorithm specs in
[`specs/`](./specs) (correction rubric, double-score formula, AI system
prompts, spaced-repetition algorithm) — read those if you want the
original intent, but treat this README as the source of truth for how the
app actually works today.

## Stack

- **Next.js 16** (App Router, Turbopack, React 19)
- **Prisma 7** + SQLite for local dev (driver adapter: `@prisma/adapter-better-sqlite3`)
- **Auth.js (next-auth v5)** — Google + Apple OAuth, database sessions via the Prisma adapter
- **Anthropic API** — 4 separate calls (`lib/ai.ts`), matching `specs/` exactly:
  1. generate the French exercise text
  2. generate a sentence-aligned reference translation
  3. classify the learner's translation into a fixed 9-error taxonomy —
     **never computes a score**
  4. regenerate a single suggested flashcard for one error type
- **Deterministic scoring** (`lib/scoring.ts`) — the AI only classifies
  errors; the score is always a server-side calculation from a fixed
  penalty table, so a model arithmetic mistake can't silently corrupt it
- **Stripe** — Versus Upper subscription checkout + billing portal
- Spaced repetition (`lib/srs.ts`) — a faithful port of `specs/`' 4-state
  SM-2-style algorithm (nouvelle/apprentissage/révision/ré-apprentissage,
  step ladders, ease factor, ±10% fuzz), not a simplified approximation

## Running it

```bash
npm install        # also runs `prisma generate` via postinstall
npm run db:migrate  # applies prisma/migrations (already applied once; re-run after schema changes)
npm run dev
```

The app renders and the UI is fully clickable with **zero** environment
variables set — but each integration below is inert until configured, and
will surface a clear error (not a crash) when used.

## Environment variables

Copy `.env.example` to `.env` (or `.env.local`) and fill in what you need.
`.env` already has a generated `AUTH_SECRET` and the SQLite `DATABASE_URL`
so `npm run dev` works out of the box for browsing the UI.

| Feature | Variables | Without them |
|---|---|---|
| Sign-in | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google button submits and fails (no Google credentials configured) |
| Sign-in (Apple) | `AUTH_APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (or a pre-generated `AUTH_APPLE_SECRET`) | Apple button is hidden |
| Exercise generation + grading | `ANTHROPIC_API_KEY` | Generating a text or submitting a translation returns a 503 with a clear message |
| Subscriptions | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL` | The upgrade modal's buttons return a 503 instead of opening Stripe Checkout |

Apple's OAuth `client_secret` must be a short-lived JWT rather than a
static string. Instead of asking you to regenerate one by hand every few
months, `lib/apple-client-secret.ts` mints it at runtime from your Sign in
with Apple private key (`APPLE_TEAM_ID`/`APPLE_KEY_ID`/`APPLE_PRIVATE_KEY`).
If you'd rather manage that yourself, set `AUTH_APPLE_SECRET` directly
(e.g. from `npx auth add apple`) and it takes precedence.

Stripe webhooks: point `STRIPE_WEBHOOK_SECRET` at a webhook endpoint
listening on `/api/billing/webhook` for `checkout.session.completed`,
`customer.subscription.updated`/`created`/`deleted`. Locally, use
`stripe listen --forward-to localhost:3000/api/billing/webhook`.

## Scoring

`lib/scoring.ts` implements the exact formula from `specs/Fiche de
correction` + `specs/Fiche double score`: a fixed 9-category penalty
table, `score = max(0, Note_max − Σ(pénalités))`, and
`score_ajusté = max(0, Note_max − Σ(pénalités) × coefficient_niveau)`
with coefficients A2×1.5 / B1×1.2 / B2×1.0 (reference — adjusted always
equals raw at B2) / C1×0.7.

One deliberate deviation from the spec: the spec's worked examples use a
`/20` scale; this app's screens (from the original design) show `/100`.
Rather than picking one and breaking the other, the penalty table here is
the spec's table scaled ×5 — every ratio and the B2-reference property
are preserved exactly, only the base changed.

## Spaced repetition

`lib/srs.ts` is a direct port of `specs/Spécification — Algorithme de
répétition espacée`'s reference Python: 4 states (`NEW` enters `LEARNING`
directly on first review), learning/relearning share step-ladder mechanics
with different step lists, only `REVIEW` reasons in days and applies
±10% fuzz. Verified against the spec's own worked trace (§8) — the ease
factor and state sequence match exactly; only day-interval values differ,
which the spec itself attributes to fuzz.

Per-user SRS parameters (`UserSettings.learningStepsMinutes` etc.) are
DB-configurable — nothing in `lib/srs.ts` hardcodes them — but there's no
admin UI to edit them yet.

## Data model

See `prisma/schema.prisma`. Notable choices:

- AI output is stored as structured JSON, produced via Anthropic
  tool-calling (forced `tool_choice`) rather than "reply with JSON" in
  free text — Claude's tool-use path generates schema-constrained JSON
  server-side, so there's nothing to mis-parse.
- The free-tier "7 exercises/month" quota is tracked in `MonthlyUsage`
  (per user, per `"YYYY-MM"`). The "max 3 cards per exercise" quota is
  enforced when confirming suggested flashcards, not on manual card
  creation — manual "Ajouter une carte" is not currently capped.
- The deck's "daily new card limit" (`UserSettings.dailyNewCardLimit`) caps
  how many `NEW`-state cards are pulled into a review queue when it's
  built (`lib/deck.ts`). It's not backed by a "cards introduced today" log,
  so it's a per-fetch cap rather than a strict once-per-day guarantee —
  fine at this app's scale, but worth knowing if you extend it.
- `UserSettings.learningStepsMinutes`/`relearningStepsMinutes` are
  `Json?` (nullable, no DB default): Prisma's SQLite migration generator
  emits an invalid unquoted `DEFAULT [1,10]` clause for `Json @default()`
  fields, which SQLite silently mis-stores as garbage. The fallback lives
  in `lib/deck.ts#getSrsConfig` instead.

## Known simplifications

- No email/password auth exists by design — Google/Apple only, per the
  original spec.
- No admin UI for the SRS parameters (see above) — DB-configurable, not
  yet exposed in a settings screen.
