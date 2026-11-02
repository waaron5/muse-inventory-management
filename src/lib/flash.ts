/**
 * A snackbar's message carried to the next screen: set by a Server Action
 * only once its command has committed (server/flash), shown and cleared by
 * the Toaster (components/toaster). Readable by the page, so it can clear it.
 */
export const flashCookie = "flash";

export type Flash = { id: string; message: string };

export function parseFlash(value: string | undefined): Flash | null {
  if (!value) return null;
  try {
    const flash = JSON.parse(value) as Partial<Flash>;
    return typeof flash.id === "string" && typeof flash.message === "string" ? { id: flash.id, message: flash.message } : null;
  } catch {
    return null;
  }
}
