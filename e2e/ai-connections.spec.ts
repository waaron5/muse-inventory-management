import { createHash, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { codeEmailedTo, invite } from "./sign-in";

test("an AI app's person signs in by code, sees the Allow screen, and can Cancel", async ({ page, request, baseURL }) => {
  // The AI app registers itself, then sends its person's browser to authorize.
  const callback = `${baseURL}/ai-app-callback`;
  const registered = await request.post("/api/auth/oauth2/register", {
    data: { client_name: "Playwright AI", redirect_uris: [callback], token_endpoint_auth_method: "none" },
  });
  expect(registered.status()).toBe(201);
  const { client_id } = await registered.json();
  const verifier = randomBytes(32).toString("base64url");
  const authorize = new URL("/api/auth/oauth2/authorize", baseURL);
  authorize.search = new URLSearchParams({
    response_type: "code",
    client_id,
    redirect_uri: callback,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    resource: `${baseURL}/mcp`,
    state: "from-the-app",
  }).toString();
  const email = await invite();
  // The app's own page, where the browser comes back to.
  await page.route(`${callback}?*`, (route) => route.fulfill({ contentType: "text/plain", body: "Back in the AI app" }));

  await page.goto(authorize.toString());

  await expect(page).toHaveURL(/\/sign-in\?/);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Code").fill(await codeEmailedTo(email));

  await expect(page).toHaveURL(/\/connect\?/);
  await expect(page.getByRole("heading", { name: "Let Playwright AI act as you in Muse Inventory?" })).toBeVisible();
  await expect(
    page.getByText("It can see everything you can and make the changes you can, except deleting, managing people, merging Clients, Acknowledging Shortages and photos."),
  ).toBeVisible();
  await expect(page.getByText("Either way, you’ll go back to localhost.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Allow" })).toBeVisible();

  await page.getByRole("button", { name: "Cancel" }).click();

  await expect(page.getByText("Back in the AI app")).toBeVisible();
  const back = new URL(page.url());
  expect(back.searchParams.get("error")).toBe("access_denied");
  expect(back.searchParams.get("state")).toBe("from-the-app");
  expect(back.searchParams.get("code")).toBeNull();
});
