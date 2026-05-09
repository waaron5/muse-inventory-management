import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

const commandName = process.argv[2];

function printUsage() {
  console.log(`Usage: npm run deps <command>

Commands:
  clean      Remove local install/build output
  reinstall  Clean install dependencies from the lockfile`);
}

function clean() {
  for (const path of ["node_modules", ".next"]) {
    rmSync(path, { recursive: true, force: true });
  }
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: "inherit" });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!commandName) {
  printUsage();
  process.exit(0);
}

if (commandName === "clean") {
  clean();
  process.exit(0);
}

if (commandName === "reinstall") {
  clean();
  run("npm", ["ci"]);
  process.exit(0);
}

printUsage();
process.exit(1);
