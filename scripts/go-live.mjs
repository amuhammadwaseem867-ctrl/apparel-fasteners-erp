/*
 * Brings a database up to the code on this branch, safely, in order:
 *   1. takes a backup with pg_dump and proves it is readable (pg_restore --list),
 *   2. shows the pending migrations and asks you to type YES,
 *   3. applies them (all additive) and verifies the schema,
 *   4. seeds the built-in permissions and roles.
 * It stops at the first failure. Usage (DATABASE_URL in .env.local or .env):
 *   npm run go-live
 * Options: --backup=<file.dump> to use a backup you already took and checked.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";

import "./load-env.mjs";

const url = process.env.DATABASE_URL;
const option = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

function stop(message) {
  console.error(`\n✖ ${message}\nNothing after this step was run.`);
  process.exit(1);
}

function run(label, command, args, { capture = false } = {}) {
  console.log(`\n▶ ${label}`);
  // Never through a shell: a connection string with & or % must reach the tool unchanged.
  const result = spawnSync(command, args, { stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit", encoding: "utf8" });
  if (result.error) stop(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) stop(`${label} failed (exit ${result.status}).`);
  return result.stdout ?? "";
}

/*
 * pg_dump / pg_restore: from PATH, or on Windows from the newest
 * C:\Program Files\PostgreSQL\<version>\bin, so no PATH change is needed.
 */
function pgTool(name) {
  const onPath = spawnSync(name, ["--version"], { encoding: "utf8" });
  if (onPath.status === 0) return name;
  if (process.platform === "win32") {
    for (const root of [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter(Boolean)) {
      const base = join(root, "PostgreSQL");
      if (!existsSync(base)) continue;
      const versions = readdirSync(base).filter((entry) => /^\d+/.test(entry)).sort((a, b) => parseFloat(b) - parseFloat(a));
      for (const version of versions) {
        const candidate = join(base, version, "bin", `${name}.exe`);
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  stop(`${name} was not found. Install the PostgreSQL 17 (or newer) "Command Line Tools" from https://www.enterprisedb.com/downloads/postgres-postgresql-downloads and run npm run go-live again.`);
}

/* The Prisma CLI from node_modules, run by this Node (no npx, no shell). */
const require = createRequire(import.meta.url);
const prismaPackage = require("prisma/package.json");
const prismaBin = join(dirname(require.resolve("prisma/package.json")), typeof prismaPackage.bin === "string" ? prismaPackage.bin : prismaPackage.bin.prisma);
const prisma = (...args) => [process.execPath, [prismaBin, ...args]];

if (!url) stop("DATABASE_URL is not set. Put it in .env.local (or .env) and run: npm run go-live");
let host = "?";
let database = "?";
try {
  const parsed = new URL(url);
  host = parsed.hostname;
  database = parsed.pathname.replace(/^\//, "");
} catch {
  stop("DATABASE_URL is not a valid connection string.");
}
console.log(`Target database: ${database} on ${host}`);

// 1. Backup, then prove it can be read back.
let backup = option("backup");
if (!backup) {
  mkdirSync("backups", { recursive: true });
  backup = `backups/${database}-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`;
  const pgDump = pgTool("pg_dump");
  console.log(`Using ${pgDump}`);
  run("Backing up the database (pg_dump)", pgDump, ["--format=custom", `--file=${backup}`, url]);
}
if (!existsSync(backup) || statSync(backup).size === 0) stop(`Backup ${backup} is missing or empty.`);
const listing = run("Checking the backup can be restored (pg_restore --list)", pgTool("pg_restore"), ["--list", backup], { capture: true });
const tables = listing.split("\n").filter((line) => / TABLE DATA /.test(line)).length;
if (tables === 0) stop(`Backup ${backup} contains no table data; refusing to continue.`);
console.log(`✔ Backup ${backup} (${(statSync(backup).size / 1048576).toFixed(1)} MB, ${tables} tables with data) is readable.`);

// 2. Show what will change and ask.
run("Pending migrations", ...prisma("migration", "status", "--db", url));
const answer = await createInterface({ input: process.stdin, output: process.stdout }).question(
  `\nApply the pending migrations to "${database}" on ${host}? Type YES to continue: `,
);
if (answer.trim() !== "YES") stop("Not confirmed.");

// 3. Apply and verify.
run("Applying migrations", ...prisma("db", "migrate", "--db", url));
run("Verifying the schema", ...prisma("db", "verify", "--db", url));

// 4. Permissions and roles.
run("Seeding permissions and roles", process.execPath, ["scripts/seed-access-control.mjs"]);

console.log(`\n✔ Done. Keep ${backup} until you have checked the app.`);
console.log("Next: sign in, fill Administration → Settings, and run Finance → Journal → \"Post earlier documents\" once.");
process.exit(0);
