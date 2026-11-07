# AI Connections

A person connects their own AI app (Claude, ChatGPT, Grok) to Muse Inventory, and it acts as them. The decisions are in [ADR 0017](adr/0017-ai-connections-act-as-the-person.md), and the term in [`CONTEXT.md`](../CONTEXT.md).

## How it fits together

- **`/mcp`** is a remote MCP server over Streamable HTTP (`src/app/mcp`, `src/server/ai`). It serves both the 2026-07-28 protocol and 2025-era clients, statelessly.
- **OAuth 2.1** comes from Better Auth's MCP plugin (`@better-auth/mcp`), configured in `src/server/auth/create-auth.ts`. AI apps find it through the protected resource metadata at `/.well-known/oauth-protected-resource/mcp` and the authorization server metadata at `/.well-known/oauth-authorization-server/api/auth`. They register with a Client ID Metadata Document, or with Dynamic Client Registration (`/api/auth/oauth2/register`) when they don't host one.
- **Only Better Auth's OAuth routes are public:** discovery, authorize, token, register and revoke. `src/server/ai/endpoints.ts` lists them; every other Better Auth route under `/api/auth` is not found, so sign-in keeps going through Server Actions and its own limits (ADR 0008).
- **Sign-in and the Allow screen.** An app sends its person to `/api/auth/oauth2/authorize`. Someone not signed in goes to `/sign-in` first, which carries the app's signed request through and goes on afterwards. Then `/connect` asks "Let <app> act as you in Muse Inventory?", with Allow and Cancel and no scopes.
- **An AI Connection acts as its person.** Access tokens are opaque and stored only as keyed hashes. Every call to `/mcp` looks its token up with its person, so a deactivated person is refused at once. Deactivating someone also deletes their tokens and consent, so reactivating them doesn't bring their AI Connections back.
- **Settings lists a person's own AI Connections** (`src/server/loaders/ai-connections.ts`): one per app they've Allowed that can still reach `/mcp` or renew its access, with when they Allowed it and when it last got an access token, which an app does at least hourly while in use. Nobody sees anyone else's, Admins included. Its **Disconnect** (`disconnectAiConnection`, never an AI's tool) deletes that person's tokens, Allow and any code still on its way to the app (`endAiConnections`, which deactivating uses too), for that app alone, since everyone's claude.ai is the same app: its next call is refused, and connecting again asks for Allow again.
- **They last 90 rolling days, like a session.** Access tokens last an hour; each refresh brings a new refresh token good for another 90 days, so one left unused for 90 days lapses and drops off the list.
- **Switched on by `AI_CONNECTIONS=1`**, read on each request. Without it, and always in the demo, `/mcp`, the OAuth routes, their discovery documents and `/connect` are not found, and Settings has no AI Connections card.

## Tools

