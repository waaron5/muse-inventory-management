import { z } from "zod";
import { photoAsked } from "@/lib/photos";
import { currentSession } from "@/server/auth";
import { readPhoto } from "@/server/photos";

// Every photo is seen by everyone signed in, and by no one else. A key never
// names a different photo, so the browser keeps what it has fetched.
export async function GET(request: Request, { params }: RouteContext<"/api/photos/[key]">) {
  const { key } = await params;
  if (!(await currentSession())) return new Response("Sign in to see photos.", { status: 401 });
  if (!z.uuid().safeParse(key).success) return new Response("No such photo.", { status: 404 });

  const { size, download } = photoAsked(new URL(request.url).searchParams);
  const stream = await readPhoto(key, size);
  if (!stream) return new Response("No such photo.", { status: 404 });
  return new Response(stream, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=31536000, immutable",
      ...(download && { "Content-Disposition": `attachment; filename="photo-${key}.jpg"` }),
    },
  });
}
