import "server-only";
import { db } from "@/db";
import { resetDemo } from "./seed";

/** Empties the demo's database and seeds it again (ADR 0016). Vercel Cron runs it nightly. */
export const resetTheDemo = () => resetDemo(db);
