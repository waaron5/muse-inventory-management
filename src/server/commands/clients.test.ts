import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/types";
import { addUser, testDb } from "@/test/db";
import { loadClientsScreen } from "../loaders/clients";
import { loadEventsScreen } from "../loaders/events";
import { archiveClient, createClient, mergeClients, renameClient, setClientColour, unarchiveClient } from "./clients";
import { createEvent } from "./create-event";
import { editEvent } from "./edit-event";
import { loadEventScreen } from "../loaders/event";
import { loadPrintScreen } from "../loaders/print";
import { loadActivityScreen } from "../loaders/activity";
import { clientColour } from "@/lib/client-colour";

let db: Db;
let admin: Awaited<ReturnType<typeof addUser>>;
let someone: Awaited<ReturnType<typeof addUser>>;
beforeAll(async () => {
  db = await testDb();
  admin = await addUser(db, { role: "admin" });
  someone = await addUser(db, { role: "user" });
});

const plan = (name: string, client: string) => createEvent(db, someone, { name, client: { name: client } });
const clientNamed = async (name: string) => (await loadClientsScreen(db)).clients.find((c) => c.name === name)!;
const eventsOf = async (clientId: string) =>
  (await loadEventsScreen(db, { clientId })).events.map((e) => e.name).sort();

describe("Client colours", () => {
  it("saves an initial colour for Clients created in Settings and inline", async () => {
    await createClient(db, someone, { name: "Colour settings" });
    await plan("Colour inline event", "Colour inline");
    for (const name of ["Colour settings", "Colour inline"]) {
      expect(await clientNamed(name)).toMatchObject({ colour: clientColour(name) });
    }
  });

  it("lets a User choose a colour for every Event view, keeping it through renames", async () => {
    const event = await plan("Colour event", "Colour client");
    const client = await clientNamed("Colour client");
    await setClientColour(db, someone, { clientId: client.id, colour: "green" });
    await renameClient(db, admin, { clientId: client.id, name: "Colour client renamed" });

    expect(await clientNamed("Colour client renamed")).toMatchObject({ colour: "green" });
    expect((await loadEventsScreen(db, { clientId: client.id })).events[0].client.colour).toBe("green");
    expect((await loadEventScreen(db, event.id))?.client.colour).toBe("green");
    expect((await loadPrintScreen(db, event.id))?.client.colour).toBe("green");
    const { entries } = await loadActivityScreen(db, {});
    expect(entries.some((entry) => entry.sentence.some((part) => part === "'s colour to green"))).toBe(true);
  });

  it("lets an Admin change an Archived Client's colour", async () => {
    await createClient(db, someone, { name: "Archived colour" });
    const client = await clientNamed("Archived colour");
    await archiveClient(db, admin, { clientId: client.id });
    await setClientColour(db, admin, { clientId: client.id, colour: "blue" });
    expect(await clientNamed("Archived colour")).toMatchObject({ colour: "blue", archived: true });
  });

  it("rejects an unknown colour, a missing Client and a signed-out actor", async () => {
    await createClient(db, someone, { name: "Invalid colour" });
    const client = await clientNamed("Invalid colour");
    await expect(setClientColour(db, someone, { clientId: client.id, colour: "teal" })).rejects.toMatchObject({ code: "invalid" });
    await expect(setClientColour(db, someone, { clientId: crypto.randomUUID(), colour: "rose" })).rejects.toMatchObject({ code: "invalid" });
    await expect(setClientColour(db, { userId: someone.userId, sessionId: crypto.randomUUID() }, { clientId: client.id, colour: "rose" })).rejects.toMatchObject({ code: "not-signed-in" });
    expect((await clientNamed(client.name)).colour).toBe(client.colour);
  });
});

