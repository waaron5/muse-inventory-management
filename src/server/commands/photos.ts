import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { event, item, line, pastUsePhoto } from "@/db/schema";
import type { Tx } from "@/db/types";
import { CommandError } from "../errors";
import { wentTo } from "../loaders/availability";
import { museToday } from "../today";
import { ref, said } from "./activity";
import { defineCommand } from "./define";
import { optionalText } from "./item-fields";

// A photo is uploaded to Blob storage from the browser first; these record it
// by its key. Deleting or replacing one hands its key back, for the caller to
// remove from storage once this has saved.

export const photoKey = z.uuid("That photo didn't upload. Try again.");

// A key belongs to one photo only: anyone may delete their own photo, which
// must never take another's with it.
export async function refuseInUse(tx: Tx, photo: string) {
  const [asItemPhoto] = await tx.select({ id: item.id }).from(item).where(eq(item.photo, photo));
  const [asPastUse] = await tx.select({ id: pastUsePhoto.id }).from(pastUsePhoto).where(eq(pastUsePhoto.photo, photo));
  if (asItemPhoto || asPastUse) throw new CommandError("invalid", "That photo is already in use. Upload it again.");
}

/** An Admin sets an Inventory Item's or Gift's one photo, or replaces it. */
export const setItemPhoto = defineCommand({
  name: "setItemPhoto",
  input: z.object({ itemId: z.uuid("That item no longer exists."), photo: photoKey }),
  allow: ["admin"],
  ai: false,
  run: async (tx, _actor, { itemId, photo }, record) => {
    const [found] = await tx.select({ photo: item.photo, name: item.name, kind: item.kind }).from(item).where(eq(item.id, itemId)).for("update");
    if (!found) throw new CommandError("invalid", "That item no longer exists.");
    await refuseInUse(tx, photo);
    await tx.update(item).set({ photo }).where(eq(item.id, itemId));
    const of = ref.item(itemId, found.name, found.kind);
    await record("catalog", found.photo ? said`changed the photo of ${of}` : said`added a photo of ${of}`);
    return { replaced: found.photo };
  },
});

/** Anyone adds a Past-use Photo to an item, at any time. */
export const addPastUsePhoto = defineCommand({
  name: "addPastUsePhoto",
  input: z.object({
    itemId: z.uuid("That item no longer exists."),
    photo: photoKey,
    eventId: z.uuid("Pick an Event from the list.").optional(),
    note: optionalText(1000, "Keep the note under 1,000 characters."),
  }),
  allow: ["admin", "user"],
  ai: false,
  run: async (tx, actor, { itemId, photo, eventId, note }, record) => {
    const [found] = await tx.select({ name: item.name, kind: item.kind }).from(item).where(eq(item.id, itemId));
    if (!found) throw new CommandError("invalid", "That item no longer exists.");
    // Only an Event it went to.
    if (eventId) {
      const [went] = await tx
        .select({ id: line.id })
        .from(line)
        .innerJoin(event, eq(event.id, line.eventId))
        .where(and(eq(line.eventId, eventId), eq(line.itemId, itemId), wentTo(museToday)));
      if (!went) throw new CommandError("invalid", `${found.name} didn't go to that Event.`);
    }
    await refuseInUse(tx, photo);
    await tx.insert(pastUsePhoto).values({ itemId, photo, eventId, note, byUserId: actor.userId });
    await record("catalog", said`added a past-use photo of ${ref.item(itemId, found.name, found.kind)}`);
  },
});

/** The person who added a Past-use Photo, or an Admin, deletes it for good. */
export const deletePastUsePhoto = defineCommand({
  name: "deletePastUsePhoto",
  input: z.object({ id: z.uuid("That photo was already deleted.") }),
  allow: ["admin", "user"],
  ai: false,
  run: async (tx, actor, { id }, record) => {
    const [found] = await tx
      .select({ photo: pastUsePhoto.photo, byUserId: pastUsePhoto.byUserId, itemId: item.id, name: item.name, kind: item.kind })
      .from(pastUsePhoto)
      .innerJoin(item, eq(item.id, pastUsePhoto.itemId))
      .where(eq(pastUsePhoto.id, id))
      .for("update", { of: pastUsePhoto });
    if (!found) throw new CommandError("invalid", "That photo was already deleted.");
    if (actor.role !== "admin" && found.byUserId !== actor.userId) {
      throw new CommandError("not-allowed", "Only the person who added a photo, or an Admin, can delete it.");
    }
    await tx.delete(pastUsePhoto).where(eq(pastUsePhoto.id, id));
    await record("catalog", said`deleted a past-use photo of ${ref.item(found.itemId, found.name, found.kind)}`);
    return { photo: found.photo };
  },
});
