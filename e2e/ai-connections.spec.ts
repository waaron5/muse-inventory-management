import { createHash, randomBytes } from "node:crypto";
import { expect, type APIRequestContext, type Page, test } from "@playwright/test";
import { codeEmailedTo, invite } from "./sign-in";

/**
 * An AI app registers itself and sends someone newly invited to authorize:
 * they sign in by code and reach the Allow screen.
 */
async function toTheAllowScreen(page: Page, request: APIRequestContext, baseURL: string, appName: string) {
  const callback = `${baseURL}/ai-app-callback`;
  const registered = await request.post("/api/auth/oauth2/register", {
    data: { client_name: appName, redirect_uris: [callback], token_endpoint_auth_method: "none" },
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

  /** The app swaps the code it was sent back with for its tokens. */
  const tokensFor = async (code: string) => {
    const response = await request.post("/api/auth/oauth2/token", {
      form: { grant_type: "authorization_code", code, redirect_uri: callback, client_id, code_verifier: verifier, resource: `${baseURL}/mcp` },
    });
    expect(response.ok()).toBe(true);
    return (await response.json()) as { access_token: string };
  };
  return { tokensFor };
}

test("an AI app's person signs in by code, sees the Allow screen, and can Cancel", async ({ page, request, baseURL }) => {
  await toTheAllowScreen(page, request, baseURL!, "Playwright AI");

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

test("Settings lists the person's AI Connection, and Disconnect cuts it", async ({ page, request, baseURL }) => {
  const app = await toTheAllowScreen(page, request, baseURL!, "Settings AI");
  await page.getByRole("button", { name: "Allow" }).click();
  await expect(page.getByText("Back in the AI app")).toBeVisible();
  const { access_token } = await app.tokensFor(new URL(page.url()).searchParams.get("code")!);
  const callMcp = () => request.post("/mcp", {
    headers: { authorization: `Bearer ${access_token}`, accept: "application/json, text/event-stream" },
    data: { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "e2e", version: "1" } } },
  });
  expect((await callMcp()).status()).toBe(200);
  // Newly invited, they name themselves first.
  await page.goto("/events");
  await page.getByLabel("Your name").fill("Quinn");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/events$/);

  await page.goto("/settings#ai-connections");

  const card = page.locator("#ai-connections");
  await expect(card.getByRole("heading", { name: "AI Connections" })).toBeVisible();
  await expect(card.getByText("Settings AI")).toBeVisible();
  await expect(card.getByText("Connected today · Last used today")).toBeVisible();

  await card.getByRole("button", { name: "More for Settings AI" }).click();
  await page.getByRole("menuitem", { name: "Disconnect" }).click();
  await expect(page.getByText("It stops working in Muse Inventory at once.")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Disconnect" }).click();

  await expect(card.getByText("Settings AI")).toBeHidden();
  await expect(card.getByText(`${baseURL}/mcp`)).toBeVisible();
  await expect(card.getByRole("link", { name: "How to connect" })).toBeVisible();
  expect((await callMcp()).status()).toBe(401);
});
