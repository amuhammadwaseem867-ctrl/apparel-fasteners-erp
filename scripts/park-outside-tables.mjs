/*
 * For a database whose migration marker is not in this repository's graph but
 * whose schema contains the whole base migration plus tables this code never
 * created (some with names our later migrations need).
 *
 * It deletes nothing. In one transaction it moves those outside tables, with
 * their rows, indexes and constraints, from "public" to the schema
 * "erp_outside_legacy" (undo: ALTER TABLE erp_outside_legacy.<t> SET SCHEMA public),
 * then signs the database as being at the base migration so npm run go-live
 * can apply the rest. It needs a backup that contains every table it moves.
 *   npm run db:park-outside-tables -- --backup=backups/<file>.dump
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import pg from "pg";

import "./load-env.mjs";

const BASE_MIGRATION = "20261008T1419_migration";
const TARGET_SCHEMA = "erp_outside_legacy";

function stop(message) {
  console.error(`\n✖ ${message}\nNothing was changed.`);
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) stop("DATABASE_URL is not set. Put it in .env.local (or .env).");
const backup = process.argv.find((arg) => arg.startsWith("--backup="))?.slice("--backup=".length);
if (!backup) stop("Pass the backup npm run go-live made: npm run db:park-outside-tables -- --backup=backups/<file>.dump");
if (!existsSync(backup) || statSync(backup).size === 0) stop(`Backup ${backup} is missing or empty.`);

const parsed = new URL(url);
const database = parsed.pathname.replace(/^\//, "");
console.log(`Target database: ${database} on ${parsed.hostname}`);

/* Every contract in the on-disk graph, and the tables of the base one. */
const snapshotHashes = new Set(readdirSync("migrations/snapshots"));
const baseMeta = JSON.parse(readFileSync(join("migrations/app", BASE_MIGRATION, "migration.json"), "utf8"));
const baseHash = String(baseMeta.to).replace(/^sha256:/, "");
const baseTables = new Map(
  Object.entries(JSON.parse(readFileSync(join("migrations/snapshots", baseHash, "contract.json"), "utf8")).storage.namespaces.public.entries.table)
    .map(([table, spec]) => [table, Object.keys(spec.columns)]),
);

const quote = (name) => `"${name.replace(/"/g, '""')}"`;

const client = new pg.Client({ connectionString: url });
await client.connect();

async function inspect() {
  const { rows } = await client.query(
    "select table_name, column_name from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position",
  );
  const live = new Map();
  for (const { table_name: table, column_name: column } of rows) {
    if (!live.has(table)) live.set(table, new Set());
    live.get(table).add(column);
  }
  const marker = (await client.query("select core_hash from prisma_contract.marker where space = 'app'").catch(() => ({ rows: [] }))).rows[0];
  return { live, marker: marker?.core_hash?.replace(/^sha256:/, "") ?? null };
}

let outside;
try {
  await client.query("BEGIN READ ONLY");
  const { live, marker } = await inspect();
  if (!marker) stop("The database has no migration marker; this script is only for a marker that is not in the graph.");
  if (snapshotHashes.has(marker)) stop(`The marker (${marker.slice(0, 12)}) is a known migration; use npm run go-live instead.`);
  for (const [table, columns] of baseTables) {
    const actual = live.get(table);
    if (!actual) stop(`Base table ${table} is missing, so the database is not at ${BASE_MIGRATION}.`);
    const missing = columns.filter((column) => !actual.has(column));
    if (missing.length) stop(`Base table ${table} lacks ${missing.join(", ")}, so the database is not at ${BASE_MIGRATION}.`);
  }
  outside = [...live.keys()].filter((table) => !baseTables.has(table));
  if (outside.length === 0) stop("There are no outside tables to move.");

  console.log(`\nThe base migration's ${baseTables.size} tables are all present. Tables this code did not create:`);
  for (const table of outside) {
    const { rows } = await client.query(`select count(*)::int as n from public.${quote(table)}`);
    console.log(`  ${table.padEnd(34)} ${String(rows[0].n).padStart(7)} rows`);
  }
  const existing = await client.query("select 1 from information_schema.schemata where schema_name = $1", [TARGET_SCHEMA]);
  if (existing.rowCount) {
    const clash = await client.query(
      "select table_name from information_schema.tables where table_schema = $1 and table_name = any($2)",
      [TARGET_SCHEMA, outside],
    );
    if (clash.rowCount) stop(`${TARGET_SCHEMA} already has ${clash.rows.map((row) => row.table_name).join(", ")}.`);
  }

  /* Extra columns on base tables stay; warn when one would block inserts. */
  const blocking = await client.query(
    `select table_name, column_name from information_schema.columns
      where table_schema = 'public' and table_name = any($1) and is_nullable = 'NO' and column_default is null`,
    [[...baseTables.keys()]],
  );
  for (const { table_name: table, column_name: column } of blocking.rows) {
    if (!baseTables.get(table).includes(column)) {
      console.log(`  ⚠ ${table}.${column} is NOT NULL without a default; this code does not fill it, so inserts into ${table} will fail.`);
    }
  }
} finally {
  await client.query("ROLLBACK").catch(() => {});
}

