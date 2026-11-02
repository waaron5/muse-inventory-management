import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Each test file starts its own PGlite and migrates it, which is slow under load.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
