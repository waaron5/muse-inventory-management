import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Publishes the public copy of this repo (ADR 0016): committed `main`, minus
// what stays private, with real client names swapped for made-up ones, then a
// leak check that refuses to push if anything private is left. The public repo
// is only ever written by this. Run by the maintainer after a merge:
// `pnpm publish:public`, or `pnpm publish:public --dry-run` to look first.
// Plain Node, because it runs directly, without the app's "@/" paths.

const PUBLIC_REPO = "waaron5/muse-inventory-management";
const AUTHOR = { name: "Aaron Wood", email: "192060470+waaron5@users.noreply.github.com" };
const PRIVATE_REPO_LINK = /\[([^\]]+)\]\(https:\/\/github\.com\/waaron5\/muse-inventory\/[^)]*\)/g;
const PRIVATE_ISSUE_ASIDE = / ?\(\[#\d+\]\(https:\/\/github\.com\/waaron5\/muse-inventory\/[^)]*\)\)/g;

/** The real names and their stand-ins, kept in this private file and never published. */
export type Names = { swaps: [real: string, madeUp: string][]; alsoRefuse: string[] };
const NAMES_FILE = "scripts/public-names.json";

/** Left out of the public copy: agent instructions, vendored tools, internal plans and setup. */
export const leftOut = [
  /^AGENTS\.md$/,
  /^CLAUDE\.md$/,
  /^PRODUCT\.md$/,
  /^\.claude\//,
  /^\.agents\//,
  /^\.github\/(agents|hooks|skills)\//,
  /^\.impeccable\//,
  /^docs\/agents\//,
  /^docs\/email-setup\.md$/,
  /^docs\/ui-launch-plan\.md$/,
  /^demo\//,
  /^scripts\/public-names\.json$/,
];

/** Files the demo replaces: Hobby allows only daily crons, and the demo resets nightly. */
export const replaced: Record<string, string> = { "vercel.json": "demo/vercel.json" };

// Generated, and full of hashes a short name could turn up in by chance.
const untouched = [/^pnpm-lock\.yaml$/];

export const isLeftOut = (file: string) => leftOut.some((pattern) => pattern.test(file));

/** A file's text for the public copy: names swapped, links into the private repo unwrapped. */
export function sanitize(text: string, names: Names): string {
  let out = text.replace(PRIVATE_ISSUE_ASIDE, "").replace(PRIVATE_REPO_LINK, "$1");
  for (const [real, madeUp] of [...names.swaps].sort((a, b) => b[0].length - a[0].length)) {
    out = out.replace(wordPattern(real), (found) => matchCase(found, madeUp));
  }
  return out;
}

/** What in a file would give something private away, with the line it's on. */
export function leaks(file: string, text: string, names: Names): string[] {
  const checks: [string, RegExp][] = [
    ...[...names.swaps.map(([real]) => real), ...names.alsoRefuse].map((term) => [term, wordPattern(term)] as [string, RegExp]),
    ["a link into the private repo", /github\.com\/waaron5\/muse-inventory(?![\w-])/g],
    ["a price a month or a year", /\$\d[\d,.]*\s*(?:a|per|\/)\s*(?:month|mo|year|yr)\b/gi],
  ];
  if (file.endsWith(".md")) checks.push(["a dollar amount", /\$\d/g]);
  const found: string[] = [];
  text.split("\n").forEach((line, i) => {
    for (const [what, pattern] of checks) {
      if (new RegExp(pattern.source, pattern.flags.replace("g", "")).test(line)) found.push(`${file}:${i + 1}: ${what}`);
    }
  });
  return found;
}

// The term on its own, in any case: not inside a longer word.
function wordPattern(term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const before = /^[A-Za-z]/.test(term) ? "(?<![A-Za-z])" : "";
  const after = /[A-Za-z]$/.test(term) ? "(?![A-Za-z])" : "";
  return new RegExp(`${before}${escaped}${after}`, "gi");
}

// "cove" becomes "cove", "COVE" becomes "COVE", anything else the stand-in as written.
function matchCase(found: string, madeUp: string) {
  if (found === found.toLowerCase()) return madeUp.toLowerCase();
  if (found === found.toUpperCase() && /[A-Z]{2}/.test(found)) return madeUp.toUpperCase();
  return madeUp;
}

const isBinary = (bytes: Buffer) => bytes.subarray(0, 8000).includes(0);

async function* walk(dir: string, base = dir): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full, base);
    else yield path.relative(base, full);
  }
}

