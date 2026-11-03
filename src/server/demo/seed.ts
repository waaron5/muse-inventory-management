import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { session, user } from "@/db/schema";
import type { Db } from "@/db/types";
import { MUSE_TIME_ZONE, todayInMuse } from "@/lib/time-zone";
import { addBorrowedItem } from "../commands/add-line";
import { adjustStock } from "../commands/adjust-stock";
import { cancelEvent } from "../commands/cancel-event";
import { createCategory } from "../commands/categories";
import { createEvent } from "../commands/create-event";
import { createGift } from "../commands/create-gift";
import { createInventoryItem } from "../commands/create-inventory-item";
import { createLocation } from "../commands/create-location";
import type { Actor } from "../commands/define";
import { giveAwayEnded } from "../commands/give-away";
import { reserve } from "../commands/reserve";

// The public demo's fictional data (ADR 0016), made through the same commands
// people use, so it has real History and Activity and can never be a state the
// app couldn't reach. Event dates count from today, so there is always
// something past, on now and coming up. Every name here is made up.

/** Who a visitor signs in as. Not a real address. */
export const DEMO_ADMIN = { email: "demo@example.com", name: "Demo Admin" } as const;

/** Puts the demo's Admin back as an active Admin with a name, whatever a visitor did to them. */
export async function ensureDemoAdmin(db: Db) {
  const [found] = await db
    .insert(user)
    .values({ id: randomUUID(), ...DEMO_ADMIN, role: "admin" })
    .onConflictDoUpdate({
      target: user.email,
      set: { role: "admin", banned: false, banReason: null, banExpires: null, name: sql`coalesce(nullif(${user.name}, ''), ${DEMO_ADMIN.name})` },
    })
    .returning({ id: user.id });
  return found.id;
}

/** Empties every table the app keeps, migrations aside, and seeds the demo again. */
export async function resetDemo(db: Db) {
  await db.execute(sql`
    do $$
    declare tables text;
    begin
      select string_agg(format('%I.%I', schemaname, tablename), ', ') into tables
      from pg_tables where schemaname = 'public';
      execute 'truncate ' || tables || ' restart identity cascade';
    end $$;
  `);
  await seedDemo(db);
}

const people = {
  maya: { name: "Maya Chen", email: "maya.chen@example.com", role: "admin" },
  sam: { name: "Sam Ortiz", email: "sam.ortiz@example.com", role: "user" },
  priya: { name: "Priya Patel", email: "priya.patel@example.com", role: "user" },
} as const;
type Person = keyof typeof people | "demo";

const locations = ["Main Warehouse", "Overflow Storage", "Office", "Trailer"] as const;
type LocationName = (typeof locations)[number];

const categories = [
  "Furniture",
  "Vases & Vessels",
  "Lighting & Candle Holders",
  "Umbrellas & Shade",
  "Decor & Tabletop",
  "Linens",
  "Signage",
] as const;
type CategoryName = (typeof categories)[number];

