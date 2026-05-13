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
const localOnlyCommands = new Set<CommandName>(["reset", "seed", "demo"]);

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

function isProductionEnvironment() {
  return process.env.APP_MODE === "production" || process.env.NODE_ENV === "production";
}

const commandName = process.argv[2] as CommandName | undefined;

if (!commandName || !(commandName in commands)) {
  printUsage();
  process.exit(commandName ? 1 : 0);
}

if (isProductionEnvironment() && localOnlyCommands.has(commandName)) {
  console.error(
    [
      `Refusing to run "npm run db ${commandName}" in production mode.`,
      "Production databases should use migrations and a safe admin bootstrap instead:",
      "  npm run db deploy",
      "  npm run admin create",
    ].join("\n"),
  );
  process.exit(1);
}

const [command, args] = commands[commandName];
const result = spawnSync(command, args, { stdio: "inherit" });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
