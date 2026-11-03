import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const databaseModules = ["@/db", "@/db/*", "pg", "drizzle-orm", "drizzle-orm/*"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // ADR 0003: only src/server talks to the database. Changes go through a
  // command, reads through a screen loader.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/server/**", "src/db/**", "src/test/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: databaseModules,
              message:
                "Only src/server reaches the database: change data with a command, read it with a screen loader (ADR 0003).",
            },
          ],
        },
      ],
    },
  },
  // Loaders are handed a read-only database and never take the app's own client.
  {
    files: ["src/server/loaders/**/*.ts"],
    ignores: ["src/server/loaders/index.ts", "**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/db",
              message: "Loaders read through the ReadDb they are handed (ADR 0003).",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name=/^(insert|update|delete|execute|transaction|refreshMaterializedView)$/]",
          message: "Loaders only read; a change to data is a command (ADR 0003).",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    // Installed third-party agent tools keep their upstream code unchanged.
    ".claude/**",
    ".github/skills/**/scripts/**",
  ]),
]);

export default eslintConfig;
