import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { z } from "zod";

// The only way to make an Admin outside the app, for a database that has none
// (ADR 0008). Run by the maintainer: `DATABASE_URL=<url> pnpm admin:create <email>`.
// The database is only ever the one named on that line, never one from .env.local,
// so this can't land somewhere by accident.
// Plain SQL, because Node runs this file directly, without the app's "@/" paths.

type Query = (sql: string, params: unknown[]) => Promise<{ rows: unknown[] }>;

const address = z.string().trim().toLowerCase().pipe(z.email());

/** Adds an Admin. Changes nothing, and says so, if the address is taken or isn't one. */
export async function createAdmin(query: Query, typed: string) {
  const parsed = address.safeParse(typed);
  if (!parsed.success) return { ok: false as const, message: `"${typed}" isn't an email address.` };

  const { rows } = await query(
    `insert into "user" (id, name, email, role) values ($1, '', $2, 'admin')
     on conflict (email) do nothing returning id`,
    [randomUUID(), parsed.data],
  );
  return rows.length > 0
    ? { ok: true as const, message: `${parsed.data} is now an Admin, and can sign in with an emailed code.` }
    : { ok: false as const, message: `${parsed.data} already has an account. Nothing changed.` };
}

async function main() {
  const [typed] = process.argv.slice(2);
  const url = process.env.DATABASE_URL;
  if (!typed || !url) {
    console.error("Usage: DATABASE_URL=<url> pnpm admin:create <email>");
    process.exit(1);
  }

  const { hostname, pathname } = new URL(url);
  console.log(`Database: ${hostname}${pathname}`);

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const result = await createAdmin((sql, params) => client.query(sql, params), typed);
    console.log(result.message);
    if (!result.ok) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
