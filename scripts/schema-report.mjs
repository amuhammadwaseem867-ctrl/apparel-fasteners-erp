/*
 * Read-only: compares the tables and columns of DATABASE_URL with the schema
 * after each migration in migrations/, and says which one it matches.
 * It runs in a READ ONLY transaction and prints names only (no data, no secrets).
 *   npm run db:schema-report
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

import "./load-env.mjs";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Put it in .env.local (or .env).");
  process.exit(1);
}

/* Expected public tables and columns after each migration, from the on-disk graph. */
const migrationsDir = "migrations/app";
const steps = readdirSync(migrationsDir).sort().map((name) => {
  const meta = JSON.parse(readFileSync(join(migrationsDir, name, "migration.json"), "utf8"));
  const to = String(meta.to ?? meta.toStorageHash ?? meta.toHash ?? "").replace(/^sha256:/, "");
  const snapshot = JSON.parse(readFileSync(join("migrations/snapshots", to, "contract.json"), "utf8"));
  const tables = new Map(
    Object.entries(snapshot.storage.namespaces.public.entries.table).map(([table, spec]) => [table, new Set(Object.keys(spec.columns))]),
  );
  return { name, hash: to.slice(0, 12), tables };
});

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
let live;
let markers = [];
try {
  await client.query("BEGIN READ ONLY");
  const { rows } = await client.query(
    "select table_name, column_name from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position",
  );
  live = new Map();
  for (const { table_name: table, column_name: column } of rows) {
    if (!live.has(table)) live.set(table, new Set());
    live.get(table).add(column);
  }
  const markerTable = await client.query("select to_regclass('prisma_contract.marker') as t");
  if (markerTable.rows[0].t) {
    markers = (await client.query("select * from prisma_contract.marker")).rows;
  }
} finally {
  await client.query("ROLLBACK").catch(() => {});
  await client.end();
}

console.log(`Live database: ${live.size} tables in public.`);
for (const marker of markers) {
  const hashes = Object.entries(marker)
    .filter(([, value]) => typeof value === "string" && /^(sha256:)?[0-9a-f]{12,}$/.test(value))
    .map(([key, value]) => `${key}=${value.replace(/^sha256:/, "").slice(0, 12)}`);
  console.log(`Marker: ${hashes.join(" ")}`);
}

function compare(expected) {
  const missingTables = [...expected.keys()].filter((table) => !live.has(table));
  const extraTables = [...live.keys()].filter((table) => !expected.has(table));
  const missingColumns = [];
  const extraColumns = [];
  for (const [table, columns] of expected) {
    const actual = live.get(table);
    if (!actual) continue;
    for (const column of columns) if (!actual.has(column)) missingColumns.push(`${table}.${column}`);
    for (const column of actual) if (!columns.has(column)) extraColumns.push(`${table}.${column}`);
  }
  return { missingTables, extraTables, missingColumns, extraColumns };
}

let best = null;
console.log("\nAfter migration                              missing tables / extra tables / missing cols / extra cols");
for (const step of steps) {
  const diff = compare(step.tables);
  const score = diff.missingTables.length + diff.extraTables.length + diff.missingColumns.length + diff.extraColumns.length;
  console.log(
    `  ${step.name.padEnd(44)} ${String(diff.missingTables.length).padStart(3)} / ${String(diff.extraTables.length).padStart(3)} / ${String(diff.missingColumns.length).padStart(3)} / ${String(diff.extraColumns.length).padStart(3)}`,
  );
  if (!best || score < best.score) best = { step, diff, score };
}

const show = (label, list) => {
  if (list.length) console.log(`  ${label} (${list.length}): ${list.slice(0, 40).join(", ")}${list.length > 40 ? ", ..." : ""}`);
};
console.log(`\nClosest match: ${best.step.name} (${best.step.hash})${best.score === 0 ? " — exact" : ""}`);
show("Missing tables", best.diff.missingTables);
show("Extra tables", best.diff.extraTables);
show("Missing columns", best.diff.missingColumns);
show("Extra columns", best.diff.extraColumns);
console.log("\nNothing was changed.");
