import { type NextRequest, NextResponse } from "next/server";
import { checkAtTheDoor } from "@/server/auth";

/**
 * Every screen except sign-in requires a session. Someone signed in without a
 * name yet is asked for one first, except when connecting an AI app, whose
 * request would be lost on the way.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { user, setCookie } = await checkAtTheDoor(request.headers);

  const goTo = (to: string) => withCookies(NextResponse.redirect(new URL(to, request.url)), setCookie);
  // An AI app can ask for its person to sign in again, already signed in or not.
  const connecting = request.nextUrl.searchParams.has("sig");
  if (pathname === "/sign-in") return user && !connecting ? goTo("/events") : NextResponse.next();
  if (!user) return goTo("/sign-in");
  if (!user.name && pathname !== "/welcome" && pathname !== "/connect") return goTo("/welcome");

  // Hand renewed cookies to this request's render as well as to the browser,
  // so the page reads the fresh cache instead of the database again.
  const forwarded = new Headers(request.headers);
  forwarded.set("cookie", mergeCookies(request.headers.get("cookie"), setCookie));
  return withCookies(NextResponse.next({ request: { headers: forwarded } }), setCookie);
}

export const config = {
  // `/mcp` and `.well-known` answer AI apps, which carry tokens, not sessions.
  matcher: ["/((?!api/|_next/|mcp$|\\.well-known/|favicon.ico|.*\\.[a-z0-9]+$).*)"],
};

function withCookies(response: NextResponse, setCookie: string[]) {
  for (const line of setCookie) response.headers.append("set-cookie", line);
  return response;
}

function mergeCookies(cookieHeader: string | null, setCookie: string[]) {
  const jar = new Map(
    (cookieHeader ?? "")
      .split(";")
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)] as const),
  );
  for (const line of setCookie) {
    const [pair, ...attributes] = line.split(";");
    const name = pair.slice(0, pair.indexOf("=")).trim();
    const expired = attributes.some((a) => /^\s*max-age=0\s*$/i.test(a));
    if (expired) jar.delete(name);
    else jar.set(name, pair.slice(pair.indexOf("=") + 1));
  }
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}
