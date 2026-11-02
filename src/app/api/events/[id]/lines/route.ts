import { currentSession } from "@/server/auth";
import { type EventLinesData, loaders } from "@/server/loaders";

// An Events row's panel: the Event's Lines and what its pickers offer, loaded
// when the row opens rather than with the list. Seen by everyone signed in.
export async function GET(_request: Request, { params }: RouteContext<"/api/events/[id]/lines">) {
  if (!(await currentSession())) return new Response("Sign in to see an Event.", { status: 401 });

  const found = await loaders.event((await params).id);
  if (!found) return new Response("No such Event.", { status: 404 });
  const { id, cancelled, holdWindow, inventory, gifts, shortages, reservable } = found;
  return Response.json({ id, cancelled, holdWindow, inventory, gifts, shortages, reservable } satisfies EventLinesData, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