const run = (command: string, args: string[], cwd?: string) =>
  execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  // Only merged work is published; another ref is for a dry run.
  const from = process.argv.indexOf("--from");
  const SOURCE = from > 0 ? process.argv[from + 1] : "origin/main";
  if (SOURCE !== "origin/main" && !dryRun) {
    console.error("Only origin/main is published. Use --from with --dry-run.");
    process.exit(1);
  }
  if (!existsSync(NAMES_FILE)) {
    console.error(`${NAMES_FILE} is missing: it holds the real names, and is only in the private repo.`);
    process.exit(1);
  }
  const names = JSON.parse(await readFile(NAMES_FILE, "utf8")) as Names;

  run("git", ["fetch", "--quiet", "origin", "main"]);
  const sha = run("git", ["rev-parse", "--short", SOURCE]);
  const work = await mkdtemp(path.join(tmpdir(), "muse-public-"));
  const source = path.join(work, "source");
  const target = path.join(work, "public");
  await mkdir(source);
  execFileSync("sh", ["-c", `git archive ${SOURCE} | tar -x -C "${source}"`], { stdio: "inherit" });
  run("gh", ["repo", "clone", PUBLIC_REPO, target, "--", "--quiet"]);

  // Starts from nothing each time, so whatever left this repo leaves the public one too.
  for (const entry of await readdir(target)) if (entry !== ".git") await rm(path.join(target, entry), { recursive: true });

  const problems: string[] = [];
  const binaries: string[] = [];
  for await (const file of walk(source)) {
    if (isLeftOut(file)) continue;
    const from = path.join(source, replaced[file] ?? file);
    const bytes = await readFile(from);
    const to = path.join(target, file);
    await mkdir(path.dirname(to), { recursive: true });
    if (isBinary(bytes) || untouched.some((pattern) => pattern.test(file))) {
      if (isBinary(bytes)) binaries.push(file);
      await writeFile(to, bytes);
    } else {
      const text = sanitize(bytes.toString("utf8"), names);
      problems.push(...leaks(file, text, names));
      await writeFile(to, text);
    }
    await chmod(to, (await stat(from)).mode);
  }

  if (problems.length > 0) {
    console.error(`Not published: ${problems.length} things private would go public.\n${problems.join("\n")}`);
    process.exit(1);
  }
  console.log(`Binary files, copied as they are (look at any new one): ${binaries.join(", ")}`);

  run("git", ["add", "--all"], target);
  if (!run("git", ["status", "--porcelain"], target)) {
    console.log(`Nothing to publish: the public repo already matches ${sha}.`);
    return;
  }
  const day = new Date().toISOString().slice(0, 10);
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: AUTHOR.name,
    GIT_AUTHOR_EMAIL: AUTHOR.email,
    GIT_COMMITTER_NAME: AUTHOR.name,
    GIT_COMMITTER_EMAIL: AUTHOR.email,
  };
  execFileSync("git", ["commit", "--quiet", "-m", `Sync with production (${day})`], { cwd: target, env, stdio: "inherit" });
  console.log(run("git", ["show", "--stat", "--format=%h %s", "HEAD"], target).split("\n").slice(0, 40).join("\n"));
  if (dryRun) {
    console.log(`Dry run: committed in ${target}, not pushed.`);
    return;
  }
  execFileSync("git", ["push", "--quiet", "origin", "HEAD:main"], { cwd: target, stdio: "inherit" });
  await rm(work, { recursive: true });
  console.log(`Published ${sha} to ${PUBLIC_REPO}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
