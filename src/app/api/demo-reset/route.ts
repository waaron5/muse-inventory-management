import { connection } from "next/server";
import { isDemo } from "@/lib/demo";
import { resetTheDemo } from "@/server/demo";

// Hit by Vercel Cron each night in the demo only (ADR 0016): every table is
// emptied and the fictional data seeded again, with dates counted from today.
// Needs `Authorization: Bearer $CRON_SECRET`; anyone else, and anywhere but
// the demo, gets a 404.
export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!isDemo() || !secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Not found", { status: 404 });
  }
  await resetTheDemo();
  return Response.json({ reset: true }, { headers: { "Cache-Control": "no-store" } });
}
