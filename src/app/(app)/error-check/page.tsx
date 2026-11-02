import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Error check" };

// Fails on purpose, so the error page and Report this can be seen working: by
// the Playwright smoke, or the maintainer on a preview. Production has none.
export default function ErrorCheckPage() {
  return (
    <Suspense>
      <Fails />
    </Suspense>
  );
}

async function Fails(): Promise<never> {
  await connection();
  if (process.env.VERCEL_ENV === "production") notFound();
  throw new Error("Error check: deliberate error");
}
