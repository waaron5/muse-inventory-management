/**
 * Where an edit goes once it's saved: back where it was opened from (the list
 * when edited from a row's "⋯", the page itself otherwise). Only a path in
 * this app counts, so a crafted link can't send anyone elsewhere.
 */
export function backTo(form: FormData, fallback: string) {
  return safeBack(String(form.get("back") ?? "")) ?? fallback;
}

/** `back` if it's a path in this app. */
export function safeBack(back: string | undefined) {
  return back && back.startsWith("/") && !back.startsWith("//") && !back.startsWith("/\\") ? back : undefined;
}
