import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { location } from "@/db/schema";
import type { Db } from "@/db/types";
import { addUser, testDb } from "@/test/db";
import { createLocation } from "./create-location";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

describe("createLocation", () => {
  it("lets a User create a Location", async () => {
    const actor = await addUser(db, { role: "user" });

    const created = await createLocation(db, actor, { name: "  Garage  " });

    expect(created.name).toBe("Garage");
    const [stored] = await db.select().from(location).where(eq(location.id, created.id));
    expect(stored.name).toBe("Garage");
  });

  it("refuses an empty name", async () => {
    const actor = await addUser(db);

    await expect(createLocation(db, actor, { name: "   " })).rejects.toMatchObject({
      code: "invalid",
      message: "Give the Location a name.",
    });
  });

  it("refuses someone deactivated, whatever their cookie says", async () => {
    const actor = await addUser(db, { role: "admin", banned: true });

    await expect(createLocation(db, actor, { name: "Unit 4" })).rejects.toMatchObject({
      code: "not-signed-in",
    });
  });

  it("refuses an unknown person and writes nothing", async () => {
    const before = await db.$count(location);

    await expect(
      createLocation(db, { userId: "nobody", sessionId: "nowhere" }, { name: "Unit 5" }),
    ).rejects.toMatchObject({ code: "not-signed-in" });
    expect(await db.$count(location)).toBe(before);
  });
});

