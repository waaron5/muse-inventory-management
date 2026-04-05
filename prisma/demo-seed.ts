import { PrismaClient, type AuditEntityType, type AuditActionType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const DEMO_IMAGE_URL = "/demo/images/demo-image.jpg";

// ---------- data ----------

const inventoryItems = [
  { title: "Signs", description: "Instructure, Curved Wall", quantity: 6, notes: 'Labelled "Jason"', currentLocation: "JP Display" },
  { title: "Cooler", description: "Red, Igloo", quantity: 1, notes: null, currentLocation: "JP Display" },
  { title: "Bottles/Vases", description: "Brown Glass", quantity: 7, notes: null, currentLocation: "JP Display" },
  { title: "Key", description: 'Large, Metal, 24"', quantity: 1, notes: "Inside Cooler", currentLocation: "JP Display" },
  { title: "Stanchions", description: "Red & Gold", quantity: 20, notes: null, currentLocation: "JP Display" },
  { title: "Base", description: "Gold", quantity: 4, notes: "Need to be filled", currentLocation: "JP Display" },
  { title: "Uprights", description: "Gold", quantity: 8, notes: null, currentLocation: "JP Display" },
  { title: "Ropes", description: "Red Velvet, 5'", quantity: 18, notes: null, currentLocation: "JP Display" },
  { title: "Ticket Booth", description: null, quantity: 1, notes: null, currentLocation: "JP Display" },
  { title: "Light Bulbs", description: "Small for Top of Booth", quantity: 12, notes: null, currentLocation: "JP Display" },
  { title: "Ring Toss Game", description: null, quantity: 1, notes: null, currentLocation: "JP Display" },
  { title: "Bottles", description: "Clear Glass", quantity: 36, notes: null, currentLocation: "JP Display" },
  { title: "Rings", description: "Red Plastic", quantity: 24, notes: null, currentLocation: "JP Display" },
  { title: "Buckets", description: null, quantity: 2, notes: null, currentLocation: "JP Display" },
  { title: "Table Skirt", description: "Red & White Strip", quantity: 2, notes: null, currentLocation: "JP Display" },
  { title: "Horse Shoe Game", description: null, quantity: 2, notes: null, currentLocation: "JP Display" },
  { title: "Glass Bowl", description: '12"', quantity: 2, notes: null, currentLocation: "JP Display" },
  { title: "Stands", description: "Tall, Rectangular, Black Frame, Set of 5", quantity: 5, notes: "Various Sizes", currentLocation: "JP Display" },
  { title: "Stands", description: "Tall, Rectangular, Gold Frame, Set of 4", quantity: 4, notes: "Various Sizes", currentLocation: "JP Display" },
  { title: "Award Platforms", description: '20" H, 36" Square', quantity: 2, notes: null, currentLocation: "JP Display" },
  { title: "Award Platforms", description: '12" H, 36" Square', quantity: 2, notes: null, currentLocation: "JP Display" },
  { title: "Award Platforms", description: '6" H, 36" Square', quantity: 2, notes: null, currentLocation: "JP Display" },
];

const giftItems = [
  { title: "Wine Bottle", description: "Bordeaux Red", quantity: 12 },
  { title: "Gift Card", description: "$50 Restaurant", quantity: 20 },
  { title: "Candle Set", description: "Scented, Set of 3", quantity: 8 },
  { title: "Tote Bag", description: "Canvas, branded", quantity: 50 },
  { title: "Chocolate Box", description: "Assorted truffles, 12pc", quantity: 30 },
];

const today = new Date();
function daysFromNow(d: number) {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + d);
}

