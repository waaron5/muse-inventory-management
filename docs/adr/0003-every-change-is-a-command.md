# Every change to data is a command; reads go through one loader per screen

Every change to data is a named **command**: a plain TypeScript function `(actor, input)` such as `reserve` or `transferStock` that validates its input, checks the actor's role, writes the change and its History entries in one transaction, and reports which data went stale. Server Actions are thin wrappers that call exactly one command, and nothing else may write to the database; the daily automatic giveaway is the one command with no actor (ADR 0010). Reads go through a separate set of **screen loaders**, one per screen, each a set-based query or two. We chose this so permissions and "who, when and why" are enforced in one place rather than per screen, and so an API or MCP interface can be added after v2 by calling the same commands.

## Consequences

- Admin overrides (fixing a count, marking something returned, acknowledging a Shortage) are commands like any other, so they are recorded the same way and never edit History in place.
- A lint rule or module boundary stops anything outside the command module from importing the database client for writes.
- Every command re-checks the actor's session in the database before writing (see ADR 0008); a command is one round trip, and the UI updates optimistically rather than refreshing the page after it.
- Commands and loaders are where the domain rules live, so they are what the integration tests exercise, against real Postgres.
