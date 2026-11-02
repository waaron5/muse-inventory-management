import { connection } from "next/server";

// Hit by Vercel Cron every 5 minutes so a warm function is always waiting
// (ADR 0006). It must never touch the database, or Neon would never sleep.
export async function GET() {
  await connection();
  return new Response("ok", { headers: { "Cache-Control": "no-store" } });
}
