# AI Connections act as the person, with every command available except an excluded list

Muse people want to ask their own AI app (Claude, ChatGPT, Grok) to check availability, reserve items, add to the catalog or invite someone, and have it done. The app is a remote MCP server built to the standard, so any compliant AI app can connect and Muse's own AI plans pay for the model. Each person connects their own app with the usual emailed-code sign-in and one Allow screen (OAuth), and the AI Connection then acts **as that person**: every change goes through the same commands (ADR 0003) with that person as the actor, re-checked in the database each time (ADR 0008), and records their Activity with a "via AI" mark naming the app (ADR 0013). There is no shared AI account, so who did what stays true, an AI can never do more than its person's role allows, and deactivating the person ends their AI Connections.

Every command is available to an AI Connection unless it is on a short **excluded list**: permanent deletion, changing roles, deactivating, reactivating or deleting people, merging Clients, Acknowledging Shortages, and photos. Each command says whether it is excluded, and a test fails when a new command says neither, so new abilities reach the AI without being added one by one but never without a decision. Excluded actions stay in the app, where a person sees exactly what they are doing; the AI is told to send people there with a link.

## Considered Options

- **A shared AI account with its own role**: one thing to manage, but Activity could only ever say "Claude", and an AI's limits would no longer follow its person's.
- **An allowlist of exposed commands**: safer by default, but every new command, and every change during Muse's trial, would need a second step to reach the AI.
- **The person's full role**: simplest, but an AI with "always allow" on could permanently delete or lock people out with nobody looking.

## Consequences

- An AI Connection lasts like a session (90 rolling days), is listed in Settings with its own Disconnect, and is capped at 300 changes an hour; reads are not limited.
- Confirmation before a change is left to the AI app's own approval prompt; the app adds none.
- AI Connections are switched on per environment and are off in the public demo.
