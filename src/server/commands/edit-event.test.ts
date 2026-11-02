import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/types";
import { testCategoryId, addUser, testDb } from "@/test/db";
import { loadEventScreen } from "../loaders/event";
import { createEvent } from "./create-event";
import { createGift } from "./create-gift";
import { createInventoryItem } from "./create-inventory-item";
import { createLocation } from "./create-location";
import { editEvent } from "./edit-event";
import { reserve } from "./reserve";

let db: Db;
let actor: Awaited<ReturnType<typeof addUser>>;
beforeAll(async () => {
  db = await testDb();
  actor = await addUser(db, { role: "user" });
});

describe("editEvent", () => {
  it("lets a User change any Event, moving its Hold Window with its dates", async () => {
    const { id } = await createEvent(db, actor, {
      name: "Summit",
      client: { name: "Acme" },
      startsOn: "2026-11-04",
      endsOn: "2026-11-06",
    });

    await editEvent(db, actor, {
      id,
      name: "Leadership Summit",
      client: { name: "Ivorypeak" },
      venue: "Pine Ridge",
      startsOn: "2026-12-01",
      endsOn: "2026-12-03",
    });

    expect(await loadEventScreen(db, id)).toMatchObject({
      name: "Leadership Summit",
      client: { name: "Ivorypeak" },
      venue: "Pine Ridge",
      holdWindow: { from: "2026-12-01", to: "2026-12-03" },
    });
  });

  it("keeps its own P&L Code but can't take another Event's", async () => {
    await createEvent(db, actor, { name: "Cove", client: { name: "Birchline" }, plCode: "BRL Cove 26" });
    const { id } = await createEvent(db, actor, { name: "Lakeside", client: { name: "Birchline" }, plCode: "BRL PC 26" });

    await editEvent(db, actor, { id, name: "Lakeside offsite", client: { name: "Birchline" }, plCode: "BRL PC 26" });
    await expect(
      editEvent(db, actor, { id, name: "Lakeside offsite", client: { name: "Birchline" }, plCode: "BRL Cove 26" }),
    ).rejects.toMatchObject({ code: "invalid", message: "Another Event already has the P&L Code BRL Cove 26." });
  });

  it("refuses an Event that isn't there", async () => {
    await expect(
      editEvent(db, actor, { id: "00000000-0000-4000-8000-000000000000", name: "Gala", client: { name: "Acme" } }),
    ).rejects.toMatchObject({ code: "invalid", message: "That Event no longer exists." });
  });
});

describe("editEvent and its Reservations", () => {
  it("moves the Event's holds when its dates change", async () => {
    const admin = await addUser(db, { role: "admin" });
    const warehouse = await createLocation(db, admin, { name: "Warehouse" });
    const tent = await createInventoryItem(db, admin, {
      categoryId: testCategoryId,
      name: "Tent",
      startingStock: { locationId: warehouse.id, count: 4 },
    });
    const summit = { name: "Summit", client: { name: "Acme" }, startsOn: "2027-05-10", endsOn: "2027-05-12" };
    const { id } = await createEvent(db, actor, summit);
    const other = await createEvent(db, actor, { name: "Gala", client: { name: "Acme" }, startsOn: "2027-05-08" });
    await reserve(db, actor, { eventId: id, itemId: tent.id, count: 3 });
    const tentsFor = async (eventId: string) =>
      (await loadEventScreen(db, eventId))?.reservable.inventory.find((i) => i.id === tent.id)?.available;
    expect(await tentsFor(other.id)).toBe(4);

    await editEvent(db, actor, { id, ...summit, startsOn: "2027-05-08" });

    expect(await tentsFor(other.id)).toBe(1);
  });

  it("won't clear the dates of an Event holding Inventory", async () => {
    const admin = await addUser(db, { role: "admin" });
    const chair = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Folding chair" });
    const { id } = await createEvent(db, actor, { name: "Summit", client: { name: "Acme" }, startsOn: "2027-05-10" });
    await reserve(db, actor, { eventId: id, itemId: chair.id, count: 3 });

    await expect(editEvent(db, actor, { id, name: "Summit", client: { name: "Acme" } })).rejects.toMatchObject({
      code: "invalid",
      message: "Remove the Event's Inventory before clearing its dates.",
    });
  });

  it("clears the dates of an Event holding only Gifts", async () => {
    const admin = await addUser(db, { role: "admin" });
    const jacket = await createGift(db, admin, { name: "Nano Puff jacket – M" });
    const { id } = await createEvent(db, actor, { name: "Summit", client: { name: "Acme" }, startsOn: "2027-05-10" });
    await reserve(db, actor, { eventId: id, itemId: jacket.id, count: 3 });

    await editEvent(db, actor, { id, name: "Summit", client: { name: "Acme" } });

    expect(await loadEventScreen(db, id)).toMatchObject({ startsOn: null, gifts: [{ reserved: 3 }] });
  });
});
