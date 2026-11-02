# Drizzle ORM 1.0 (release candidate), not v1's Prisma

The query layer is Drizzle ORM on the 1.0 line, pinned to an exact release-candidate version, with drizzle-kit migrations checked into the repo and applied in the build step (never `push` against production). Screen loaders are set-based SQL: the peak-day availability check needs `generate_series` over a Hold Window, joins, and aggregates in one statement. Drizzle writes that directly, and its relational queries compile to a single statement. We chose 1.0 over stable 0.45 because Drizzle's docs now target 1.0, and its `defineRelations` API replaces 0.45's, so starting on 0.45 would mean migrating the relations later.

## Considered Options

- **Prisma** (v1's ORM): v1's includes ran one query per relation level, and the availability math would need raw SQL anyway. Prisma 7 dropped the Rust engine, so cold-start weight is no longer the deciding reason.
- **Kysely or raw SQL**: full control, but no built-in way to define the schema and generate migrations.

## Consequences

- Upgrading from the release candidate to stable 1.0 is expected to be a small version bump. Any breaking change between release candidates is caught by the integration tests.
