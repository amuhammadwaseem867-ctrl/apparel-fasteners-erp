/*
 * Moves the whole AF7 database to a new PostgreSQL server (e.g. from Prisma
 * Postgres to Neon), safely, in order:
 *   1. takes a backup of the current database with pg_dump and proves it is
 *      readable (the current database is only read, never changed),
 *   2. checks the new database is empty, so nothing there is overwritten,
 *   3. asks you to type MOVE,
 *   4. restores the backup into the new database in ONE transaction: all of
 *      it arrives, or nothing does,
 *   5. counts the rows of every table on both sides and stops if any differ.
 *
 * Usage (both connection strings in .env.local, never in chat):
 *   DATABASE_URL=<current database>
 *   NEW_DATABASE_URL=<new, empty database>
 *   npm run db:move
 * Options: --backup=<file.dump> to restore a backup you already took (for
 *          example after the old database was blocked);
 *          --confirm=MOVE where the terminal gives no keyboard input.
 * Afterwards: set DATABASE_URL to the new database (in .env.local and on
 * the hosting site) and deploy again.
 */

import { confirm } from "./confirm.mjs";
import "./load-env.mjs";
import { backupDatabase, pgTool, run, stop } from "./pg-tools.mjs";

const SCHEMAS = ["public", "prisma_contract"];

const option = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

function describe(url, label) {
  try {
    const parsed = new URL(url);
    return { host: parsed.hostname, database: parsed.pathname.replace(/^\//, "") || "postgres" };
  } catch {
    stop(`${label} is not a valid connection string.`);
  }
}

/* Row count of every table in the app's schemas, as "schema.table count" lines. */
export function countingSql() {
  return `select string_agg(format('select %L as t, count(*) as n from %I.%I', n.nspname || '.' || c.relname, n.nspname, c.relname), ' union all ' order by n.nspname, c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p') and n.nspname in (${SCHEMAS.map((schema) => `'${schema}'`).join(", ")})`;
}

function countRows(psql, url) {
  const query = run("Listing tables", psql, ["--no-psqlrc", "-At", "-v", "ON_ERROR_STOP=1", "-c", countingSql(), url], { capture: true, quiet: true }).trim();
  if (!query) return new Map();
  const lines = run("Counting rows", psql, ["--no-psqlrc", "-At", "-F", " ", "-v", "ON_ERROR_STOP=1", "-c", `${query} order by 1`, url], { capture: true, quiet: true })
    .split("\n").filter(Boolean);
  return new Map(lines.map((line) => [line.slice(0, line.lastIndexOf(" ")), Number(line.split(" ").at(-1))]));
}

async function main() {
  const source = process.env.DATABASE_URL;
  const target = process.env.NEW_DATABASE_URL;
  const given = option("backup");
  if (!target) stop("NEW_DATABASE_URL is not set. Put the new, empty database's connection string in .env.local as NEW_DATABASE_URL and run: npm run db:move");
  if (!source && !given) stop("DATABASE_URL is not set, and no --backup=<file.dump> was given.");
  const to = describe(target, "NEW_DATABASE_URL");
  const from = source ? describe(source, "DATABASE_URL") : null;
  if (from && from.host === to.host && from.database === to.database) stop("DATABASE_URL and NEW_DATABASE_URL are the same database.");
  console.log(`From: ${from ? `${from.database} on ${from.host}` : given}`);
  console.log(`To:   ${to.database} on ${to.host}`);

  const psql = pgTool("psql");

  // 1. The new database must be empty: nothing there is ever overwritten.
  const existing = run("Checking the new database is empty", psql, ["--no-psqlrc", "-At", "-v", "ON_ERROR_STOP=1", "-c",
    `select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind in ('r', 'p') and n.nspname in (${SCHEMAS.map((schema) => `'${schema}'`).join(", ")})`, target], { capture: true, quiet: true }).trim();
  if (Number(existing) > 0) stop(`The new database already has ${existing} tables. Use an empty database (create a new one), so nothing is overwritten.`);

  // 2. Backup of the current database (read only), proved readable.
  const backup = backupDatabase(source, from?.database ?? "backup", given);
  const before = source ? countRows(psql, source) : null;

  const decision = await confirm(`Copy everything into "${to.database}" on ${to.host}? The current database is not changed.`, "MOVE");
  if (decision === "no-input") stop(`No keyboard input reached the script. Run it again with --confirm=MOVE:\n  npm run db:move -- --backup=${backup} --confirm=MOVE`);
  if (decision !== "confirmed") stop("Not confirmed. Nothing was copied.");

  // 3. One transaction: everything arrives, or nothing does. Owners and grants
  //    belong to the old server, so they are left out. Only the app's schemas
  //    are copied (the old server's own extras stay behind); a schema filter
  //    restores no CREATE SCHEMA, so they are made first.
  run("Preparing the app's schemas", psql, ["--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-c",
    SCHEMAS.map((schema) => `create schema if not exists ${schema}`).join("; "), target], { capture: true, quiet: true });
  run("Restoring into the new database (one transaction)", pgTool("pg_restore"), [
    "--no-owner", "--no-acl", "--single-transaction", "--exit-on-error",
    ...SCHEMAS.flatMap((schema) => ["--schema", schema]),
    "--dbname", target, backup,
  ]);

  // 4. Every table has the same number of rows on both sides.
  const after = countRows(psql, target);
  if (before) {
    const differences = [...new Set([...before.keys(), ...after.keys()])]
      .filter((table) => before.get(table) !== after.get(table))
      .map((table) => `  ${table}: ${before.get(table) ?? "missing"} before, ${after.get(table) ?? "missing"} now`);
    if (differences.length) stop(`Row counts differ:\n${differences.join("\n")}`);
    console.log(`\n✔ ${after.size} tables, ${[...after.values()].reduce((sum, n) => sum + n, 0)} rows: every table matches.`);
  } else {
    console.log(`\n✔ Restored ${after.size} tables, ${[...after.values()].reduce((sum, n) => sum + n, 0)} rows from ${backup}.`);
  }
  console.log(`\nNext: in .env.local, set DATABASE_URL to the new database (the value of NEW_DATABASE_URL),
set the same DATABASE_URL on the hosting site, and deploy again. Keep ${backup}.`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("move-database.mjs")) {
  await main();
  process.exit(0);
}