describe("mergeClients", () => {
  it("leaves one Client with all the Events", async () => {
    await plan("Roadshow", "Ivorypeak");
    await plan("Summit", "Ivorypeak Inc");
    await plan("Offsite", "Ivorypeak Inc");
    const survivor = await clientNamed("Ivorypeak");
    const duplicate = await clientNamed("Ivorypeak Inc");

    await mergeClients(db, admin, { clientId: duplicate.id, intoClientId: survivor.id });

    expect(await eventsOf(survivor.id)).toEqual(["Offsite", "Roadshow", "Summit"]);
    expect(await clientNamed("Ivorypeak Inc")).toBeUndefined();
    expect(await clientNamed("Ivorypeak")).toMatchObject({ events: 3 });
  });

  it("refuses merging a Client into itself, or into one that's gone", async () => {
    await plan("Retreat", "Domo");
    const domo = await clientNamed("Domo");

    await expect(mergeClients(db, admin, { clientId: domo.id, intoClientId: domo.id })).rejects.toMatchObject({
      code: "invalid",
      message: "Pick another Client to merge Domo into.",
    });
    await expect(
      mergeClients(db, admin, { clientId: domo.id, intoClientId: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: "invalid", message: "That Client no longer exists." });
  });

  it("refuses merging into an Archived Client", async () => {
    await plan("Ball", "Nike");
    await plan("Ball 2", "Nike Inc");
    const [nike, inc] = [await clientNamed("Nike"), await clientNamed("Nike Inc")];
    await archiveClient(db, admin, { clientId: nike.id });

    await expect(mergeClients(db, admin, { clientId: inc.id, intoClientId: nike.id })).rejects.toMatchObject({
      code: "invalid",
      message: "Nike is Archived. Unarchive it before merging into it.",
    });
  });

  it("is an Admin's to do", async () => {
    await plan("Kickoff", "Qualtrics");
    await plan("Kickoff 2", "Qualtrics Inc");
    const [one, two] = [await clientNamed("Qualtrics"), await clientNamed("Qualtrics Inc")];

    await expect(mergeClients(db, someone, { clientId: two.id, intoClientId: one.id })).rejects.toMatchObject({
      code: "not-allowed",
    });
  });
});

describe("renameClient", () => {
  it("renames a Client, its Events with it", async () => {
    await plan("Gala", "Birch Line");
    const birch = await clientNamed("Birch Line");

    await renameClient(db, admin, { clientId: birch.id, name: "  Birchline " });

    expect(await clientNamed("Birchline")).toMatchObject({ id: birch.id });
    expect((await loadEventsScreen(db, { clientId: birch.id })).events[0].client.name).toBe("Birchline");
  });

  it("refuses a name another Client has, pointing to Merge", async () => {
    await plan("Dinner", "Adobe");
    await plan("Lunch", "Adobe Inc");
    const inc = await clientNamed("Adobe Inc");

    await expect(renameClient(db, admin, { clientId: inc.id, name: "adobe" })).rejects.toMatchObject({
      code: "invalid",
      message: "Another Client is already called Adobe. Merge Adobe Inc into it instead.",
    });
  });

  it("refuses an empty name", async () => {
    await plan("Party", "Pluralsight");
    const client = await clientNamed("Pluralsight");

    await expect(renameClient(db, admin, { clientId: client.id, name: " " })).rejects.toMatchObject({
      message: "Give the Client a name.",
    });
  });

  it("is an Admin's to do", async () => {
    await plan("Breakfast", "Vivint");
    const vivint = await clientNamed("Vivint");

    await expect(renameClient(db, someone, { clientId: vivint.id, name: "Vivint Solar" })).rejects.toMatchObject({
      code: "not-allowed",
    });
  });
});

describe("archiveClient", () => {
  it("drops a Client from the Client filter, keeping its Events; unarchiving brings it back", async () => {
    await plan("Old launch", "Overstock");
    const overstock = await clientNamed("Overstock");
    const filterOptions = async () => (await loadEventsScreen(db, {})).clients.map((c) => c.name);

    await archiveClient(db, admin, { clientId: overstock.id });

    expect(await filterOptions()).not.toContain("Overstock");
    expect(await clientNamed("Overstock")).toMatchObject({ archived: true, events: 1 });
    expect((await loadEventsScreen(db, { tab: "upcoming" })).events.map((e) => e.name)).toContain("Old launch");

    await unarchiveClient(db, admin, { clientId: overstock.id });
    expect(await filterOptions()).toContain("Overstock");
  });

  it("brings an Archived Client back into use when an Event is planned for it again", async () => {
    await plan("First", "Ancestry");
    const ancestry = await clientNamed("Ancestry");
    await archiveClient(db, admin, { clientId: ancestry.id });

    await plan("Second", "ancestry");

    expect(await clientNamed("Ancestry")).toMatchObject({ id: ancestry.id, archived: false, events: 2 });
  });

  it("keeps a Client Archived when one of its Events is edited", async () => {
    const old = await plan("Old do", "Novell");
    const novell = await clientNamed("Novell");
    await archiveClient(db, admin, { clientId: novell.id });

    await editEvent(db, someone, { id: old.id, name: "Old do, renamed", client: { name: "Novell" } });

    expect(await clientNamed("Novell")).toMatchObject({ archived: true });
  });

  it("refuses archiving twice, or unarchiving one in use", async () => {
    await plan("Retreat", "Podium");
    const podium = await clientNamed("Podium");

    await expect(unarchiveClient(db, admin, { clientId: podium.id })).rejects.toMatchObject({
      message: "Podium isn't Archived.",
    });
    await archiveClient(db, admin, { clientId: podium.id });
    await expect(archiveClient(db, admin, { clientId: podium.id })).rejects.toMatchObject({
      message: "Podium is already Archived.",
    });
  });

  it("is an Admin's to do", async () => {
    await plan("Expo", "Lucid");
    const lucid = await clientNamed("Lucid");

    await expect(archiveClient(db, someone, { clientId: lucid.id })).rejects.toMatchObject({ code: "not-allowed" });
  });
});
