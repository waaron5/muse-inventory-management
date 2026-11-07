# AI Connections

Ask your own AI app (Claude, ChatGPT or Grok) to work in Muse Inventory for you: "what chairs are free the second week of March?", "add these 20 items to the Gala", "invite a new teammate", "report a bug". It finds things, reserves them, adds to the catalog and the rest, much as you would on screen.

**It acts as you.** Whatever it does is done by you: Activity shows your name, with a small "via AI" mark naming the app. It sees what you see, and can change only what your role allows. Your AI app will usually ask before it changes anything; read what it's about to do before you say yes, and keep "always allow" for the apps you trust.

## Connecting your AI app

Each person connects their own. You need the address:

```
https://inventory.museem.com/mcp
```

Add it to your AI app as a custom connector, as below. Your app then opens Muse Inventory: sign in with your emailed code if you aren't already, then press **Allow** on "Let ... act as you in Muse Inventory?". That's it. You only do this once per app.

These apps move their menus around now and then; if a step doesn't match, look for **Connectors** or **Apps** in the app's settings.

### Claude

1. On [claude.ai](https://claude.ai), open **Customize → Connectors** (in some versions **Settings → Connectors**).
2. Press **+ Add**, then **Add custom connector**.
3. Name it **Muse Inventory**, paste the address, and press **Add**.
4. Press **Connect**, then sign in and **Allow**.
5. In a chat, press **+ → Connectors** and make sure Muse Inventory is switched on.

Claude's free plan allows one custom connector.

### ChatGPT

ChatGPT only lets a custom connector make changes with **Developer mode** on, which needs a paid plan. On a Business workspace, an admin may need to allow it first.

1. On [chatgpt.com](https://chatgpt.com), open **Settings → Apps & Connectors → Advanced settings** and turn on **Developer mode**.
2. Back in **Apps & Connectors**, press **Create**.
3. Name it **Muse Inventory**, paste the address, choose **OAuth** for authentication, confirm you trust it, and press **Create**.
4. Sign in and **Allow**.
5. In a chat, press **+ → More** and choose Muse Inventory. ChatGPT only uses it in chats where it's chosen.

### Grok

1. Go to [grok.com/connectors](https://grok.com/connectors).
2. Press **New Connector**, then **Custom**.
3. Name it **Muse Inventory**, paste the address, and save.
4. Sign in and **Allow**. If nothing opens, let your browser show pop-ups from grok.com.

## What it can do

- **Look anything up:** items, Gifts, Events and Clients, what's Available over some dates or for an Event, an Event's Lines and Shortages, recent Activity, Locations and Categories.
- **Make changes your role allows:** create, edit and cancel Events, add Clients, reserve items and change Reservations, add, edit and archive items, record Stock changes, add Locations and Categories, invite people (Admins only), and report a bug.
- **Lists go one item at a time.** Give it a list and it adds each one on its own, then tells you which went through and which didn't. A Reservation for more than is Available still saves, and it tells you which Shortage that caused, as the app does.
- **It asks when it isn't sure.** If what you said matches more than one thing (two Events with the same name, say), it lists them and asks which one.
- **It links back.** Everything it mentions comes with a link to open it in Muse Inventory.

## What stays in the app

Your AI can't delete anything, change someone's role, deactivate, reactivate or delete people, merge Clients, Acknowledge Shortages, add photos, or change your own name or colour. Ask for one of these and it gives you a link to do it in Muse Inventory yourself.

It can also make at most 300 changes an hour. Looking things up is not limited.

## Disconnecting

**Settings → AI Connections** lists each AI app you've connected, with when you connected it and when it was last used. Press **⋯ → Disconnect** to cut one off at once; to use it again, connect it again. A connection left unused for 90 days ends by itself. Nobody else sees your AI Connections, Admins included. Deactivating someone ends all of theirs.

## For the maintainer

The decisions are in [ADR 0017](adr/0017-ai-connections-act-as-the-person.md), and the term in [`CONTEXT.md`](../CONTEXT.md).

### How it fits together

- **`/mcp`** is a remote MCP server over Streamable HTTP (`src/app/mcp`, `src/server/ai`). It serves both the 2026-07-28 protocol and 2025-era clients, statelessly.
- **OAuth 2.1** comes from Better Auth's MCP plugin (`@better-auth/mcp`), configured in `src/server/auth/create-auth.ts`. AI apps find it through the protected resource metadata at `/.well-known/oauth-protected-resource/mcp` and the authorization server metadata at `/.well-known/oauth-authorization-server/api/auth`. They register with a Client ID Metadata Document, or with Dynamic Client Registration (`/api/auth/oauth2/register`) when they don't host one.
- **Only Better Auth's OAuth routes are public:** discovery, authorize, token, register and revoke. `src/server/ai/endpoints.ts` lists them; every other Better Auth route under `/api/auth` is not found, so sign-in keeps going through Server Actions and its own limits (ADR 0008).
- **Sign-in and the Allow screen.** An app sends its person to `/api/auth/oauth2/authorize`. Someone not signed in goes to `/sign-in` first, which carries the app's signed request through and goes on afterwards. Then `/connect` asks "Let <app> act as you in Muse Inventory?", with Allow and Cancel and no scopes.
- **An AI Connection acts as its person.** Access tokens are opaque and stored only as keyed hashes. Every call to `/mcp` looks its token up with its person, so a deactivated person is refused at once. Deactivating someone also deletes their tokens and consent, so reactivating them doesn't bring their AI Connections back.
- **Settings lists a person's own AI Connections** (`src/server/loaders/ai-connections.ts`): one per app they've Allowed that can still reach `/mcp` or renew its access, with when they Allowed it and when it last got an access token, which an app does at least hourly while in use. Nobody sees anyone else's, Admins included. Its **Disconnect** (`disconnectAiConnection`, never an AI's tool) deletes that person's tokens, Allow and any code still on its way to the app (`endAiConnections`, which deactivating uses too), for that app alone, since everyone's claude.ai is the same app: its next call is refused, and connecting again asks for Allow again.
- **They last 90 rolling days, like a session.** Access tokens last an hour; each refresh brings a new refresh token good for another 90 days, so one left unused for 90 days lapses and drops off the list.
- **Switched on by `AI_CONNECTIONS=1`**, read on each request. Without it, and always in the demo, `/mcp`, the OAuth routes, their discovery documents and `/connect` are not found, and Settings has no AI Connections card.

### Tools

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

#### Changes

Every command decides, in `defineCommand`'s required `ai`, whether an AI Connection may run it (ADR 0017): `false`, or the description the AI is told. The excluded ones are permanent deletion, changing roles, deactivating, reactivating or deleting people, merging Clients, Acknowledging Shortages, photos, and your own profile. `src/server/commands/all.ts` lists every command; `src/server/commands/all.test.ts` finds them without the list and fails when one is missing from it, has no decision, or the excluded set changes.

`src/server/ai/changes.ts` makes each available command a tool:

- **It runs as the person**, through the command itself: the actor is the AI Connection's access token, re-checked in the command's transaction as a session is, so a User's AI is refused what's an Admin's with the same "Only an Admin can do this."
- **Its Activity is the person's, marked with the app** (`activity.via_ai_app`, and `via_ai_client_id` for which AI Connection). The Activity page shows "via AI" after the name, its hover label naming the app (`ViaAi`).
- **What the AI sends is checked by the command**, so a refusal is the command's own message. A tool shows the AI the command's own input, except where `ADAPTERS` gives it another: edits take only the fields that change and fill in the rest, items are added without a photo, and `adjustStock` takes one flat object.
- **At most 300 changes an hour per AI Connection** (`src/server/ai/change-limit.ts`), so an AI stuck in a loop with "always allow" stops. Each change tool call, and each `reportBug`, is counted before it runs, refused or not, in one upsert on `ai_change_count`: one row per person and app (not per access token, which renews hourly), started again at each clock hour, so it needs no clearing. Like sign-in's limits (ADR 0008), it counts in one statement so calls at the same moment can't slip past. Past it, the tool says "That's a lot of changes at once. Try again later, or do it in the app" with a link and writes nothing, and Sentry hears once that hour. Reads and the person's own changes on screen don't count.
- **The answer says what changed** as the Activity sentence does ("Quinn reserved 12 Folding chair for Cove"), with links to the Events and items it names, what the command returned (such as a new id), and any Shortage flagged on an Event it names. An invite is emailed, as on screen.

The server's instructions (`src/server/ai/mcp-server.ts`) give the AI Muse's words, tell it never to guess between matches, and send it to the app, with a link, for what it can't do.

### Trying it locally

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