/* The backup must hold every table that will be moved. */
function pgTool(name) {
  if (spawnSync(name, ["--version"]).status === 0) return name;
  if (process.platform === "win32") {
    for (const root of [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter(Boolean)) {
      const base = join(root, "PostgreSQL");
      if (!existsSync(base)) continue;
      for (const version of readdirSync(base).filter((entry) => /^\d+/.test(entry)).sort((a, b) => parseFloat(b) - parseFloat(a))) {
        const candidate = join(base, version, "bin", `${name}.exe`);
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  stop(`${name} was not found.`);
}
const listing = spawnSync(pgTool("pg_restore"), ["--list", backup], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
if (listing.status !== 0) stop(`pg_restore --list ${backup} failed.`);
const inBackup = new Set(
  listing.stdout.split("\n").filter((line) => / TABLE DATA public /.test(line)).map((line) => line.split(" TABLE DATA public ")[1]?.split(" ")[0]),
);
const notBackedUp = outside.filter((table) => !inBackup.has(table));
if (notBackedUp.length) stop(`Backup ${backup} does not contain: ${notBackedUp.join(", ")}.`);
console.log(`\n✔ Backup ${backup} contains all ${outside.length} of them.`);

const prompt = createInterface({ input: process.stdin, output: process.stdout });
const answer = await new Promise((resolve) => {
  prompt.on("close", () => resolve(null));
  prompt.question(
    `\nMove these ${outside.length} tables (with their rows) from public to ${TARGET_SCHEMA} in "${database}", and mark it as at ${BASE_MIGRATION}? Type MOVE to continue: `,
    resolve,
  );
});
prompt.close();
if (answer?.trim() !== "MOVE") stop("Not confirmed.");

try {
  await client.query("BEGIN");
  await client.query(`create schema if not exists ${quote(TARGET_SCHEMA)}`);
  for (const table of outside) {
    await client.query(`alter table public.${quote(table)} set schema ${quote(TARGET_SCHEMA)}`);
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  await client.end();
  stop(`Moving the tables failed and was rolled back: ${error.message}`);
}
await client.end();
console.log(`\n✔ Moved ${outside.length} tables to ${TARGET_SCHEMA}.`);

/* Prisma checks the schema satisfies the base contract before it writes the marker. */
const require = createRequire(import.meta.url);
const prismaPackage = require("prisma/package.json");
const prismaBin = join(dirname(require.resolve("prisma/package.json")), typeof prismaPackage.bin === "string" ? prismaPackage.bin : prismaPackage.bin.prisma);
console.log(`\n▶ Marking the database as at ${BASE_MIGRATION} (prisma db sign)`);
const sign = spawnSync(process.execPath, [prismaBin, "db", "sign", BASE_MIGRATION, "--no-advance-ref", "--db", url], { stdio: ["ignore", "inherit", "inherit"] });
if (sign.status !== 0) {
  console.error(`\n✖ prisma db sign failed (exit ${sign.status}). The tables are already in ${TARGET_SCHEMA}; send this output.`);
  process.exit(1);
}
console.log(`\n✔ Done. Now run: npm run go-live -- --backup=${backup}`);
