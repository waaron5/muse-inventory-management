# Muse Event Management

## Local Development

Start the app:

```bash
npm run dev
```

## Deployments

This repo is meant to power two separate Vercel projects:

- Production
- Demo

Both projects can use the same GitHub repo and the same codebase, but they must use different environment variables, especially different `DATABASE_URL` values.

### Important change

Vercel builds no longer run Prisma migrations automatically.

The build script now does this:

```bash
npm run build
# prisma generate && next build
```

That avoids multiple Vercel deployments fighting over Prisma's advisory lock during `prisma migrate deploy`.

## Database Commands

Run these manually against the database for the environment you intend to change:

```bash
npm run db:migrate:deploy
npm run db:migrate:status
```

These commands use the current `DATABASE_URL`.

## Recommended Workflow

### Code-only change

1. Push to GitHub.
2. Let Vercel auto-deploy both projects.

### Schema change

1. Create the Prisma migration locally.
2. Run `npm run db:migrate:deploy` against the production database.
3. Run `npm run db:migrate:deploy` against the demo database.
4. If demo fixture data changed, run `npm run demo:reset` against the demo database.
5. Push to GitHub.
6. Let Vercel redeploy the app code.

### Why this is safer

- Production and demo no longer compete for migration locks during build.
- Each database is migrated intentionally and separately.
- Vercel deployments become code deploys, not schema-mutation jobs.

## Notes

- If you use Vercel's Git integration, pushes will still trigger automatic redeploys.
- Those redeploys will not apply migrations anymore.
- If a change requires new schema, migrate the target database first or deploy only after both databases are ready.
