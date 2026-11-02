import { testCategoryId } from "@/test/db";
import { and, eq, ne } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { location, stock } from "@/db/schema";
import type { Db } from "@/db/types";
import { createInventoryItem } from "@/server/commands/create-inventory-item";
import { createLocation } from "@/server/commands/create-location";
import { addUser, testDb } from "./db";
import { stockOffLedger } from "./ledger";

// ADR 0004: every Stock balance equals the sum of its History entries.
describe("the Stock ledger", () => {
  let db: Db;
  let item: { id: string };
  let garage: { id: string };
  beforeAll(async () => {
    db = await testDb();
    const admin = await addUser(db, { role: "admin" });
    garage = await createLocation(db, admin, { name: "Garage" });
    item = await createInventoryItem(db, admin, {
      categoryId: testCategoryId,
      name: "Folding chair",
      startingStock: { locationId: garage.id, count: 24 },
    });
    await createInventoryItem(db, admin, { categoryId: testCategoryId, name: "Chalkboard" });
  });

  it("balances after Starting Stock", async () => {
    expect(await stockOffLedger(db)).toEqual([]);
  });

  it("catches a balance changed without History", async () => {
    await db
      .update(stock)
      .set({ count: 7 })
      .where(and(eq(stock.itemId, item.id), eq(stock.locationId, garage.id)));

    expect(await stockOffLedger(db)).toEqual([
      { itemId: item.id, locationId: garage.id, balance: 7, ledger: 24 },
    ]);
  });

  it("never lets one item hold Stock at a second Location (ADR 0014)", async () => {
    const [elsewhere] = await db.select().from(location).where(ne(location.id, garage.id)).limit(1);
    await expect(db.insert(stock).values({ itemId: item.id, locationId: elsewhere.id, count: 1 })).rejects.toThrow();
  });
});