// [name, Category, Location, Count, Unit Price, SKU, Description]
type InventoryRow = [string, CategoryName, LocationName, number, string?, string?, string?];
const inventory: InventoryRow[] = [
  ["Cocktail Table, Black", "Furniture", "Main Warehouse", 24, "85", "FUR-CT-BLK", "30\" round top, folds flat"],
  ["Highboy Table, White", "Furniture", "Main Warehouse", 18, "95", "FUR-HB-WHT", "42\" tall, 30\" top"],
  ["Lounge Sofa, Cream", "Furniture", "Overflow Storage", 6, "650", "FUR-SOFA-CRM", "Three-seater, boucle"],
  ["Lounge Chair, Cream", "Furniture", "Overflow Storage", 12, "320", "FUR-LC-CRM", "Matches the cream sofa"],
  ["Ghost Chair, Clear", "Furniture", "Main Warehouse", 60, "45", "FUR-GHOST", "Acrylic, stackable"],
  ["Bar Stool, Walnut", "Furniture", "Main Warehouse", 30, "70", "FUR-BS-WAL"],
  ["Ottoman, Navy", "Furniture", "Overflow Storage", 10, "120", "FUR-OTT-NVY"],
  ["Coffee Table, Oak", "Furniture", "Overflow Storage", 6, "240", "FUR-COF-OAK"],
  ["Bar Front, White", "Furniture", "Trailer", 3, "900", "FUR-BAR-WHT", "8' modular, lit underneath"],
  ["Folding Chair, White", "Furniture", "Main Warehouse", 120, "12", "FUR-FOLD-WHT"],
  ["Cylinder Vase, 12\"", "Vases & Vessels", "Main Warehouse", 48, "9", "VAS-CYL-12"],
  ["Bud Vase, Clear", "Vases & Vessels", "Office", 120, "3"],
  ["Mercury Glass Vase, Gold", "Vases & Vessels", "Main Warehouse", 36, "14", "VAS-MERC-GLD"],
  ["Ceramic Pitcher, White", "Vases & Vessels", "Office", 20, "18"],
  ["Glass Hurricane, 24\"", "Vases & Vessels", "Main Warehouse", 30, "22", "VAS-HUR-24"],
  ["LED Pillar Candle, 3x6", "Lighting & Candle Holders", "Main Warehouse", 200, "6", "LGT-PIL-36", "Warm white, remote included"],
  ["Brass Candlestick", "Lighting & Candle Holders", "Main Warehouse", 80, "8", "LGT-CS-BRS"],
  ["Votive Holder, Gold", "Lighting & Candle Holders", "Office", 300, "1.50", "LGT-VOT-GLD"],
  ["Lantern, Black", "Lighting & Candle Holders", "Main Warehouse", 24, "28", "LGT-LAN-BLK"],
  ["String Lights, 50 ft", "Lighting & Candle Holders", "Trailer", 16, "40", "LGT-STR-50"],
  ["Uplight, RGB", "Lighting & Candle Holders", "Trailer", 20, "110", "LGT-UP-RGB", "Battery, about 12 hours"],
  ["Market Umbrella, 9 ft", "Umbrellas & Shade", "Trailer", 10, "180", "SHD-MKT-9"],
  ["Umbrella Base", "Umbrellas & Shade", "Trailer", 10, "60", "SHD-BASE"],
  ["Pop-up Tent, 10x10", "Umbrellas & Shade", "Trailer", 6, "350", "SHD-TENT-10"],
  ["Paper Parasol, White", "Umbrellas & Shade", "Office", 40, "7"],
  ["Charger Plate, Gold", "Decor & Tabletop", "Main Warehouse", 200, "4", "TAB-CHG-GLD"],
  ["Table Number Stand", "Decor & Tabletop", "Office", 40, "5", "TAB-NUM"],
  ["Easel, Black", "Decor & Tabletop", "Overflow Storage", 12, "35", "TAB-EASEL"],
  ["Flatware Set, Gold", "Decor & Tabletop", "Main Warehouse", 150, "6", "TAB-FLAT-GLD", "Fork, knife and spoon"],
  ["Serving Tray, Wood", "Decor & Tabletop", "Office", 24, "16"],
  ["Greenery Garland, 6 ft", "Decor & Tabletop", "Overflow Storage", 40, "19", "TAB-GAR-6", "Faux eucalyptus"],
  ["Pampas Bundle", "Decor & Tabletop", "Overflow Storage", 30, "11"],
  ["Spandex Highboy Cover, Black", "Linens", "Main Warehouse", 18, "15", "LIN-HB-BLK"],
  ["Tablecloth, White 120\"", "Linens", "Main Warehouse", 60, "14", "LIN-TC-120"],
  ["Napkin, Sage", "Linens", "Office", 200, "1.25", "LIN-NAP-SAG"],
  ["Napkin, Navy", "Linens", "Office", 150, "1.25", "LIN-NAP-NVY"],
  ["Table Runner, Ivory", "Linens", "Main Warehouse", 40, "8", "LIN-RUN-IVY"],
  ["Welcome Sign Frame", "Signage", "Overflow Storage", 4, "75", "SGN-WEL"],
  ["Acrylic Sign, 11x14", "Signage", "Office", 20, "12", "SGN-ACR-1114"],
  ["Neon Sign, \"Cheers\"", "Signage", "Overflow Storage", 2, "260", "SGN-NEON-CHR"],
  ["Step-and-Repeat Frame", "Signage", "Trailer", 2, "300", "SGN-SNR", "8x8, banner sold separately"],
  ["A-Frame Sign", "Signage", "Trailer", 6, "45", "SGN-AFR"],
];

