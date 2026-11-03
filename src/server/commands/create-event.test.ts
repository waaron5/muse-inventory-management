import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/types";
import { addUser, testDb } from "@/test/db";
import { loadEventScreen } from "../loaders/event";
import { createEvent } from "./create-event";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

describe("createEvent", () => {
  it("lets a User create an Event for a new Client", async () => {
    const actor = await addUser(db, { role: "user" });

    const { id } = await createEvent(db, actor, {
      name: "  Cove Incentive Trip  ",
      client: { name: "Birchline" },
    });

    expect(await loadEventScreen(db, id)).toMatchObject({
      name: "Cove Incentive Trip",
      client: { name: "Birchline" },
    });
  });

  it("uses the Client already there when its name is typed again", async () => {
    const actor = await addUser(db);
    const first = await createEvent(db, actor, { name: "Roadshow", client: { name: "Ivorypeak" } });

    const second = await createEvent(db, actor, { name: "Summit", client: { name: "  ivorypeak " } });

    const [a, b] = await Promise.all([loadEventScreen(db, first.id), loadEventScreen(db, second.id)]);
    expect(b?.client).toEqual(a?.client);
  });

  it("files an Event under a Client picked from the list", async () => {
    const actor = await addUser(db);
    const first = await createEvent(db, actor, { name: "Gala", client: { name: "Riverside Community Church" } });
    const picked = (await loadEventScreen(db, first.id))!.client;

    const { id } = await createEvent(db, actor, { name: "Conference", client: { id: picked.id } });

    expect((await loadEventScreen(db, id))?.client).toEqual(picked);
  });

  it("refuses a picked Client that isn't there", async () => {
    const actor = await addUser(db);

    await expect(
      createEvent(db, actor, { name: "Gala", client: { id: "00000000-0000-4000-8000-000000000000" } }),
    ).rejects.toMatchObject({ code: "invalid", message: "Pick a Client that's still there." });
  });

  it("can't be saved without a Name", async () => {
    const actor = await addUser(db);

    await expect(createEvent(db, actor, { name: "  ", client: { name: "Acme" } })).rejects.toMatchObject({
      code: "invalid",
      message: "Give the Event a name.",
    });
  });

  it("can't be saved without a Client", async () => {
    const actor = await addUser(db);

    await expect(
      createEvent(db, actor, { name: "Gala" } as Parameters<typeof createEvent>[2]),
    ).rejects.toMatchObject({ code: "invalid", message: "Pick or add a Client." });
    await expect(createEvent(db, actor, { name: "Gala", client: { name: " " } })).rejects.toMatchObject({
      code: "invalid",
      message: "Pick or add a Client.",
    });
  });

  it("keeps the optional details, leaving blanks empty", async () => {
    const actor = await addUser(db);

    const { id } = await createEvent(db, actor, {
      name: "Sales Kickoff",
      client: { name: "Acme" },
      plCode: " Acme-SKO 26 ",
      venue: "Grand America Hotel",
      notes: "",
    });

    expect(await loadEventScreen(db, id)).toMatchObject({
      plCode: "Acme-SKO 26",
      venue: "Grand America Hotel",
      notes: null,
    });
  });

  it("refuses a P&L Code another Event has, whatever its case", async () => {
    const actor = await addUser(db);
    await createEvent(db, actor, { name: "Cove", client: { name: "Birchline" }, plCode: "BRL Cove 26" });

    await expect(
      createEvent(db, actor, { name: "Cove again", client: { name: "Birchline" }, plCode: "brl cove 26" }),
    ).rejects.toMatchObject({ code: "invalid", message: "Another Event already has the P&L Code brl cove 26." });
  });

  describe("dates", () => {
    it("holds its Reservations over its own dates, both ends counting", async () => {
      const actor = await addUser(db);

      const { id } = await createEvent(db, actor, {
        name: "Summit",
        client: { name: "Acme" },
        startsOn: "2026-11-04",
        endsOn: "2026-11-06",
      });

      expect(await loadEventScreen(db, id)).toMatchObject({
        startsOn: "2026-11-04",
        endsOn: "2026-11-06",
        holdWindow: { from: "2026-11-04", to: "2026-11-06" },
      });
    });

    it("may have no dates while it's being planned", async () => {
      const actor = await addUser(db);

      const { id } = await createEvent(db, actor, { name: "Someday", client: { name: "Acme" } });

      expect(await loadEventScreen(db, id)).toMatchObject({
        startsOn: null,
        endsOn: null,
        holdWindow: null,
      });
    });

    it("refuses an end before the start", async () => {
      const actor = await addUser(db);

      await expect(
        createEvent(db, actor, { name: "Summit", client: { name: "Acme" }, startsOn: "2026-11-06", endsOn: "2026-11-04" }),
      ).rejects.toMatchObject({ code: "invalid", message: "The Event can't end before it starts." });
    });
  });
});
