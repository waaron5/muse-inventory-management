import { describe, expect, it } from "vitest";
import { DEMO_HOST } from "./demo";
import { aiConnectionsOn } from "./ai-connections";

describe("aiConnectionsOn", () => {
  it("is on with AI_CONNECTIONS=1", () => {
    expect(aiConnectionsOn({ AI_CONNECTIONS: "1" })).toBe(true);
    expect(aiConnectionsOn({ AI_CONNECTIONS: "1", VERCEL: "1", VERCEL_PROJECT_PRODUCTION_URL: "inventory.museem.com" })).toBe(true);
  });

  it("is off without it", () => {
    expect(aiConnectionsOn({})).toBe(false);
    expect(aiConnectionsOn({ AI_CONNECTIONS: "true" })).toBe(false);
  });

  it("is always off in the demo", () => {
    expect(aiConnectionsOn({ AI_CONNECTIONS: "1", DEMO_MODE: "1" })).toBe(false);
    expect(aiConnectionsOn({ AI_CONNECTIONS: "1", DEMO_MODE: "1", VERCEL: "1", VERCEL_PROJECT_PRODUCTION_URL: DEMO_HOST })).toBe(false);
  });
});
