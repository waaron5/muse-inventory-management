import { describe, expect, it } from "vitest";
import { allCommands } from "./all";
import { isCommand } from "./define";

// Every command any module here defines, found without the list.
const modules = import.meta.glob<Record<string, unknown>>(["./*.ts", "!./*.test.ts", "!./index.ts"], { eager: true });
const defined = Object.values(modules).flatMap((exported) => Object.values(exported).filter(isCommand));

/** What stays in the app (ADR 0017): deleting, managing people beyond inviting, merging Clients, Acknowledging Shortages, photos, and your own profile and AI Connections. */
const EXCLUDED = [
  "acknowledgeShortage",
  "addPastUsePhoto",
  "changeRole",
  "deactivateUser",
  "deleteCategory",
  "deleteClient",
  "deleteEvent",
  "deleteItem",
  "deleteLocation",
  "deletePastUsePhoto",
  "deleteUser",
  "disconnectAiConnection",
  "mergeClients",
  "reactivateUser",
  "setItemPhoto",
  "setOwnAvatarColour",
  "setOwnName",
];

describe("every command", () => {
  it("is listed, under its own name", () => {
    expect(defined.length).toBeGreaterThan(30);
    for (const command of defined) expect(allCommands).toHaveProperty(command.spec.name, command);
    expect(Object.keys(allCommands).sort()).toEqual([...new Set(defined.map((c) => c.spec.name))].sort());
  });

  it("decides whether an AI Connection may run it, and describes it to the AI if so", () => {
    for (const command of defined) {
      const { name, ai } = command.spec;
      expect(ai, `${name} must say whether AI Connections can run it`).toBeDefined();
      if (ai) expect(ai.description.length, `${name} needs a description for the AI`).toBeGreaterThan(20);
    }
  });

  it("is available to AI Connections except the excluded list", () => {
    const excluded = defined.filter((c) => c.spec.ai === false).map((c) => c.spec.name);
    expect(excluded.sort()).toEqual(EXCLUDED);
  });
});
