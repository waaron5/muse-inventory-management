"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { currentActor } from "@/server/auth";
import { commands, CommandError } from "@/server/commands";
import { flash } from "@/server/flash";
import { removePhotos } from "@/server/photos";
import { backTo } from "@/lib/back-to";
import { catalogs, type Kind } from "./kind";

/** What the item form shows after a refusal: the reason, and what was typed. */
export type ItemFormState = { error?: string; values?: Record<string, string> };

export async function createInventoryItem(_state: ItemFormState, form: FormData) {
  return create("inventory", form);
}

export async function createGift(_state: ItemFormState, form: FormData) {
  return create("gift", form);
}

export async function editInventoryItem(_state: ItemFormState, form: FormData) {
  return edit("inventory", form);
}

export async function editGift(_state: ItemFormState, form: FormData) {
  return edit("gift", form);
}

async function create(kind: Kind, form: FormData): Promise<ItemFormState> {
  const actor = await currentActor();
  const add = kind === "gift" ? commands.createGift : commands.createInventoryItem;
  let id: string;
  try {
    ({ id } = await add(actor, {
      ...itemFieldsFrom(form),
      ...(kind === "inventory" && { categoryId: String(form.get("categoryId") ?? "") }),
      startingStock: { locationId: String(form.get("locationId") ?? ""), count: typedNumber(String(form.get("count") ?? "")) },
      photo: String(form.get("photo") ?? "") || undefined,
    }));
  } catch (error) {
    if (error instanceof CommandError) return { error: error.message, values: typed(form) };
    throw error;
  }
  await flash(`${catalogs[kind].noun} added`);
  redirect(`${catalogs[kind].path}/${id}`);
}

async function edit(kind: Kind, form: FormData): Promise<ItemFormState> {
  const actor = await currentActor();
  const id = String(form.get("id") ?? "");
  const save = kind === "gift" ? commands.editGift : commands.editInventoryItem;
  try {
    await save(actor, { id, ...itemFieldsFrom(form),
      ...(kind === "inventory" && { categoryId: String(form.get("categoryId") ?? "") }),
      stock: {
        locationId: String(form.get("locationId") ?? ""),
        count: typedNumber(String(form.get("count") ?? "")),
        expectedCount: Number(form.get("expectedCount") ?? 0),
      } });
  } catch (error) {
    if (error instanceof CommandError) return { error: error.message, values: typed(form) };
    throw error;
  }
  await flash("Changes saved");
  redirect(backTo(form, `${catalogs[kind].path}/${id}`));
}

/** What an Adjust count form shows: a refusal and what was typed, or done. */
export type StockFormState = { error?: string; values?: Record<string, string>; done?: boolean };

export async function adjustCount(_state: StockFormState, form: FormData): Promise<StockFormState> {
  const actor = await currentActor();
  const text = (key: string) => String(form.get(key) ?? "");
  const reason = text("reason");
  const count = typedNumber(text("count"));
  try {
    // The command checks the reason; a Recount's number is what was counted.
    await commands.adjustStock(actor, {
      itemId: text("itemId"),
      note: text("note"),
      happenedOn: text("happenedOn") || undefined,
      ...(reason === "recount" ? { reason, countedTo: count } : { reason, count }),
    } as Parameters<typeof commands.adjustStock>[1]);
  } catch (error) {
    if (error instanceof CommandError) return { error: error.message, values: typed(form) };
    throw error;
  }
  await flash("Count adjusted");
  refresh();
  return { done: true };
}

/** What an Archive or Unarchive sheet shows: a refusal, or done. */
export type ArchiveFormState = { error?: string; done?: boolean };

/** An Admin archives an item once it has no Stock and nothing Out or reserved. */
export async function archiveItem(_state: ArchiveFormState, form: FormData): Promise<ArchiveFormState> {
  const actor = await currentActor();
  return settled("Archived", () => commands.archiveItem(actor, { id: String(form.get("id") ?? "") }));
}

export async function unarchiveItem(_state: ArchiveFormState, form: FormData): Promise<ArchiveFormState> {
  const actor = await currentActor();
  return settled("Unarchived", () => commands.unarchiveItem(actor, { id: String(form.get("id") ?? "") }));
}

export async function deleteItem(_state: ArchiveFormState, form: FormData): Promise<ArchiveFormState> {
  const actor = await currentActor();
  const result = await settled("Item deleted", () => commands.deleteItem(actor, { id: String(form.get("id") ?? "") }));
  if (result.done) redirect(backTo(form, catalogs[form.get("kind") === "gift" ? "gift" : "inventory"].path));
  return result;
}

// Says `done` in a snackbar once the change has committed.
async function settled(done: string, change: () => Promise<unknown>): Promise<ArchiveFormState> {
  try {
    await change();
  } catch (error) {
    if (error instanceof CommandError) return { error: error.message };
    throw error;
  }
  await flash(done);
  refresh();
  return { done: true };
}

// A photo is already in storage when one of these runs. A refused one is left
// there, unreachable: its key is any photo's that someone can see, so
// removing it on refusal would let anyone delete another's photo.

/** An Admin sets or replaces an item's Item Photo. */
export async function setItemPhoto(input: { itemId: string; photo: string }) {
  const actor = await currentActor();
  try {
    const { replaced } = await commands.setItemPhoto(actor, input);
    await removePhotos(replaced);
  } catch (error) {
    if (error instanceof CommandError) return { error: error.message };
    throw error;
  }
  await flash("Photo saved");
  refresh();
  return { done: true };
}

/** Anyone adds a Past-use Photo, optionally naming an Event it went to. */
export async function addPastUsePhoto(input: { itemId: string; photo: string; eventId: string; note: string }) {
  const actor = await currentActor();
  try {
    await commands.addPastUsePhoto(actor, { ...input, eventId: input.eventId || undefined });
  } catch (error) {
    if (error instanceof CommandError) return { error: error.message };
    throw error;
  }
  await flash("Photo added");
  refresh();
  return { done: true };
}

/** Its uploader or an Admin deletes a Past-use Photo, for good. */
export async function deletePastUsePhoto(id: string) {
  const actor = await currentActor();
  try {
    const { photo } = await commands.deletePastUsePhoto(actor, { id });
    await removePhotos(photo);
  } catch (error) {
    if (error instanceof CommandError) return { error: error.message };
    throw error;
  }
  await flash("Photo deleted");
  refresh();
  return { done: true };
}

function itemFieldsFrom(form: FormData) {
  const text = (key: string) => String(form.get(key) ?? "");
  return { name: text("name"), sku: text("sku"), unitPrice: text("unitPrice"), description: text("description") };
}

// Left blank is no number at all, so a blank Count or Recount is refused rather than read as 0.
function typedNumber(value: string) {
  return value.trim() === "" ? Number.NaN : Number(value);
}

function typed(form: FormData) {
  return Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
}
