import { connection } from "next/server";
import { forgetEndedSignInCounts } from "@/server/auth";
import { commands } from "@/server/commands";

// Hit by Vercel Cron once a day, just after midnight in Denver, to give away
// the Gifts of every Event that has ended (ADR 0010) and clear finished sign-in
// counts (ADR 0008). Apart from /api/warm,
// which must never touch the database. Needs `Authorization: Bearer
// $CRON_SECRET`; anyone else gets a 404.
export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Not found", { status: 404 });
  }
  const { lines } = await commands.giveAwayEnded();
  await forgetEndedSignInCounts();
  return Response.json({ lines }, { headers: { "Cache-Control": "no-store" } });
}
