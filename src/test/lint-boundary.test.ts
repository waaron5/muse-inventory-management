import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: process.cwd() });

async function lintRules(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map((m) => m.ruleId);
}

// ADR 0003: a database write outside the command module fails lint.
describe("the database boundary", () => {
  it("fails a screen that imports the database", async () => {
    const rules = await lintRules(
      "src/app/(app)/inventory/page.tsx",
      `import { db } from "@/db";\nexport const x = db;\n`,
    );
    expect(rules).toContain("no-restricted-imports");
  });

  it("fails a screen that imports Drizzle", async () => {
    const rules = await lintRules(
      "src/components/thing.tsx",
      `import { eq } from "drizzle-orm";\nexport const x = eq;\n`,
    );
    expect(rules).toContain("no-restricted-imports");
  });

  it("fails a loader that writes", async () => {
    const rules = await lintRules(
      "src/server/loaders/sneaky.ts",
      `import type { ReadDb } from "@/db/types";\nimport { location } from "@/db/schema";\nexport const f = (db: ReadDb) => (db as any).insert(location).values({ name: "x" });\n`,
    );
    expect(rules).toContain("no-restricted-syntax");
  });

  it("fails a loader that takes the app's own client", async () => {
    const rules = await lintRules(
      "src/server/loaders/sneaky.ts",
      `import { db } from "@/db";\nexport const x = db;\n`,
    );
    expect(rules).toContain("no-restricted-imports");
  });

  it("passes a command that writes", async () => {
    const rules = await lintRules(
      "src/server/commands/fine.ts",
      `import type { Tx } from "@/db/types";\nimport { location } from "@/db/schema";\nexport const f = (tx: Tx) => tx.insert(location).values({ name: "x" });\n`,
    );
    expect(rules).toEqual([]);
  });
});
