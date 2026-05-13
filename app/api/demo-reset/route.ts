import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createPrismaClient } from "@/lib/db";

const DEMO_IMAGE_URL = "/demo/images/demo-image.jpg";
const storageLocations = ["JP Display", "Nancy", "Muse Storage Unit"] as const;

export async function POST(request: Request) {
  // Only available in demo mode
  if (process.env.APP_MODE !== "demo") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Verify secret
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.DEMO_RESET_SECRET;
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let prisma: ReturnType<typeof createPrismaClient> | null = null;

  try {
    prisma = createPrismaClient();

    // Truncate all tables in FK-safe order
    await prisma.auditLog.deleteMany();
    await prisma.inventoryReservation.deleteMany();
    await prisma.giftReservation.deleteMany();
    await prisma.event.deleteMany();
    await prisma.inventoryItem.deleteMany();
    await prisma.giftItem.deleteMany();
    await prisma.storageLocation.deleteMany();
    await prisma.user.deleteMany();

    // Re-seed users
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

    await prisma.user.create({
      data: {
        name: "Muse User",
        email: "user@muse.local",
        passwordHash: userHash,
        role: "USER",
      },
    });

    await prisma.storageLocation.createMany({
      data: storageLocations.map((name) => ({ name })),
    });

    // Re-seed inventory
    const inventoryData = [
      {
        title: "Signs",
        description: "Instructure, Curved Wall",
        quantity: 6,
        currentLocation: "JP Display",
      },
      { title: "Cooler", description: "Red, Igloo", quantity: 1, currentLocation: "JP Display" },
      {
        title: "Bottles/Vases",
        description: "Brown Glass",
        quantity: 7,
        currentLocation: "JP Display",
      },
      {
        title: "Stanchions",
        description: "Red & Gold",
        quantity: 20,
        currentLocation: "JP Display",
      },
      {
        title: "Ropes",
        description: "Red Velvet, 5'",
        quantity: 18,
        currentLocation: "JP Display",
      },
      { title: "Ticket Booth", description: null, quantity: 1, currentLocation: "JP Display" },
      {
        title: "Stands",
        description: "Tall, Black Frame, Set of 5",
        quantity: 5,
        currentLocation: "JP Display",
      },
    ];

    for (const item of inventoryData) {
      await prisma.inventoryItem.create({
        data: {
          title: item.title,
          description: item.description ?? undefined,
          imageUrl: DEMO_IMAGE_URL,
          quantity: item.quantity,
          currentLocation: item.currentLocation,
          status: "ACTIVE",
          createdById: admin.id,
          updatedById: admin.id,
        },
      });
    }

    // Re-seed gifts
    const giftData = [
      {
        title: "Wine Bottle",
        description: "Bordeaux Red",
        quantity: 12,
        currentLocation: "JP Display",
      },
      {
        title: "Gift Card",
        description: "$50 Restaurant",
        quantity: 20,
        currentLocation: "Nancy",
      },
      {
        title: "Candle Set",
        description: "Scented, Set of 3",
        quantity: 8,
        currentLocation: "Muse Storage Unit",
      },
    ];

    for (const g of giftData) {
      await prisma.giftItem.create({
        data: {
          title: g.title,
          description: g.description,
          imageUrl: DEMO_IMAGE_URL,
          quantity: g.quantity,
          currentLocation: g.currentLocation,
          status: "ACTIVE",
          createdById: admin.id,
          updatedById: admin.id,
        },
      });
    }

    // Re-seed events
    const now = new Date();
    const daysFromNow = (d: number) =>
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);

    await prisma.event.create({
      data: {
        companyName: "Horizon Tech",
        eventName: "Product Launch Summit",
        plCode: "HZN-2048",
        startDate: daysFromNow(-1),
        endDate: daysFromNow(2),
        location: "Moscone Center, SF",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    await prisma.event.create({
      data: {
        companyName: "Horizon Tech",
        eventName: "Partner Roadshow",
        plCode: "HZN-2112",
        startDate: daysFromNow(26),
        endDate: daysFromNow(27),
        location: "Bellagio, Las Vegas",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    await prisma.event.create({
      data: {
        companyName: "Stellar Brands",
        eventName: "Holiday Party",
        plCode: "STL-7810",
        startDate: daysFromNow(30),
        endDate: daysFromNow(30),
        location: "Rooftop Venue, Chicago",
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Demo data reset successfully",
      counts: {
        users: 2,
        inventoryItems: inventoryData.length,
        giftItems: giftData.length,
        events: 3,
      },
    });
  } catch (error) {
    console.error("Demo reset failed:", error);
    const details = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Reset failed", details }, { status: 500 });
  } finally {
    if (prisma) {
      try {
        await prisma.$disconnect();
      } catch (disconnectError) {
        console.error("Demo reset disconnect failed:", disconnectError);
      }
    }
  }
}