// [name, Location, Count, Unit Price, SKU]
type GiftRow = [string, LocationName, number, string?, string?];
const gifts: GiftRow[] = [
  ["Insulated Water Bottle", "Main Warehouse", 150, "18", "GFT-BOTTLE"],
  ["Canvas Tote Bag", "Main Warehouse", 200, "9", "GFT-TOTE"],
  ["Beach Towel", "Overflow Storage", 80, "22", "GFT-TOWEL"],
  ["Polarized Sunglasses", "Office", 100, "12", "GFT-SUN"],
  ["Soy Candle Gift Box", "Office", 60, "24", "GFT-CANDLE"],
  ["Notebook and Pen Set", "Office", 120, "11", "GFT-NOTE"],
  ["Snack Box", "Main Warehouse", 90, "15"],
  ["Hoodie", "Overflow Storage", 75, "38", "GFT-HOOD"],
  ["Bluetooth Speaker", "Office", 25, "45", "GFT-SPKR"],
  ["Throw Blanket", "Overflow Storage", 40, "35", "GFT-BLNK"],
  ["Ceramic Mug", "Main Warehouse", 140, "10", "GFT-MUG"],
  ["Leather Luggage Tag", "Office", 200, "6", "GFT-TAG"],
  ["Sun Hat", "Overflow Storage", 60, "16"],
  ["Welcome Bag", "Main Warehouse", 100, "30", "GFT-WELCOME", ],
  ["Lip Balm", "Office", 300, "2"],
];

type EventSpec = {
  name: string;
  client: string;
  plCode?: string;
  venue?: string;
  // Days from today, and how many days it runs; none for an Event without dates.
  starts?: number;
  days?: number;
  notes?: string;
  by: Person;
  // When it was added, in days before today.
  addedDaysAgo: number;
  reserve: [string, number][];
  borrowed?: [string, string, number][];
  cancelled?: boolean;
};

