import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const unsafePasswords = new Set(["admin123", "user123", "password", "password123"]);

function printUsage() {
  console.log(`Usage: npm run admin <command>

Commands:
  create  Create or update a production admin user from ADMIN_* env vars

Required env vars for create:
  ADMIN_EMAIL
  ADMIN_PASSWORD
  ADMIN_NAME`);
}

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

async function createAdmin() {
  const email = readRequiredEnv("ADMIN_EMAIL").toLowerCase();
  const password = readRequiredEnv("ADMIN_PASSWORD");
  const name = readRequiredEnv("ADMIN_NAME");

  if (!email.includes("@")) {
    throw new Error("ADMIN_EMAIL must be a valid email address.");
  }

  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  }

  if (unsafePasswords.has(password.toLowerCase())) {
    throw new Error("ADMIN_PASSWORD cannot be a known demo or weak password.");
  }

  const databaseUrl = readRequiredEnv("DATABASE_URL");
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      await prisma.user.update({
        where: { email },
        data: {
          name,
          passwordHash,
          role: "ADMIN",
        },
      });
      console.log(`Admin user updated: ${email}`);
      return;
    }

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "ADMIN",
      },
    });
    console.log(`Admin user created: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

const commandName = process.argv[2];

if (!commandName) {
  printUsage();
  process.exit(0);
}

if (commandName !== "create") {
  printUsage();
  process.exit(1);
}

createAdmin().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
