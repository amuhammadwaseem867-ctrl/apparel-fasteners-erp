/*
 * Brings a database up to the code on this branch, safely, in order:
 *   1. takes a backup with pg_dump and proves it is readable (pg_restore --list),
 *   2. shows the pending migrations and asks you to type YES,
 *   3. applies them (all additive) and verifies the schema,
 *   4. seeds the built-in permissions and roles.
 * It stops at the first failure. Usage (DATABASE_URL in your .env):
 *   node --env-file=.env scripts/go-live.mjs
 * Options: --backup=<file.dump> to use a backup you already took and checked.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { createInterface } from "node:readline/promises";

const url = process.env.DATABASE_URL;
const option = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

function stop(message) {
  console.error(`\n✖ ${message}\nNothing after this step was run.`);
  process.exit(1);
}

function run(label, command, args, { capture = false } = {}) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, args, { stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit", encoding: "utf8", shell: process.platform === "win32" });
  if (result.error) stop(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) stop(`${label} failed (exit ${result.status}).`);
  return result.stdout ?? "";
}

if (!url) stop("DATABASE_URL is not set. Put it in .env and run: node --env-file=.env scripts/go-live.mjs");
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
  run("Backing up the database (pg_dump)", "pg_dump", ["--format=custom", `--file=${backup}`, url]);
}
if (!existsSync(backup) || statSync(backup).size === 0) stop(`Backup ${backup} is missing or empty.`);
const listing = run("Checking the backup can be restored (pg_restore --list)", "pg_restore", ["--list", backup], { capture: true });
const tables = listing.split("\n").filter((line) => / TABLE DATA /.test(line)).length;
if (tables === 0) stop(`Backup ${backup} contains no table data; refusing to continue.`);
console.log(`✔ Backup ${backup} (${(statSync(backup).size / 1048576).toFixed(1)} MB, ${tables} tables with data) is readable.`);

// 2. Show what will change and ask.
run("Pending migrations", "npx", ["prisma", "migration", "status", "--db", url]);
const answer = await createInterface({ input: process.stdin, output: process.stdout }).question(
  `\nApply the pending migrations to "${database}" on ${host}? Type YES to continue: `,
);
if (answer.trim() !== "YES") stop("Not confirmed.");

// 3. Apply and verify.
run("Applying migrations", "npx", ["prisma", "db", "migrate", "--db", url]);
run("Verifying the schema", "npx", ["prisma", "db", "verify", "--db", url]);

// 4. Permissions and roles.
run("Seeding permissions and roles", process.execPath, ["scripts/seed-access-control.mjs"]);

console.log(`\n✔ Done. Keep ${backup} until you have checked the app.`);
console.log("Next: sign in, fill Administration → Settings, and run Finance → Journal → \"Post earlier documents\" once.");
process.exit(0);
