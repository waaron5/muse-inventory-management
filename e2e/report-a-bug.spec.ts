import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { readOutbox, signInAsNewPerson } from "./sign-in";

const heic = path.join(process.cwd(), "e2e", "fixtures", "iphone-photo.heic");

/** The bug report the maintainer got from this person, read from the local outbox. */
async function reportFrom(email: string) {
  let found: Awaited<ReturnType<typeof readOutbox>>[number] | undefined;
  await expect
    .poll(async () => {
      found = (await readOutbox()).findLast((mail) => mail.replyTo === email);
      return found;
    })
    .toBeTruthy();
  return found!;
}

/** Cuts the page off from its Server Actions until the returned undo is called. */
async function offline(page: Page) {
  const cut = "**/*";
  await page.route(cut, (route) => (route.request().headers()["next-action"] ? route.abort() : route.continue()));
  return () => page.unroute(cut);
}

test("reports a bug from the account menu, with a screenshot, after a send that failed", async ({ page }) => {
  const email = await signInAsNewPerson(page, "Bug Finder");

  await page.getByRole("button", { name: "Account: Bug Finder" }).filter({ visible: true }).click();
  await page.getByRole("menuitem", { name: "Report a bug" }).click();
  const sheet = page.getByRole("dialog", { name: "Report a bug" });
  await sheet.getByLabel("What happened?").fill("The Load button did nothing");
  await sheet.getByLabel("Screenshot").setInputFiles(heic);
  await expect(sheet.getByText("iphone-photo.heic")).toBeVisible();

  // A send that never reaches the server keeps the text and the screenshot.
  // The HEIC is made a JPEG first, which takes a while off Safari.
  const reconnect = await offline(page);
  await sheet.getByRole("button", { name: "Send" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("Couldn't send. Try again.", { timeout: 30_000 });
  await expect(sheet.getByLabel("What happened?")).toHaveValue("The Load button did nothing");
  await expect(sheet.getByText("iphone-photo.heic")).toBeVisible();

  await reconnect();
  await sheet.getByRole("button", { name: "Send" }).click();
  await expect(sheet.getByRole("status")).toHaveText("Sent, thanks.", { timeout: 30_000 });

  const report = await reportFrom(email);
  expect(report.to).toBe("maintainer@example.com");
  expect(report.subject).toBe("Bug report from Bug Finder: The Load button did nothing");
  expect(report.attachments).toBe("screenshot.jpg");
  expect(report.text).toContain(`From: Bug Finder <${email}>, User`);
  expect(report.text).toMatch(/Page: http:\/\/localhost:\d+\/events/);
  expect(report.text).toMatch(/Device: Mozilla\/5\.0/);
});

test("Report this from the error page attaches the error's tracker ID", async ({ page }) => {
  const email = await signInAsNewPerson(page, "Error Finder");

  await page.goto("/error-check");
  await expect(page.getByRole("heading", { name: "Something went wrong." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Go back" })).toBeVisible();

  await page.getByRole("button", { name: "Report this" }).click();
  const sheet = page.getByRole("dialog", { name: "Report a bug" });
  await sheet.getByLabel("What happened?").fill("Opened the error check");
  await sheet.getByRole("button", { name: "Send" }).click();
  await expect(sheet.getByRole("status")).toHaveText("Sent, thanks.");

  const report = await reportFrom(email);
  expect(report.text).toMatch(/Page: http:\/\/localhost:\d+\/error-check/);
  // A server error is known by its digest, which Sentry tags its event with.
  expect(report.text).toMatch(/Last error: .+ \(tracker ID \d+\)/);
});

test("a single action that fails shows its message inline, with Try again", async ({ page }) => {
  await signInAsNewPerson(page, "Inline Failure");
  await page.goto("/settings");
  const name = page.getByLabel("Your name");
  await page.getByRole("button", { name: "Edit name" }).click();
  await name.fill("Inline F.");

  const reconnect = await offline(page);
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /./ })).toHaveText("Something went wrong. Try again.");
  await expect(page.getByText("Name saved")).toHaveCount(0);

  await reconnect();
  await name.fill("Inline F.");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByText("Name saved")).toBeVisible();
});
