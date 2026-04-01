import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const inventoryItems = [
  {
    title: "Signs",
    description: "Instructure, Curved Wall",
    quantity: 6,
    notes: 'Labelled "Jason"',
    currentLocation: "JP Display",
  },
  {
    title: "Cooler",
    description: "Red, Igloo",
    quantity: 1,
    notes: null,
    currentLocation: "JP Display",
  },
  {
    title: "Bottles/Vases",
    description: "Brown Glass",
    quantity: 7,
    notes: null,
    currentLocation: "JP Display",
  },
  {
    title: "Key",
    description: 'Large, Metal, 24"',
    quantity: 1,
    notes: "Inside Cooler",
    currentLocation: "JP Display",
  },
  {
    title: "Stanchions",
    description: "Red & Gold",
    quantity: 20,
    notes: null,
    currentLocation: "JP Display",
  },
  {
    title: "Base",
    description: "Gold",
    quantity: null,
    notes: "Need to be filled",
    currentLocation: "JP Display",
  },
  {
    title: "Uprights",
    description: "Gold",
    quantity: null,
    notes: null,
    currentLocation: "JP Display",
  },
  {
    title: "Ropes",
    description: "Red Velvet, 5'",
    quantity: 18,
    notes: null,
    currentLocation: "JP Display",
  },
  {
    title: "Ticket Booth",
    description: null,
    quantity: 1,
    notes: null,
    currentLocation: "JP Display",
  },
  {
    title: "Light Bulbs",
    description: "Small for Top of Booth",
    quantity: null,
    notes: null,
    currentLocation: "JP Display",
  },
  {
    title: "Ring Toss Game",
    description: null,
    quantity: null,
    notes: null,
    currentLocation: "JP Display",
  },
  {
    title: "Bottles",
    description: "Clear Glass",
    quantity: 36,
    notes: null,
    currentLocation: "JP Display",
  },
  {
    title: "Rings",
    description: "Red Plastic",
    quantity: null,
    notes: null,
    currentLocation: "JP Display",
  },
  {
    title: "Buckets",
    description: null,
    quantity: 2,
    notes: null,
    currentLocation: "JP Display",
  },
  {
    title: "Table Skirt",
    description: "Red & White Strip",
    quantity: null,
    notes: null,
    currentLocation: "JP Display",
  },
  {
    title: "Horse Shoe Game",
    description: null,
    quantity: 2,
    notes: null,
    currentLocation: "JP Display",
  },
  {
    title: "Glass Bowl",
    description: '12"',
    quantity: 2,
    notes: null,
    currentLocation: "JP Display",
  },
  {
    title: "Stands",
    description: "Tall, Rectangular, Black Frame, Set of 5",
    quantity: null,
    notes: "Various Sizes",
    currentLocation: "JP Display",
  },
  {
    title: "Stands",
    description: "Tall, Rectangular, Gold Frame, Set of 4",
    quantity: null,
    notes: "Various Sizes",
    currentLocation: "JP Display",
  },
  {
    title: "Award Platforms",
    description: '20" H, 36" Square',
    quantity: null,
    notes: null,
    currentLocation: "JP Display",
  },
  {
    title: "Award Platforms",
    description: '12" H, 36" Square',
    quantity: null,
    notes: null,
    currentLocation: "JP Display",
  },
  {
    title: "Award Platforms",
    description: '6" H, 36" Square',
    quantity: null,
    notes: null,
    currentLocation: "JP Display",
  },
];

async function main() {
  console.log("Seeding database…");

  // Users
  const adminHash = await bcrypt.hash("admin123", 12);
  const userHash = await bcrypt.hash("user123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@muse.local" },
    update: {},
    create: {
      name: "Muse Admin",
      email: "admin@muse.local",
      passwordHash: adminHash,
      role: "ADMIN",
    },
  });

  const userAccount = await prisma.user.upsert({
    where: { email: "user@muse.local" },
    update: {},
    create: {
      name: "Muse User",
      email: "user@muse.local",
      passwordHash: userHash,
      role: "USER",
    },
  });

  console.log(`  Users: ${admin.email}, ${userAccount.email}`);

  // Inventory Items
  for (const item of inventoryItems) {
    await prisma.inventoryItem.create({
      data: {
        title: item.title,
        description: item.description ?? undefined,
        quantity: item.quantity ?? 1,
        currentLocation: item.currentLocation,
        notes: item.notes ?? undefined,
        status: "ACTIVE",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
  }
  console.log(`  Inventory items: ${inventoryItems.length}`);

  // Gift Items
  const gifts = [
    { title: "Wine Bottle", description: "Bordeaux Red", quantity: 12 },
    { title: "Gift Card", description: "$50 Restaurant", quantity: 20 },
    { title: "Candle Set", description: "Scented, Set of 3", quantity: 8 },
  ];

  for (const g of gifts) {
    await prisma.giftItem.create({
      data: {
        title: g.title,
        description: g.description,
        quantity: g.quantity,
        status: "ACTIVE",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
  }
  console.log(`  Gift items: ${gifts.length}`);

  // Sample Events
  const today = new Date();
  const events = [
    {
      companyName: "Acme Corp",
      eventName: "Annual Awards Gala",
      startDate: new Date(today.getFullYear(), today.getMonth() - 1, 10),
      endDate: new Date(today.getFullYear(), today.getMonth() - 1, 12),
      location: "Grand Ballroom, NYC",
      notes: "Past event — full setup required",
    },
    {
      companyName: "Horizon Tech",
      eventName: "Product Launch Summit",
      startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1),
      endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2),
      location: "Moscone Center, SF",
      notes: "Ongoing — booth A12",
    },
    {
      companyName: "Stellar Brands",
      eventName: "Holiday Party",
      startDate: new Date(today.getFullYear(), today.getMonth() + 1, 15),
      endDate: new Date(today.getFullYear(), today.getMonth() + 1, 15),
      location: "Rooftop Venue, Chicago",
      notes: "Evening event, capacity 200",
    },
  ];

  for (const ev of events) {
    await prisma.event.create({
      data: {
        ...ev,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
  }
  console.log(`  Events: ${events.length}`);

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
