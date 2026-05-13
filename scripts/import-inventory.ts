import fs from "node:fs";
import path from "node:path";
import "dotenv/config";
import { createPrismaClient } from "@/lib/db";

type InventoryRow = {
  item: string;
  description: string;
  quantity: string;
  notes: string;
  location: string;
  source_row: string;
  item_carried_forward: string;
};

const CSV_PATH = path.join(process.cwd(), "data", "muse-inventory.normalized.csv");

function isPresent(value: string | null): value is string {
  return value !== null;
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((value) => value.length > 0)) rows.push(row);

  return rows;
}

function toNullableString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toQuantity(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;

  const quantity = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error(`Invalid quantity "${value}"`);
  }

  return quantity;
}

function readInventoryRows(): InventoryRow[] {
  const content = fs.readFileSync(CSV_PATH, "utf8");
  const [headers, ...records] = parseCsv(content);
  const expectedHeaders = [
    "item",
    "description",
    "quantity",
    "notes",
    "location",
    "source_row",
    "item_carried_forward",
  ];

  if (headers.join(",") !== expectedHeaders.join(",")) {
    throw new Error(`Unexpected CSV headers: ${headers.join(",")}`);
  }

  return records.map((record, index) => {
    if (record.length !== expectedHeaders.length) {
      throw new Error(`Row ${index + 2} has ${record.length} columns, expected 7`);
    }

    return Object.fromEntries(
      expectedHeaders.map((header, headerIndex) => [header, record[headerIndex]]),
    ) as InventoryRow;
  });
}

function assertSafeDatabaseTarget() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  if (process.env.APP_MODE === "production" || process.env.NODE_ENV === "production") {
    const url = new URL(databaseUrl);
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
      throw new Error("Refusing to import production inventory into a localhost database.");
    }
  }
}

async function main() {
  assertSafeDatabaseTarget();

  const prisma = createPrismaClient();
  const rows = readInventoryRows();
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  try {
    await prisma.$transaction(async (tx) => {
      const locations = [
        ...new Set(rows.map((row) => toNullableString(row.location)).filter(isPresent)),
      ];

      await tx.storageLocation.createMany({
        data: locations.map((name) => ({ name })),
        skipDuplicates: true,
      });

      for (const row of rows) {
        const title = row.item.trim();
        if (!title) {
          skippedCount += 1;
          continue;
        }

        const description = toNullableString(row.description);
        const notes = toNullableString(row.notes);
        const currentLocation = toNullableString(row.location);
        const quantity = toQuantity(row.quantity);

        const existing = await tx.inventoryItem.findFirst({
          where: {
            title,
            description,
            notes,
            currentLocation,
          },
          orderBy: { createdAt: "asc" },
        });

        if (existing) {
          await tx.inventoryItem.update({
            where: { id: existing.id },
            data: {
              quantity,
              status: "ACTIVE",
            },
          });
          updatedCount += 1;
          continue;
        }

        await tx.inventoryItem.create({
          data: {
            title,
            description,
            quantity,
            notes,
            currentLocation,
            status: "ACTIVE",
          },
        });
        createdCount += 1;
      }
    });
  } finally {
    await prisma.$disconnect();
  }

  console.log(
    `Imported inventory from ${path.relative(process.cwd(), CSV_PATH)}: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
