import { connection } from "next/server";

// Throws on purpose so the maintainer can see a production error reach Sentry.
// Needs `Authorization: Bearer $CRON_SECRET`; anyone else gets a 404.
export async function POST(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Not found", { status: 404 });
  }
  throw new Error("Sentry check: deliberate production error");
}
