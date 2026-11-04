# Muse Inventory

Inventory and event planning for [Muse Events Management](https://museem.com), a corporate event planner. It keeps track of what Muse owns, where it is, and what each Event needs. It replaces a set of spreadsheets and manual tracking.

**[Try the live demo](https://muse-inventory-demo.vercel.app)**: one click signs you in as an Admin. The data is fictional and resets every night.

## What it does

- **Events** reserve Inventory and Gifts for their dates. Reservations never block: if two Events want more than Muse has, both are flagged "Short by N" until an Admin acknowledges it.
- **Stock** is physical, one Location per item, and every change is an entry in an append-only History, so every number can be explained.
- **Gifts** are given away automatically the day after their Event ends. Nobody checks anything off.
- **Activity** records every change anyone made, in plain sentences.
- **Print list**: an Event's working copy on paper, for the warehouse and on site.
- Sign-in by emailed code, invite-only, with Admin and User roles. Works the same on a phone and on a laptop, in light and dark.

## How it's built

- [Next.js](https://nextjs.org) 16 App Router with Cache Components: a prerendered shell, with data streamed into it. Server Actions call one command each.
- PostgreSQL on [Neon](https://neon.tech), through [Drizzle ORM](https://orm.drizzle.team). Every change is a command that re-checks the session, writes its change, History and Activity in one transaction ([ADR 0003](docs/adr/0003-every-change-is-a-command.md)).
- [Better Auth](https://better-auth.com) email codes with sign-in limits, Vercel Blob for photos, Resend for mail and Sentry for errors.
- Tailwind CSS on a token-based [design system](docs/design-system.md), checked for contrast in both themes.
- Vitest against an in-process Postgres (PGlite) built from the real migrations, and Playwright end to end.
- Deployed on Vercel, with the database and functions in the same region ([ADR 0006](docs/adr/0006-oregon-co-location-and-always-warm.md)).

The decisions behind it are in [`docs/adr`](docs/adr), and its language in [`CONTEXT.md`](CONTEXT.md).

## Running it locally

You need Node 22+, pnpm and a Postgres database.

```sh
pnpm install
cp .env.example .env.local      # set DATABASE_URL and DATABASE_URL_UNPOOLED
pnpm db:migrate
DATABASE_URL=<url> pnpm admin:create you@example.com
pnpm dev
```

Without a Resend key, sign-in codes are printed to the console. To try the demo's one-click sign-in and seed data locally, set `DEMO_MODE=1`, then call `/api/demo-reset` with `Authorization: Bearer $CRON_SECRET`.

```sh
pnpm test        # unit and command tests
pnpm test:e2e    # Playwright, against a built app and its own database
```