const events = [
  {
    companyName: "Acme Corp",
    eventName: "Annual Awards Gala",
    startDate: daysFromNow(-30),
    endDate: daysFromNow(-28),
    location: "Grand Ballroom, NYC",
    notes: "Past event — full setup required",
  },
  {
    companyName: "Horizon Tech",
    eventName: "Product Launch Summit",
    startDate: daysFromNow(-1),
    endDate: daysFromNow(2),
    location: "Moscone Center, SF",
    notes: "Ongoing — booth A12",
  },
  {
    companyName: "Stellar Brands",
    eventName: "Holiday Party",
    startDate: daysFromNow(30),
    endDate: daysFromNow(30),
    location: "Rooftop Venue, Chicago",
    notes: "Evening event, capacity 200",
  },
  {
    companyName: "Pinnacle Media",
    eventName: "Spring Showcase",
    startDate: daysFromNow(14),
    endDate: daysFromNow(16),
    location: "Convention Center, Austin",
    notes: "Outdoor setup if weather permits",
  },
  {
    companyName: "NovaChem Labs",
    eventName: "Board Retreat",
    startDate: daysFromNow(45),
    endDate: daysFromNow(47),
    location: "Mountain Lodge, Aspen",
    notes: null,
  },
];

// ---------- helpers ----------

async function truncateAll() {
  // Delete in FK-safe order
  await prisma.auditLog.deleteMany();
  await prisma.inventoryReservation.deleteMany();
  await prisma.giftReservation.deleteMany();
  await prisma.event.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.giftItem.deleteMany();
  await prisma.user.deleteMany();
}

function auditEntry(
  entityType: AuditEntityType,
  entityId: string,
  actionType: AuditActionType,
  summary: string,
  performedById: string,
  daysAgo: number = 0,
) {
  return {
    entityType,
    entityId,
    actionType,
    summary,
    performedById,
    timestamp: daysFromNow(-daysAgo),
  };
}

// ---------- main ----------