const events: EventSpec[] = [
  {
    name: "Ivorypeak Sales Kickoff", client: "Ivorypeak", plCode: "IVP-SKO 26", venue: "Lakeside Conference Center",
    starts: -40, days: 3, by: "sam", addedDaysAgo: 60,
    reserve: [["Highboy Table, White", 12], ["Spandex Highboy Cover, Black", 12], ["Uplight, RGB", 16], ["Insulated Water Bottle", 40], ["Canvas Tote Bag", 40]],
  },
  {
    name: "Birchline Leadership Retreat", client: "Birchline", plCode: "BRL Retreat 26", venue: "Pine Ridge Lodge",
    starts: -25, days: 4, by: "priya", addedDaysAgo: 55,
    reserve: [["Lounge Sofa, Cream", 2], ["Lounge Chair, Cream", 6], ["Lantern, Black", 12], ["Throw Blanket", 20], ["Soy Candle Gift Box", 20]],
  },
  {
    name: "Riverside Community Gala", client: "Riverside Community Church", plCode: "RCC-Gala 26", venue: "Riverside Fellowship Hall",
    starts: -18, days: 1, by: "sam", addedDaysAgo: 45,
    reserve: [["Folding Chair, White", 100], ["Tablecloth, White 120\"", 14], ["Charger Plate, Gold", 100], ["LED Pillar Candle, 3x6", 42]],
  },
  {
    name: "Northwind Partner Summit", client: "Northwind Labs", plCode: "NWL-Summit 26", venue: "Lakeside Conference Center",
    starts: -10, days: 2, by: "priya", addedDaysAgo: 40,
    reserve: [["Cocktail Table, Black", 16], ["Step-and-Repeat Frame", 1], ["Notebook and Pen Set", 80]],
  },
  {
    name: "Harborview Open House", client: "Harborview Partners", plCode: "HVP-Open 26",
    starts: 25, days: 1, by: "sam", addedDaysAgo: 30, cancelled: true,
    reserve: [["Cocktail Table, Black", 6]],
  },
  {
    name: "Copperleaf Wellness Day", client: "Copperleaf Health", plCode: "CPL-Wellness 26", venue: "Copperleaf Campus Lawn",
    starts: -4, days: 1, by: "priya", addedDaysAgo: 25,
    reserve: [["Market Umbrella, 9 ft", 6], ["Umbrella Base", 6], ["Pop-up Tent, 10x10", 4], ["Sun Hat", 30], ["Lip Balm", 120]],
  },
  {
    name: "Ivorypeak Roadshow", client: "Ivorypeak", plCode: "IVP-Roadshow 26", venue: "Five cities, see notes",
    starts: -1, days: 5, by: "sam", addedDaysAgo: 28,
    notes: "Gear travels in the trailer between stops. Load-out each morning at 7.",
    reserve: [["Highboy Table, White", 8], ["A-Frame Sign", 4], ["Acrylic Sign, 11x14", 10], ["Ceramic Mug", 100]],
    borrowed: [["Projector Screen", "Lakeside AV", 1]],
  },
  {
    name: "Birchline Cove 26", client: "Birchline", plCode: "BRL Cove 26", venue: "Cove Resort",
    starts: 6, days: 5, by: "priya", addedDaysAgo: 35,
    notes: "Incentive trip for 120. Welcome bags go to rooms on arrival.",
    reserve: [["Highboy Table, White", 12], ["Lantern, Black", 20], ["Bar Stool, Walnut", 24], ["Paper Parasol, White", 30], ["Beach Towel", 60], ["Polarized Sunglasses", 60], ["Welcome Bag", 60]],
    borrowed: [["Tiki Torch", "Cove Resort", 12]],
  },
  {
    name: "Summit Ridge Member Appreciation", client: "Summit Ridge Credit Union", plCode: "SRCU-Members 26", venue: "Summit Ridge Main Branch",
    starts: 9, days: 1, by: "sam", addedDaysAgo: 20,
    reserve: [["Highboy Table, White", 10], ["Lantern, Black", 10], ["Canvas Tote Bag", 80]],
  },
  {
    name: "Summit Ridge Golf Tournament", client: "Summit Ridge Credit Union", plCode: "SRCU-Golf 26", venue: "Pine Ridge Golf Club",
    starts: 12, days: 1, by: "sam", addedDaysAgo: 19, cancelled: true,
    reserve: [["Pop-up Tent, 10x10", 2], ["Insulated Water Bottle", 60]],
  },
  {
    name: "Larkspur User Conference", client: "Larkspur Software", plCode: "LRK-UC 26", venue: "Harbor Hotel",
    starts: 14, days: 3, by: "priya", addedDaysAgo: 18,
    reserve: [["Cocktail Table, Black", 20], ["Ghost Chair, Clear", 40], ["Neon Sign, \"Cheers\"", 1], ["Welcome Bag", 60], ["Hoodie", 50]],
  },
  {
    name: "Harborview Client Dinner", client: "Harborview Partners", plCode: "HVP-Dinner 26", venue: "The Vista Room",
    starts: 16, days: 1, by: "demo", addedDaysAgo: 6,
    reserve: [["Charger Plate, Gold", 40], ["Flatware Set, Gold", 40], ["Napkin, Navy", 40], ["Brass Candlestick", 24], ["Leather Luggage Tag", 40]],
  },
  {
    name: "Northwind Team Offsite", client: "Northwind Labs", plCode: "NWL-Offsite 26", venue: "Pine Ridge Lodge",
    starts: 21, days: 2, by: "priya", addedDaysAgo: 12,
    reserve: [["Lounge Sofa, Cream", 4], ["Lounge Chair, Cream", 8], ["Coffee Table, Oak", 4], ["Snack Box", 40]],
  },
  {
    name: "Copperleaf Board Retreat", client: "Copperleaf Health", plCode: "CPL-Board 26", venue: "Vista Resort",
    starts: 30, days: 3, by: "sam", addedDaysAgo: 9,
    reserve: [["Table Runner, Ivory", 6], ["Mercury Glass Vase, Gold", 18], ["Soy Candle Gift Box", 14]],
  },
  {
    name: "Ivorypeak Customer Awards", client: "Ivorypeak", plCode: "IVP-Awards 26", venue: "Lakeside Conference Center",
    starts: 38, days: 1, by: "demo", addedDaysAgo: 4,
    reserve: [["Welcome Sign Frame", 2], ["Easel, Black", 6], ["Cylinder Vase, 12\"", 30], ["Bluetooth Speaker", 20]],
  },
  {
    name: "Riverside Youth Conference", client: "Riverside Community Church", plCode: "RCC-Youth 26", venue: "Riverside Fellowship Hall",
    starts: 45, days: 3, by: "sam", addedDaysAgo: 3,
    reserve: [["Folding Chair, White", 120], ["Pop-up Tent, 10x10", 4], ["Snack Box", 50]],
  },
  {
    name: "Birchline Lakeside 27", client: "Birchline", plCode: "BRL Lakeside 27", venue: "Lakeside Resort",
    starts: 60, days: 4, by: "priya", addedDaysAgo: 2,
    reserve: [["Market Umbrella, 9 ft", 8], ["Umbrella Base", 8], ["Beach Towel", 40]],
  },
  {
    name: "Larkspur Product Launch", client: "Larkspur Software", by: "demo", addedDaysAgo: 1,
    notes: "Dates to be confirmed with Larkspur's marketing team.",
    reserve: [["Hoodie", 20]],
  },
];

