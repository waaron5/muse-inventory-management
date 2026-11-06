import { isDemo } from "./demo";

/**
 * AI Connections (ADR 0017) are switched on per environment with
 * `AI_CONNECTIONS=1`, and never in the public demo. While off, `/mcp`, its
 * OAuth routes and the Allow screen are not found.
 */
export function aiConnectionsOn(env: Record<string, string | undefined> = process.env): boolean {
  return env.AI_CONNECTIONS === "1" && !isDemo(env);
}