async function main() {
  console.log("Resetting demo database…");
  await truncateAll();
  console.log("  Tables cleared.");

  // --- Users ---
  const adminHash = await bcrypt.hash("admin123", 12);
  const userHash = await bcrypt.hash("user123", 12);

  const admin = await prisma.user.create({
    data: {
      name: "Muse Admin",
      email: "admin@muse.local",
      passwordHash: adminHash,
      role: "ADMIN",
    },
  });

  const user = await prisma.user.create({
    data: {
      name: "Muse User",
      email: "user@muse.local",
      passwordHash: userHash,
      role: "USER",
    },
  });
  console.log(`  Users: ${admin.email}, ${user.email}`);

  // --- Inventory ---
  const createdInventory = [];
  for (const item of inventoryItems) {
    const created = await prisma.inventoryItem.create({
      data: {
        title: item.title,
        description: item.description ?? undefined,
        imageUrl: DEMO_IMAGE_URL,
        quantity: item.quantity ?? 1,
        currentLocation: item.currentLocation,
        notes: item.notes ?? undefined,
        status: "ACTIVE",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
    createdInventory.push(created);
  }
  console.log(`  Inventory items: ${createdInventory.length}`);

  // --- Gifts ---
  const createdGifts = [];
  for (const g of giftItems) {
    const created = await prisma.giftItem.create({
      data: {
        title: g.title,
        description: g.description,
        imageUrl: DEMO_IMAGE_URL,
        quantity: g.quantity,
        status: "ACTIVE",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
    createdGifts.push(created);
  }
  console.log(`  Gift items: ${createdGifts.length}`);

  // --- Events ---
  const createdEvents = [];
  for (const ev of events) {
    const created = await prisma.event.create({
      data: {
        ...ev,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
    createdEvents.push(created);
  }
  console.log(`  Events: ${createdEvents.length}`);

  // --- Reservations (to make the demo feel lived-in) ---
  const pastEvent = createdEvents[0]; // Acme Corp — past
  const ongoingEvent = createdEvents[1]; // Horizon Tech — ongoing
  const futureEvent = createdEvents[2]; // Stellar Brands — future

  // Past event: completed inventory reservation
  const invRes1 = await prisma.inventoryReservation.create({
    data: {
      inventoryItemId: createdInventory[0].id, // Signs
      eventId: pastEvent.id,
      requestedById: user.id,
      approvedById: admin.id,
      lastModifiedById: admin.id,
      quantity: 2,
      status: "COMPLETED",
      returnLocation: "JP Display",
      notes: "Used at entrance",
    },
  });

  // Ongoing event: approved inventory reservation
  const invRes2 = await prisma.inventoryReservation.create({
    data: {
      inventoryItemId: createdInventory[4].id, // Stanchions
      eventId: ongoingEvent.id,
      requestedById: user.id,
      approvedById: admin.id,
      lastModifiedById: admin.id,
      quantity: 10,
      status: "APPROVED",
      notes: "For booth perimeter",
    },
  });

  // Ongoing event: approved ropes
  await prisma.inventoryReservation.create({
    data: {
      inventoryItemId: createdInventory[7].id, // Ropes
      eventId: ongoingEvent.id,
      requestedById: user.id,
      approvedById: admin.id,
      lastModifiedById: admin.id,
      quantity: 8,
      status: "APPROVED",
    },
  });

  // Future event: pending inventory reservation
  const invRes3 = await prisma.inventoryReservation.create({
    data: {
      inventoryItemId: createdInventory[8].id, // Ticket Booth
      eventId: futureEvent.id,
      requestedById: user.id,
      quantity: 1,
      status: "PENDING",
      notes: "Need for entrance setup",
    },
  });

  // Future event: another pending reservation
  await prisma.inventoryReservation.create({
    data: {
      inventoryItemId: createdInventory[17].id, // Stands (black)
      eventId: futureEvent.id,
      requestedById: user.id,
      quantity: 3,
      status: "PENDING",
      notes: "For product showcases",
    },
  });

  // Gift reservations
  await prisma.giftReservation.create({
    data: {
      giftItemId: createdGifts[0].id, // Wine
      eventId: pastEvent.id,
      requestedById: user.id,
      approvedById: admin.id,
      lastModifiedById: admin.id,
      quantity: 4,
      status: "COMPLETED",
    },
  });

  await prisma.giftReservation.create({
    data: {
      giftItemId: createdGifts[1].id, // Gift Cards
      eventId: ongoingEvent.id,
      requestedById: user.id,
      approvedById: admin.id,
      lastModifiedById: admin.id,
      quantity: 10,
      status: "APPROVED",
    },
  });

  await prisma.giftReservation.create({
    data: {
      giftItemId: createdGifts[4].id, // Chocolate Box
      eventId: futureEvent.id,
      requestedById: user.id,
      quantity: 5,
      status: "PENDING",
    },
  });

  console.log("  Reservations: 8");

  // --- Audit logs ---
  const auditLogs = [
    auditEntry("INVENTORY_ITEM", createdInventory[0].id, "CREATED", "Created inventory item: Signs", admin.id, 35),
    auditEntry("EVENT", pastEvent.id, "CREATED", "Created event: Acme Corp — Annual Awards Gala", admin.id, 35),
    auditEntry("INVENTORY_RESERVATION", invRes1.id, "CREATED", "Requested 2× Signs for Annual Awards Gala", user.id, 32),
    auditEntry("INVENTORY_RESERVATION", invRes1.id, "APPROVED", "Approved 2× Signs for Annual Awards Gala", admin.id, 31),
    auditEntry("INVENTORY_RESERVATION", invRes1.id, "RETURNED", "Returned 2× Signs (JP Display)", admin.id, 27),
    auditEntry("EVENT", ongoingEvent.id, "CREATED", "Created event: Horizon Tech — Product Launch Summit", admin.id, 10),
    auditEntry("INVENTORY_RESERVATION", invRes2.id, "CREATED", "Requested 10× Stanchions for Product Launch Summit", user.id, 8),
    auditEntry("INVENTORY_RESERVATION", invRes2.id, "APPROVED", "Approved 10× Stanchions for Product Launch Summit", admin.id, 7),
    auditEntry("EVENT", futureEvent.id, "CREATED", "Created event: Stellar Brands — Holiday Party", admin.id, 5),
    auditEntry("INVENTORY_RESERVATION", invRes3.id, "CREATED", "Requested 1× Ticket Booth for Holiday Party", user.id, 3),
  ];

  for (const log of auditLogs) {
    await prisma.auditLog.create({ data: log });
  }
  console.log(`  Audit logs: ${auditLogs.length}`);

  console.log("Demo seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
