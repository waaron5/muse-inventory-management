import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Report a bug's screenshot, made a JPEG of at most 2000px in the browser,
  // stays well inside this and Vercel's own 4.5 MB.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // Sentry's tracing and debug logging, which `src/lib/sentry.ts` leaves off,
  // left out of every bundle. Sentry's own `bundleSizeOptimizations` is
  // webpack-only, so the flags it would set are set here for Turbopack.
  compiler: { define: { __SENTRY_TRACING__: false, __SENTRY_DEBUG__: false } },
  async redirects() {
    return [{ source: "/", destination: "/events", permanent: false }];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
});
