import { currentSession } from "@/server/auth";
import { loaders } from "@/server/loaders";

// Longer than any name, SKU or P&L Code.
const MAX_QUERY = 100;

// Global search's results as you type: seen by everyone signed in, and by no one else.
export async function GET(request: Request) {
  if (!(await currentSession())) return new Response("Sign in to search.", { status: 401 });

  const q = new URL(request.url).searchParams.get("q") ?? "";
  return Response.json(await loaders.search(q.slice(0, MAX_QUERY)), { headers: { "Cache-Control": "private, no-store" } });
}
