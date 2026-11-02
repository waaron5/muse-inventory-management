import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/types";
import { testCategoryId, addUser, testDb } from "@/test/db";
import { loadGiftScreen, loadItemScreen } from "../loaders/item";
import { createEvent } from "./create-event";
import { createGift } from "./create-gift";
import { createInventoryItem } from "./create-inventory-item";
import { createLocation } from "./create-location";
import { addPastUsePhoto, deletePastUsePhoto, setItemPhoto } from "./photos";
import { reserve } from "./reserve";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

const aPhoto = () => crypto.randomUUID();

/** Chairs that went to the Gala: reserved for it, and it has begun. */
async function chairsAtTheGala() {
  const admin = await addUser(db, { role: "admin", name: "Aaron" });
  const someone = await addUser(db, { role: "user", name: "Bea" });
  const warehouse = await createLocation(db, admin, { name: "Warehouse" });
  const chair = await createInventoryItem(db, admin, {
    categoryId: testCategoryId,
    name: "Folding chair",
    startingStock: { locationId: warehouse.id, count: 18 },
  });
  const plan = (name: string, startsOn = "2026-06-10") =>
    createEvent(db, someone, { name, client: { name: "Acme" }, startsOn, endsOn: startsOn });
  const gala = await plan("Gala");
  await reserve(db, someone, { eventId: gala.id, itemId: chair.id, count: 6 });
  return { admin, someone, chair, gala, plan, warehouse };
}

describe("setItemPhoto", () => {
  it("lets an Admin set an item's one photo, and replace it", async () => {
    const admin = await addUser(db, { role: "admin" });
    const chair = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Folding chair" });
    const first = aPhoto();
    const second = aPhoto();

    expect(await setItemPhoto(db, admin, { itemId: chair.id, photo: first })).toEqual({ replaced: null });
    expect(await setItemPhoto(db, admin, { itemId: chair.id, photo: second })).toEqual({ replaced: first });

    expect((await loadItemScreen(db, chair.id))?.item.photo).toBe(second);
  });

  it("sets a Gift's photo too", async () => {
    const admin = await addUser(db, { role: "admin" });
    const jacket = await createGift(db, admin, { name: "Nano Puff jacket – M" });
    const photo = aPhoto();

    await setItemPhoto(db, admin, { itemId: jacket.id, photo });

    expect((await loadGiftScreen(db, jacket.id))?.item.photo).toBe(photo);
  });

  it("refuses a User", async () => {
    const admin = await addUser(db, { role: "admin" });
    const someone = await addUser(db, { role: "user" });
    const chair = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Folding chair" });

    await expect(setItemPhoto(db, someone, { itemId: chair.id, photo: aPhoto() })).rejects.toMatchObject({
      code: "not-allowed",
    });
    expect((await loadItemScreen(db, chair.id))?.item.photo).toBeNull();
  });

  it("refuses a photo already in use, so deleting one can't take another's", async () => {
    const { admin, chair } = await chairsAtTheGala();
    const banner = await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Banner" });
    const photo = aPhoto();
    await addPastUsePhoto(db, admin, { itemId: chair.id, photo });

    await expect(setItemPhoto(db, admin, { itemId: banner.id, photo })).rejects.toMatchObject({ code: "invalid" });
  });
});

describe("addPastUsePhoto", () => {
  it("lets anyone add a photo to an item, naming an Event it went to, with a note", async () => {
    const { someone, chair, gala } = await chairsAtTheGala();
    const photo = aPhoto();

    await addPastUsePhoto(db, someone, { itemId: chair.id, photo, eventId: gala.id, note: "  Two rows by the stage  " });

    expect((await loadItemScreen(db, chair.id))?.pastUses).toEqual([
      expect.objectContaining({
        photo,
        note: "Two rows by the stage",
        event: { id: gala.id, name: "Gala" },
        by: { id: someone.userId, name: "Bea" },
      }),
    ]);
  });

  it("needs no Event and no note", async () => {
    const { someone, chair } = await chairsAtTheGala();

    await addPastUsePhoto(db, someone, { itemId: chair.id, photo: aPhoto(), note: "" });

    expect((await loadItemScreen(db, chair.id))?.pastUses).toEqual([
      expect.objectContaining({ note: null, event: null }),
    ]);
  });

  it("refuses an Event the item never went to: one that didn't reserve it, or hasn't begun", async () => {
    const { someone, chair, plan } = await chairsAtTheGala();
    const picnic = await plan("Picnic", "2030-06-10");
    await reserve(db, someone, { eventId: picnic.id, itemId: chair.id, count: 2 });
    const fair = await plan("Fair");

    for (const event of [picnic, fair]) {
      await expect(
        addPastUsePhoto(db, someone, { itemId: chair.id, photo: aPhoto(), eventId: event.id }),
      ).rejects.toMatchObject({ code: "invalid", message: "Folding chair didn't go to that Event." });
    }
  });

  it("refuses an item that doesn't exist", async () => {
    const someone = await addUser(db);

    await expect(
      addPastUsePhoto(db, someone, { itemId: crypto.randomUUID(), photo: aPhoto() }),
    ).rejects.toMatchObject({ code: "invalid", message: "That item no longer exists." });
  });

  it("refuses a photo already in use", async () => {
    const { admin, someone, chair } = await chairsAtTheGala();
    const photo = aPhoto();
    await setItemPhoto(db, admin, { itemId: chair.id, photo });

    await expect(addPastUsePhoto(db, someone, { itemId: chair.id, photo })).rejects.toMatchObject({
      code: "invalid",
    });
  });
});

describe("deletePastUsePhoto", () => {
  it("lets the uploader delete their photo for good, handing back what to remove from storage", async () => {
    const { someone, chair } = await chairsAtTheGala();
    const photo = aPhoto();
    await addPastUsePhoto(db, someone, { itemId: chair.id, photo });
    const [added] = (await loadItemScreen(db, chair.id))!.pastUses;

    expect(await deletePastUsePhoto(db, someone, { id: added.id })).toEqual({ photo });

    expect((await loadItemScreen(db, chair.id))?.pastUses).toEqual([]);
  });

  it("lets an Admin delete anyone's photo", async () => {
    const { admin, someone, chair } = await chairsAtTheGala();
    await addPastUsePhoto(db, someone, { itemId: chair.id, photo: aPhoto() });
    const [added] = (await loadItemScreen(db, chair.id))!.pastUses;

    await deletePastUsePhoto(db, admin, { id: added.id });

    expect((await loadItemScreen(db, chair.id))?.pastUses).toEqual([]);
  });

  it("refuses someone else who isn't an Admin, and keeps the photo", async () => {
    const { someone, chair } = await chairsAtTheGala();
    const other = await addUser(db, { role: "user", name: "Cy" });
    await addPastUsePhoto(db, someone, { itemId: chair.id, photo: aPhoto() });
    const [added] = (await loadItemScreen(db, chair.id))!.pastUses;

    await expect(deletePastUsePhoto(db, other, { id: added.id })).rejects.toMatchObject({
      code: "not-allowed",
      message: "Only the person who added a photo, or an Admin, can delete it.",
    });
    expect((await loadItemScreen(db, chair.id))?.pastUses).toHaveLength(1);
  });

  it("refuses a photo that's already gone", async () => {
    const someone = await addUser(db);

    await expect(deletePastUsePhoto(db, someone, { id: crypto.randomUUID() })).rejects.toMatchObject({
      code: "invalid",
      message: "That photo was already deleted.",
    });
  });
});
