import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { client, event } from "@/db/schema";
import type { Tx } from "@/db/types";
import { clientColour, clientColours } from "@/lib/client-colour";
import { CommandError } from "../errors";
import { ref, said } from "./activity";
import { defineCommand } from "./define";
import { clientName } from "./event-fields";

// Admins tidy up the Clients that planning adds inline: renaming one, merging
// a duplicate into the one it duplicates, and archiving one Muse no longer
// works for. An Archived Client keeps its Events.

const aClient = z.uuid("That Client no longer exists.");

export const createClient = defineCommand({
  name: "createClient",
  input: z.object({ name: clientName("Give the Client a name.") }),
  allow: ["admin", "user"],
  run: async (tx, _actor, { name }, record) => {
    const [created] = await tx.insert(client).values({ name, colour: clientColour(name) }).onConflictDoNothing().returning({ id: client.id });
    if (!created) throw new CommandError("invalid", "That Client already exists.");
    await record("events", said`added Client ${ref.client(created.id, name)}`);
    return created;
  },
});

/** Everyone can choose the colour shared by this Client's Events. */
export const setClientColour = defineCommand({
  name: "setClientColour",
  input: z.object({ clientId: aClient, colour: z.string().pipe(z.enum(clientColours, { error: "Pick a Client colour." })) }),
  allow: ["admin", "user"],
  run: async (tx, _actor, { clientId, colour }, record) => {
    const current = await lockClient(tx, clientId);
    await tx.update(client).set({ colour }).where(eq(client.id, clientId));
    await record("events", colour === current.colour ? null : said`changed Client ${ref.client(clientId, current.name)}'s colour to ${colour}`);
  },
});

export const renameClient = defineCommand({
  name: "renameClient",
  input: z.object({ clientId: aClient, name: clientName("Give the Client a name.") }),
  allow: ["admin"],
  run: async (tx, _actor, { clientId, name }, record) => {
    const current = await lockClient(tx, clientId);
    // Names are unique ignoring case, so two the same are one Client twice.
    const [other] = await tx
      .select({ name: client.name })
      .from(client)
      .where(and(eq(sql`lower(${client.name})`, name.toLowerCase()), ne(client.id, clientId)));
    if (other) {
      throw new CommandError(
        "invalid",
        `Another Client is already called ${other.name}. Merge ${current.name} into it instead.`,
      );
    }
    await tx.update(client).set({ name }).where(eq(client.id, clientId));
    await record("events", name === current.name ? null : said`renamed Client ${current.name} to ${ref.client(clientId, name)}`);
  },
});

/** Every Event of the duplicate moves to the Client it duplicates, and the duplicate is gone. */
export const mergeClients = defineCommand({
  name: "mergeClients",
  input: z.object({ clientId: aClient, intoClientId: aClient }),
  allow: ["admin"],
  run: async (tx, _actor, { clientId, intoClientId }, record) => {
    if (clientId === intoClientId) {
      const { name } = await lockClient(tx, clientId);
      throw new CommandError("invalid", `Pick another Client to merge ${name} into.`);
    }
    // Locked in one order, so two merges of the same pair at once can't deadlock.
    const [first, second] = [clientId, intoClientId].sort();
    const locked = { [first]: await lockClient(tx, first), [second]: await lockClient(tx, second) };
    const into = locked[intoClientId];
    if (into.archived) throw new CommandError("invalid", `${into.name} is Archived. Unarchive it before merging into it.`);
    await tx.update(event).set({ clientId: intoClientId }).where(eq(event.clientId, clientId));
    await tx.delete(client).where(eq(client.id, clientId));
    await record("events", said`merged Client ${ref.client(clientId, locked[clientId].name)} into ${ref.client(intoClientId, into.name)}`);
  },
});

export const archiveClient = defineCommand({
  name: "archiveClient",
  input: z.object({ clientId: aClient }),
  allow: ["admin"],
  run: async (tx, _actor, { clientId }, record) => {
    const found = await lockClient(tx, clientId);
    if (found.archived) throw new CommandError("invalid", `${found.name} is already Archived.`);
    await tx.update(client).set({ archivedAt: new Date() }).where(eq(client.id, clientId));
    await record("events", said`archived Client ${ref.client(clientId, found.name)}`);
  },
});

export const unarchiveClient = defineCommand({
  name: "unarchiveClient",
  input: z.object({ clientId: aClient }),
  allow: ["admin"],
  run: async (tx, _actor, { clientId }, record) => {
    const found = await lockClient(tx, clientId);
    if (!found.archived) throw new CommandError("invalid", `${found.name} isn't Archived.`);
    await tx.update(client).set({ archivedAt: null }).where(eq(client.id, clientId));
    await record("events", said`unarchived Client ${ref.client(clientId, found.name)}`);
  },
});

/** The Client, locked until this saves, so an Event can't be planned for one being merged away. */
async function lockClient(tx: Tx, id: string) {
  const [found] = await tx
    .select({ name: client.name, colour: client.colour, archived: sql<boolean>`${client.archivedAt} is not null` })
    .from(client)
    .where(eq(client.id, id))
    .for("update");
  if (!found) throw new CommandError("invalid", "That Client no longer exists.");
  return found;
}
