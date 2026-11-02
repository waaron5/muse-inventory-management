import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/types";
import { addUser, testDb } from "@/test/db";
import { setOwnName } from "./set-own-name";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});

describe("setOwnName", () => {
  it("sets the name a person goes by", async () => {
    const actor = await addUser(db, { name: "" });

    await expect(setOwnName(db, actor, { name: "  Sam Rivera " })).resolves.toEqual({
      name: "Sam Rivera",
    });
  });

  it("refuses an empty name", async () => {
    const actor = await addUser(db);

    await expect(setOwnName(db, actor, { name: "  " })).rejects.toMatchObject({
      code: "invalid",
      message: "Enter your name.",
    });
  });
});