/** Seeds an empty database with the demo's people, catalog, Events and their History. */
export async function seedDemo(db: Db) {
  step = 0;
  const actors = {} as Record<Person, Actor>;
  for (const [key, person] of Object.entries(people)) {
    const id = randomUUID();
    await db.insert(user).values({ id, ...person });
    actors[key as Person] = await signedIn(db, id);
  }
  actors.demo = await signedIn(db, await ensureDemoAdmin(db));
  // Someone who has left, to show a Deactivated row.
  await db.insert(user).values({ id: randomUUID(), name: "Jordan Lee", email: "jordan.lee@example.com", banned: true });

  const today = todayInMuse();
  const day = (offset: number) => addDays(today, offset);

  const locationIds = {} as Record<LocationName, string>;
  const categoryIds = {} as Record<CategoryName, string>;
  const itemIds: Record<string, string> = {};

  await backdated(db, 70, async () => {
    for (const name of locations) locationIds[name] = (await createLocation(db, actors.maya, { name })).id;
    for (const name of categories) categoryIds[name] = (await createCategory(db, actors.maya, { name })).id;
  });
  await backdated(db, 68, async () => {
    for (const [name, category, at, count, unitPrice, sku, description] of inventory) {
      const { id } = await createInventoryItem(db, actors.maya, {
        name, sku, unitPrice, description,
        categoryId: categoryIds[category],
        startingStock: { locationId: locationIds[at], count },
      });
      itemIds[name] = id;
    }
    for (const [name, at, count, unitPrice, sku] of gifts) {
      const { id } = await createGift(db, actors.maya, {
        name, sku, unitPrice,
        startingStock: { locationId: locationIds[at], count },
      });
      itemIds[name] = id;
    }
  });

  for (const spec of [...events].sort((a, b) => b.addedDaysAgo - a.addedDaysAgo)) {
    await backdated(db, spec.addedDaysAgo, async () => {
      const actor = actors[spec.by];
      const dated = spec.starts !== undefined;
      const { id } = await createEvent(db, actor, {
        name: spec.name,
        client: { name: spec.client },
        plCode: spec.plCode,
        venue: spec.venue,
        notes: spec.notes,
        startsOn: dated ? day(spec.starts!) : undefined,
        endsOn: dated ? day(spec.starts! + (spec.days ?? 1) - 1) : undefined,
      });
      for (const [item, count] of spec.reserve) await reserve(db, actor, { eventId: id, itemId: itemIds[item], count });
      for (const [name, lender, count] of spec.borrowed ?? []) await addBorrowedItem(db, actor, { eventId: id, name, lender, count });
      if (spec.cancelled) await cancelEvent(db, actor, { id });
    });
  }

  const stockChanges: [number, Person, Parameters<typeof adjustStock>[2]][] = [
    [20, "maya", { itemId: itemIds["Votive Holder, Gold"], reason: "purchased", count: 50, note: "Restocked before the gala" }],
    [12, "maya", { itemId: itemIds["Glass Hurricane, 24\""], reason: "damaged", count: 2, note: "Cracked in the trailer" }],
    [7, "priya", { itemId: itemIds["Brass Candlestick"], reason: "found", count: 4, note: "Back of the Pine Ridge bins" }],
    [3, "maya", { itemId: itemIds["Folding Chair, White"], reason: "recount", countedTo: 118 }],
    [2, "demo", { itemId: itemIds["Canvas Tote Bag"], reason: "given-away", count: 5, note: "Front office visitors" }],
  ];
  for (const [daysAgo, by, change] of stockChanges) {
    await backdated(db, daysAgo, () => adjustStock(db, actors[by], change));
  }

  // What Vercel Cron does each night: the Gifts of Events that have ended are given away.
  await giveAwayEnded(db);

  // The seed's own sign-ins end here; a visitor gets a fresh one.
  await db.delete(session);
}

