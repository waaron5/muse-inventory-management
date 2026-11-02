import { readFlash } from "@/server/flash";
import { Toaster } from "../toaster";

/** The confirmation a Server Action left for this screen, streamed into the prerendered shell. */
export async function Flash() {
  return <Toaster flash={await readFlash()} />;
}
