import { describe, expect, it } from "vitest";
import { addUser, countRoundTrips, testDb } from "@/test/db";
import { clientColour } from "@/lib/client-colour";
import { archiveClient } from "../commands/clients";
import { createEvent } from "../commands/create-event";
import { loadClientsScreen } from "./clients";

describe("loadClientsScreen", () => {
  it("lists every Client by name with how many Events it has, Archived ones last", async () => {
    const db = await testDb();
    const admin = await addUser(db, { role: "admin" });
    const plan = (name: string, client: string) => createEvent(db, admin, { name, client: { name: client } });
    await plan("Roadshow", "Ivorypeak");
    await plan("Summit", "Ivorypeak");
    await plan("Launch", "Overstock");
    await plan("Gala", "adobe");

    const { clients: before } = await loadClientsScreen(db);
    const overstock = before.find((c) => c.name === "Overstock")!;
    await archiveClient(db, admin, { clientId: overstock.id });
    const { clients } = await loadClientsScreen(db);

    expect(clients).toEqual([
      { id: expect.any(String), name: "adobe", colour: clientColour("adobe"), archived: false, events: 1 },
      { id: expect.any(String), name: "Ivorypeak", colour: "rose", archived: false, events: 2 },
      { id: overstock.id, name: "Overstock", colour: clientColour("Overstock"), archived: true, events: 1 },
    ]);
  });

  it("stays within 2 sequential round trips", async () => {
    const db = await testDb();

    expect(await countRoundTrips(db, () => loadClientsScreen(db))).toBeLessThanOrEqual(2);
  });
});
