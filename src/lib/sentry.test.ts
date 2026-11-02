import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it, vi } from "vitest";

// Guards the privacy lock-down so an SDK upgrade can't quietly widen collection.
describe("Sentry options", () => {
  it("collects nothing beyond the error, page, browser, version and user", async () => {
    const { sentryOptions } = await import("./sentry");

    expect(sentryOptions.dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
      queues: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
    });
    expect(sentryOptions).not.toHaveProperty("integrations");
    expect(sentryOptions).not.toHaveProperty("tracesSampleRate");
    expect(sentryOptions.ignoreSpans).toEqual([/.*/]);
    expect(sentryOptions).not.toHaveProperty("replaysSessionSampleRate");
  });

  it("is on in production only", async () => {
    for (const [env, enabled] of [["production", true], ["preview", false], ["development", false]] as const) {
      vi.resetModules();
      vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", env);
      const { sentryOptions } = await import("./sentry");
      expect(sentryOptions.enabled).toBe(enabled);
    }
    vi.unstubAllEnvs();
  });

  it("strips bodies, cookies, headers, query strings and extra user fields", async () => {
    const { scrubEvent } = await import("./sentry");
    const event = {
      type: undefined,
      message: "boom",
      request: {
        url: "https://inventory.museem.com/events?q=Birchline",
        method: "POST",
        data: { name: "secret" },
        cookies: { session: "abc" },
        headers: { cookie: "session=abc" },
        query_string: "q=Birchline",
      },
      user: { id: "u1", email: "a@museem.com", ip_address: "1.2.3.4", username: "a" },
      extra: { input: "secret" },
      breadcrumbs: [{ message: "typed secret" }],
    } as ErrorEvent;

    expect(scrubEvent(event)).toEqual({
      type: undefined,
      message: "boom",
      request: { url: "https://inventory.museem.com/events", method: "POST" },
      user: { id: "u1", email: "a@museem.com" },
    });
  });
});

describe("What Sentry ignores", () => {
  const event = { type: undefined, message: "boom" } as ErrorEvent;
  const send = async (error: unknown) => {
    const { sentryOptions } = await import("./sentry");
    return sentryOptions.beforeSend(structuredClone(event), { originalException: error });
  };
  const withDigest = (digest: string) => Object.assign(new Error(digest), { digest });

  it("drops a command's refusal: validation, permission denied, signed out", async () => {
    const { CommandError } = await import("@/server/errors");
    for (const code of ["invalid", "not-signed-in", "not-allowed"] as const) {
      expect(await send(new CommandError(code, "Enter a name."))).toBeNull();
    }
  });

  it("drops not found, forbidden and redirects", async () => {
    for (const digest of ["NEXT_HTTP_ERROR_FALLBACK;404", "NEXT_HTTP_ERROR_FALLBACK;403", "NEXT_REDIRECT;push;/events;307;"]) {
      expect(await send(withDigest(digest))).toBeNull();
    }
  });

  it("drops a refused sign-in code, but not Better Auth failing", async () => {
    const { APIError } = await import("better-auth/api");
    expect(await send(new APIError("BAD_REQUEST", { message: "Invalid OTP" }))).toBeNull();
    expect(await send(new APIError("INTERNAL_SERVER_ERROR"))).not.toBeNull();
  });

  it("drops aborted and offline requests", async () => {
    expect(await send(new DOMException("The user aborted a request.", "AbortError"))).toBeNull();
    for (const message of ["Failed to fetch", "Load failed", "NetworkError when attempting to fetch resource."]) {
      expect(await send(new TypeError(message))).toBeNull();
    }
  });

  it("keeps everything else, scrubbed", async () => {
    expect(await send(new Error("relation does not exist"))).toEqual(event);
    expect(await send(withDigest("2389475"))).toEqual(event);
    expect(await send(new TypeError("x is undefined"))).toEqual(event);
  });
});
