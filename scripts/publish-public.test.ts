import { describe, expect, it } from "vitest";
import { isLeftOut, leaks, type Names, sanitize } from "./publish-public";

// Made-up names, so this test can be published along with the script. The
// private repo's address and a price are put together here, so the export
// neither unwraps nor refuses this file's own examples.
const privateRepo = ["https://github.com", "waaron5", "muse-inventory"].join("/");
const aPrice = ["$", "19 a month"].join("");
const names: Names = {
  swaps: [["Acme Corp", "Zenith Co"], ["Acme", "Zenith"], ["ACM-", "ZEN-"], ["Riverdale", "Lakeview"]],
  alsoRefuse: ["Wonka"],
};

describe("sanitize", () => {
  it("swaps each real name for its stand-in, keeping its case", () => {
    expect(sanitize("Acme Corp's gala at Riverdale; acme in code; ACME in caps", names)).toBe(
      "Zenith Co's gala at Lakeview; zenith in code; ZENITH in caps",
    );
  });

  it("leaves a name inside a longer word alone, but not one beside digits or a code", () => {
    expect(sanitize("Acmes and Riverdaleans", names)).toBe("Acmes and Riverdaleans");
    expect(sanitize("Riverdale26 ACM-Roadshow 26", names)).toBe("Lakeview26 ZEN-Roadshow 26");
  });

  it("unwraps links into the private repo and drops issue asides", () => {
    expect(
      sanitize(
        `Settled in [Visual design](${privateRepo}/issues/12). Dark mode ([#44](${privateRepo}/issues/44)) is a second value.`,
        names,
      ),
    ).toBe("Settled in Visual design. Dark mode is a second value.");
  });

  it("keeps links to the public repo", () => {
    const text = `[Code](${privateRepo}-management)`;
    expect(sanitize(text, names)).toBe(text);
  });
});

describe("leaks", () => {
  it("finds real names, private links and prices, with their line", () => {
    const text = ["fine", "Wonka bars", `see ${privateRepo}/pull/3`, `about ${aPrice}`].join("\n");
    expect(leaks("notes.ts", text, names)).toEqual([
      "notes.ts:2: Wonka",
      "notes.ts:3: a link into the private repo",
      "notes.ts:4: a price a month or a year",
    ]);
  });

  it("refuses any dollar amount in prose, but not a query's parameters in code", () => {
    expect(leaks("docs/adr/0001.md", "costs $5 to run", names)).toEqual(["docs/adr/0001.md:1: a dollar amount"]);
    expect(leaks("src/db.ts", "where id = $1", names)).toEqual([]);
  });

  it("finds nothing once a file is sanitized", () => {
    const text = sanitize(`Acme Corp at Riverdale, [#3](${privateRepo}/issues/3)`, names);
    expect(leaks("CONTEXT.md", text, names)).toEqual([]);
  });
});

describe("isLeftOut", () => {
  it("leaves out agent files, vendored tools, internal docs and the names", () => {
    for (const file of ["AGENTS.md", ".github/skills/x/SKILL.md", "docs/agents/domain.md", "scripts/public-names.json", "demo/vercel.json"]) {
      expect(isLeftOut(file)).toBe(true);
    }
    for (const file of ["README.md", "docs/adr/0001-x.md", "src/app/layout.tsx", ".github/workflows/ci.yml"]) {
      expect(isLeftOut(file)).toBe(false);
    }
  });
});
