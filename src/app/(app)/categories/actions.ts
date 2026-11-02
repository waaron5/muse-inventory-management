"use server";

import { refresh } from "next/cache";
import { currentActor } from "@/server/auth";
import { flash } from "@/server/flash";
import { commands, CommandError } from "@/server/commands";

/** What a Categories sheet shows: a refusal, or done. */
export type CategoriesFormState = { error?: string; done?: boolean };

export async function deleteCategory(_state: CategoriesFormState, form: FormData): Promise<CategoriesFormState> {
  const actor = await currentActor();
  return settled("Category deleted", () => commands.deleteCategory(actor, { id: String(form.get("categoryId") ?? "") }));
}

/** Anyone can add a Category. */
export async function addCategory(_state: CategoriesFormState, form: FormData): Promise<CategoriesFormState> {
  const actor = await currentActor();
  return settled("Category added", () => commands.createCategory(actor, { name: String(form.get("name") ?? "") }));
}

export async function renameCategory(_state: CategoriesFormState, form: FormData): Promise<CategoriesFormState> {
  const actor = await currentActor();
  const text = (key: string) => String(form.get(key) ?? "");
  return settled("Category renamed", () => commands.renameCategory(actor, { categoryId: text("categoryId"), name: text("name") }));
}

// Says `done` in a snackbar once the change has committed.
async function settled(done: string, change: () => Promise<unknown>): Promise<CategoriesFormState> {
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
