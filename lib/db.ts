import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // Neon and other managed Postgres providers require SSL in production.
    // The pg library does not reliably parse sslmode=require from the URL.
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function hasCurrentSchemaClient(client: PrismaClient | undefined): client is PrismaClient {
  return (
    typeof (
      client as
        | (PrismaClient & {
            storageLocation?: { findMany?: unknown };
          })
        | undefined
    )?.storageLocation?.findMany === "function"
  );
}

// In Next dev, globalThis can hold a Prisma client created before a schema change.
// Recreate it when required delegates are missing so new models work without a manual restart.
const existingPrisma = globalForPrisma.prisma;

export const prisma: PrismaClient = hasCurrentSchemaClient(existingPrisma)
  ? existingPrisma
  : createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