| Tool | Reads or changes | What it does |
| --- | --- | --- |
| `search` | Reads | Inventory Items, Gifts, Events and Clients by name or SKU, up to 10 of each, Archived ones last. Items carry their Location, Category and Count, Events their Client and dates. Each has a link to its page. |
| `item` | Reads | One Inventory Item or Gift: details and Unit Price, Count, Location, Category, the Events it's reserved for, and its 20 latest History entries. |
| `availability` | Reads | Available for some items (by id, or a Category's Inventory Items, Archived ones left out unless asked for), over given dates as the Inventory list counts it or over an Event's Hold Window as the Event's page does, with any Shortage and the other Events holding each. |
| `events` | Reads | The Events list: Upcoming, Past or Cancelled, narrowed to a Client or a month. |
| `event` | Reads | One Event with its Lines, who added each, and its Shortages. |
| `activity` | Reads | Recent Activity, newest first, optionally one area (Events, catalog, Stock, people). |
| `locations`, `categories` | Reads | The reference lists, so a change can name an existing one. |
| `reportBug` | Changes | Report a bug's email (`src/server/bug-report.ts`), replying to the person, with "Reported via <app>" in place of page, device and last error. No screenshot, nothing stored. Counts toward the changes an hour, so a looping AI can't flood the maintainer's inbox. |
| Every command but the excluded ones | Changes | Each command an AI Connection may run is a tool of its own name (`reserve`, `createEvent`, `inviteUser`, …), described in Muse's words. |

Each read goes through the screen's own loader (`src/server/ai/reads.ts`), so its numbers match the screens; `src/server/ai/reads.test.ts` checks them against each other. Roles never limit seeing, so Unit Prices and P&L Codes come too. Dates are Muse calendar days (ADR 0005), as every tool with dates says.

### Changes

Every command decides, in `defineCommand`'s required `ai`, whether an AI Connection may run it (ADR 0017): `false`, or the description the AI is told. The excluded ones are permanent deletion, changing roles, deactivating, reactivating or deleting people, merging Clients, Acknowledging Shortages, photos, and your own profile. `src/server/commands/all.ts` lists every command; `src/server/commands/all.test.ts` finds them without the list and fails when one is missing from it, has no decision, or the excluded set changes.

`src/server/ai/changes.ts` makes each available command a tool:

- **It runs as the person**, through the command itself: the actor is the AI Connection's access token, re-checked in the command's transaction as a session is, so a User's AI is refused what's an Admin's with the same "Only an Admin can do this."
- **Its Activity is the person's, marked with the app** (`activity.via_ai_app`, and `via_ai_client_id` for which AI Connection). The Activity page shows "via AI" after the name, its hover label naming the app (`ViaAi`).
- **What the AI sends is checked by the command**, so a refusal is the command's own message. A tool shows the AI the command's own input, except where `ADAPTERS` gives it another: edits take only the fields that change and fill in the rest, items are added without a photo, and `adjustStock` takes one flat object.
- **At most 300 changes an hour per AI Connection** (`src/server/ai/change-limit.ts`), so an AI stuck in a loop with "always allow" stops. Each change tool call, and each `reportBug`, is counted before it runs, refused or not, in one upsert on `ai_change_count`: one row per person and app (not per access token, which renews hourly), started again at each clock hour, so it needs no clearing. Like sign-in's limits (ADR 0008), it counts in one statement so calls at the same moment can't slip past. Past it, the tool says "That's a lot of changes at once. Try again later, or do it in the app" with a link and writes nothing, and Sentry hears once that hour. Reads and the person's own changes on screen don't count.
- **The answer says what changed** as the Activity sentence does ("Quinn reserved 12 Folding chair for Cove"), with links to the Events and items it names, what the command returned (such as a new id), and any Shortage flagged on an Event it names. An invite is emailed, as on screen.

The server's instructions (`src/server/ai/mcp-server.ts`) give the AI Muse's words, tell it never to guess between matches, and send it to the app, with a link, for what it can't do.

## Trying it locally

1. Migrate your local database (`pnpm db:migrate`), then start the app with AI Connections on. If something else has port 3000, use another and tell Better Auth:

   ```bash
   AI_CONNECTIONS=1 BETTER_AUTH_URL=http://localhost:3005 pnpm dev --port 3005
   ```

2. Have someone to sign in as in that database (`pnpm admin:create <email>`, or an invite). Without a Resend key, sign-in codes land in `.outbox/mail.jsonl`.

3. Connect an MCP client to `http://localhost:3005/mcp`:

   - **MCP Inspector:** `npx @modelcontextprotocol/inspector`, open the address it prints, then **Add Servers → Add manually**, transport `streamable-http`, URL `http://localhost:3005/mcp`, and switch it on. It registers itself, sends you through sign-in and the Allow screen, and comes back connected. Under **Tools**, run `search`.
   - **Claude Code:** `claude mcp add --transport http muse-local http://localhost:3005/mcp`, then `/mcp` in a session and **Authenticate**.

   Discovery and Dynamic Client Registration work on `localhost`. Client ID Metadata Documents need the AI app's document on a public HTTPS address, so they can only be tried on a deployed copy.

4. To start again, Disconnect it in Settings, or deactivate and reactivate the person.
