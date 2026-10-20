/*
 * Shared by the database scripts (go-live, clear-transactions): run a
 * PostgreSQL tool without a shell, find pg_dump / pg_restore / psql, and
 * take a backup that is proved readable before anything is changed.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export function stop(message) {
  console.error(`\n✖ ${message}\nNothing after this step was run.`);
  process.exit(1);
}

export function run(label, command, args, { capture = false, quiet = false } = {}) {
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
export function pgTool(name) {
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

/* pg_dump to backups/<database>-<time>.dump (or use one given), then prove it reads back. */
export function backupDatabase(url, database, given) {
  let backup = given;
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
  return backup;
}
