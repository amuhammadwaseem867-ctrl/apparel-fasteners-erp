/*
 * Brings a database up to the code on this branch, safely, in order:
 *   1. takes a backup with pg_dump and proves it is readable (pg_restore --list),
 *   2. shows the pending migrations and asks you to type YES,
 *   3. applies them (all additive) and verifies the schema,
 *   4. seeds the built-in permissions and roles.
 * It stops at the first failure. Usage (DATABASE_URL in .env.local or .env):
 *   npm run go-live
 * Options: --backup=<file.dump> to use a backup you already took and checked;
 *          --confirm=YES instead of typing YES, where the terminal gives no keyboard input.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { confirm } from "./confirm.mjs";
import "./load-env.mjs";

const url = process.env.DATABASE_URL;
const option = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

function stop(message) {
  console.error(`\n✖ ${message}\nNothing after this step was run.`);
  process.exit(1);
}

function run(label, command, args, { capture = false, quiet = false } = {}) {
  console.log(`\n▶ ${label}`);
  // Never through a shell: a connection string with & or % must reach the tool unchanged.
  // stdin is not shared, so a child cannot close it before we ask for YES.
  const result = spawnSync(command, args, { stdio: ["ignore", capture ? "pipe" : "inherit", capture ? "pipe" : "inherit"], encoding: "utf8" });
  if (capture && !quiet) {
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
  }
  if (result.error) stop(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) stop(`${label} failed (exit ${result.status}).`);
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
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

/* Prints the JSON result of `prisma migration status` (piped output) as a short list. */
function printStatus(output) {
  const line = output.split("\n").find((text) => text.includes('"commandId":"migration.status"') && text.includes('"kind":"result"'));
  let envelope;
  try {
    envelope = JSON.parse(line).envelope;
  } catch {
    process.stdout.write(output);
    return;
  }
  for (const space of envelope.result?.spaces ?? []) {
    for (const migration of [...space.migrations].reverse()) {
      console.log(`  ${migration.status === "applied" ? "✓ applied" : "· pending"}  ${migration.name}  (${migration.operationCount} ops)`);
    }
  }
  if (envelope.result?.summary) console.log(`  ${envelope.result.summary}`);
  for (const diagnostic of envelope.diagnostics ?? []) console.log(`  ⚠ [${diagnostic.code}] ${diagnostic.summary}`);
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
const listing = run("Checking the backup can be restored (pg_restore --list)", pgTool("pg_restore"), ["--list", backup], { capture: true })
  .split("\n").filter((line) => !line.startsWith(";")).join("\n");
const tables = listing.split("\n").filter((line) => / TABLE DATA /.test(line)).length;
if (tables === 0) stop(`Backup ${backup} contains no table data; refusing to continue.`);
console.log(`✔ Backup ${backup} (${(statSync(backup).size / 1048576).toFixed(1)} MB, ${tables} tables with data) is readable.`);

// 2. Show what will change and ask.
const status = run("Pending migrations", ...prisma("migration", "status", "--db", url), { capture: true, quiet: true });
printStatus(status);
if (/MARKER_NOT_IN_HISTORY|not in the on-disk migration graph/.test(status)) {
  stop(
    "The database's migration marker does not match any migration in this repository, so it is not known which migrations are already in it.\n" +
      "  Run:  npm run db:schema-report   (read-only) and send its output. No migration was applied.",
  );
}
const decision = await confirm(`Apply the pending migrations to "${database}" on ${host}?`, "YES");
if (decision === "no-input") {
  stop(`No keyboard input reached the script. After reading the list above, run it again with --confirm=YES:
  npm run go-live -- --backup=${backup} --confirm=YES`);
}
if (decision !== "confirmed") stop("Not confirmed.");

// 3. Apply and verify.
run("Applying migrations", ...prisma("db", "migrate", "--db", url));
run("Verifying the schema", ...prisma("db", "verify", "--db", url));

// 4. Permissions and roles.
run("Seeding permissions and roles", process.execPath, ["scripts/seed-access-control.mjs"]);

console.log(`\n✔ Done. Keep ${backup} until you have checked the app.`);
console.log("Next: sign in, fill Administration → Settings, and run Finance → Journal → \"Post earlier documents\" once.");
process.exit(0);
