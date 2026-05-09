import { spawnSync } from "node:child_process";

const commands = {
  up: ["docker", ["compose", "up", "-d"]],
  down: ["docker", ["compose", "down"]],
  logs: ["docker", ["compose", "logs", "-f", "postgres"]],
  generate: ["prisma", ["generate"]],
  migrate: ["prisma", ["migrate", "dev"]],
  deploy: ["prisma", ["migrate", "deploy"]],
  status: ["prisma", ["migrate", "status"]],
  reset: ["prisma", ["migrate", "reset"]],
  seed: ["tsx", ["prisma/seed.ts"]],
  demo: ["tsx", ["prisma/demo-seed.ts"]],
} as const;

type CommandName = keyof typeof commands;

function printUsage() {
  console.log(`Usage: npm run db <command>

Commands:
  up        Start local Postgres
  down      Stop local Postgres
  logs      Follow Postgres logs
  generate  Generate Prisma client
  migrate   Create/apply a development migration
  deploy    Apply migrations in deploy mode
  status    Show migration status
  reset     Reset the local database
  seed      Seed the local database
  demo      Reset demo data`);
}

const commandName = process.argv[2] as CommandName | undefined;

if (!commandName || !(commandName in commands)) {
  printUsage();
  process.exit(commandName ? 1 : 0);
}

const [command, args] = commands[commandName];
const result = spawnSync(command, args, { stdio: "inherit" });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
