import { describe, expect, it } from "vitest";
import { DEMO_HOST, isDemo } from "./demo";

describe("isDemo", () => {
  it("is on in the demo's own Vercel project with the flag set", () => {
    expect(isDemo({ DEMO_MODE: "1", VERCEL: "1", VERCEL_PROJECT_PRODUCTION_URL: DEMO_HOST })).toBe(true);
  });

  it("stays off on any other Vercel project, even with the flag set", () => {
    expect(isDemo({ DEMO_MODE: "1", VERCEL: "1", VERCEL_PROJECT_PRODUCTION_URL: "inventory.example.com" })).toBe(false);
    expect(isDemo({ DEMO_MODE: "1", VERCEL: "1" })).toBe(false);
  });

  it("is off without the flag, wherever it runs", () => {
    expect(isDemo({ VERCEL: "1", VERCEL_PROJECT_PRODUCTION_URL: DEMO_HOST })).toBe(false);
    expect(isDemo({ DEMO_MODE: "true" })).toBe(false);
    expect(isDemo({})).toBe(false);
  });

  it("needs only the flag off Vercel, for trying it locally", () => {
    expect(isDemo({ DEMO_MODE: "1" })).toBe(true);
  });
});
