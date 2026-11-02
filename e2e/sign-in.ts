import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { Client } from "pg";
import { e2eDatabaseURL } from "../playwright.config";

const outbox = path.join(process.cwd(), ".outbox", "mail.jsonl");

/** Invites a new person straight into the database, faster than the Users screen. */
export async function invite(role: "admin" | "user" = "user") {
  const email = `e2e-${randomUUID()}@example.com`;
  const client = new Client({ connectionString: e2eDatabaseURL });
  await client.connect();
  try {
    await client.query(`insert into "user" (id, name, email, role) values ($1, '', $2, $3)`, [
      randomUUID(),
      email,
      role,
    ]);
  } finally {
    await client.end();
  }
  return email;
}

/** The last code the app emailed to this address, read from the local outbox. */
export async function codeEmailedTo(email: string) {
  let code: string | undefined;
  await expect
    .poll(async () => {
      code = (await readOutbox()).findLast((mail) => mail.to === email && mail.code)?.code;
      return code;
    })
    .toBeTruthy();
  return code!;
}

/** Every subject the app emailed to this address, read from the local outbox. */
export async function subjectsEmailedTo(email: string) {
  return (await readOutbox()).filter((mail) => mail.to === email).map((mail) => mail.subject);
}

/** Every mail the app sent, oldest first, read from the local outbox. */
export async function readOutbox() {
  const lines = (await readFile(outbox, "utf8").catch(() => "")).trim().split("\n");
  return lines.filter(Boolean).map(
    (line) =>
      JSON.parse(line) as {
        to: string;
        subject: string;
        code?: string;
        text?: string;
        replyTo?: string;
        attachments?: string;
      },
  );
}

/** Signs a newly invited person in by emailed code and names them. */
export async function signInAsNewPerson(page: Page, name: string, role: "admin" | "user" = "user") {
  const email = await invite(role);
  await signInFirstTime(page, email, name);
  return email;
}

/** Signs an invited person in for the first time, by emailed code, and names them. */
export async function signInFirstTime(page: Page, email: string, name: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Code").fill(await codeEmailedTo(email));
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/events$/);
}