// Signed in on one device, so a command will act for them.
async function signedIn(db: Db, userId: string): Promise<Actor> {
  const id = randomUUID();
  await db.insert(session).values({ id, userId, token: randomUUID(), expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
  return { userId, sessionId: id };
}

// Everything `work` writes is moved back `daysAgo` days, to a time in working
// hours in Muse's time zone, as if it had been recorded then, so Activity,
// History and "Added by" read as weeks of use. Each step gets its own time.
let step = 0;
async function backdated(db: Db, daysAgo: number, work: () => Promise<unknown>) {
  const { rows } = (await db.execute(sql`select clock_timestamp() as now`)) as unknown as { rows: { now: Date | string }[] };
  const since = new Date(rows[0].now);
  await work();
  step += 1;
  const [hour, minute] = [9 + ((step * 3) % 8), (step * 23) % 60];
  const shift = sql`(make_interval(days => ${daysAgo}::int)
    + ((${since}::timestamptz at time zone ${MUSE_TIME_ZONE})::time - make_time(${hour}::int, ${minute}::int, 0)))`;
  await db.execute(sql`update activity set recorded_at = recorded_at - ${shift} where recorded_at >= ${since}`);
  await db.execute(sql`
    update history_entry
    set recorded_at = recorded_at - ${shift},
        happened_on = ((recorded_at - ${shift}) at time zone ${MUSE_TIME_ZONE})::date
    where recorded_at >= ${since}`);
  for (const table of ["line", "event", "item", "client", "location", "category"]) {
    await db.execute(sql`update ${sql.identifier(table)} set created_at = created_at - ${shift} where created_at >= ${since}`);
  }
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
