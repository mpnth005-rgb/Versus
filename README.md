# Versus

A French → English translation training app: generate a short text to
translate, get sentence-by-sentence AI correction with a score, turn tricky
sentences into spaced-repetition flashcards, and track progress over time.
Sign-in is Google/Apple only, with a free tier (7 exercises/month) and a
"Versus Upper" subscription (unlimited) via Stripe.

This is a real implementation (Next.js 16 App Router, Prisma/SQLite,
Auth.js, Anthropic, Stripe) of the design in [`design/`](./design), which
holds the original Claude Design handoff bundle for reference — read
`design/README.md` and `design/chats/` if you want the original design
intent, but treat this README as the source of truth for how the app
actually works today.

## Stack

- **Next.js 16** (App Router, Turbopack, React 19)
- **Prisma 7** + SQLite for local dev (driver adapter: `@prisma/adapter-better-sqlite3`)
- **Auth.js (next-auth v5)** — Google + Apple OAuth, database sessions via the Prisma adapter
- **Anthropic API** — exercise text generation and translation grading
- **Stripe** — Versus Upper subscription checkout + billing portal
- Hand-written SM-2-style spaced repetition for the flashcard deck (`lib/srs.ts`)

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

## Data model

See `prisma/schema.prisma`. Notable choices:

- AI output (sentence corrections, suggested flashcards) is stored as
  structured JSON (validated with Zod on the way out of `lib/ai.ts`), not
  raw HTML — the correction screen highlights the flagged substring by
  plain string matching client-side, so there's no `dangerouslySetInnerHTML`
  anywhere.
- The free-tier "7 exercises/month" quota is tracked in `MonthlyUsage`
  (per user, per `"YYYY-MM"`). The "max 3 cards per exercise" quota is
  enforced when confirming suggested flashcards, not on manual card
  creation — manual "Ajouter une carte" is not currently capped.
- The deck's "daily new card limit" (`UserSettings.dailyNewCardLimit`) caps
  how many `NEW`-state cards are pulled into a review queue when it's
  built (`lib/deck.ts`). It's not backed by a "cards introduced today" log,
  so it's a per-fetch cap rather than a strict once-per-day guarantee —
  fine at this app's scale, but worth knowing if you extend it.

## Known simplifications

- The SM-2 variant in `lib/srs.ts` is simplified to match the four-button
  UI (À revoir / Difficile / Correcte / Facile) rather than implementing
  the full quality-graded SM-2 formula.
- "Rafraîchir la phrase" on the suggested-cards screen calls the AI again
  for a single replacement suggestion (`lib/ai.ts#suggestReplacementCard`),
  it doesn't just shuffle a pre-fetched pool.
- No email/password auth exists by design — Google/Apple only, per the
  original spec.
