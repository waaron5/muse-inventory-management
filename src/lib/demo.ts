/** The only production address the public demo runs at (ADR 0016). */
export const DEMO_HOST = "muse-inventory-demo.vercel.app";

/**
 * The public demo (ADR 0016): one-click sign-in, fictional data reset nightly,
 * and no email, uploads or bug reports. It needs `DEMO_MODE=1` and, on Vercel,
 * the demo's own project, so setting the flag on Muse's production by mistake
 * turns nothing on. Off Vercel the flag alone is enough, for trying it locally.
 */
export function isDemo(env: Record<string, string | undefined> = process.env): boolean {
  if (env.DEMO_MODE !== "1") return false;
  return !env.VERCEL || env.VERCEL_PROJECT_PRODUCTION_URL === DEMO_HOST;
}

/** What a refused demo-only action says. */
export const offInTheDemo = (what: string) => `${what} are off in the demo.`;
