/*
 * Sets the ERP login accounts from a file you keep on your own computer
 * (never commit it). Each row: ["EMP-CODE","Name","email","password","ROLE"],
 * as JSON, JavaScript or an RTF copy of either.
 *   npm run db:set-accounts -- --file=<path>                      preview only
 *   npm run db:set-accounts -- --file=<path> --disable-others     preview, incl. accounts to disable
 *   ... --confirm=APPLY                                           make the changes
 * Listed accounts are created, or get the new password and exactly that role.
 * With --disable-others every other account's password is removed and it is
 * disabled (nothing is deleted). All sessions of changed accounts end.
 * Passwords are never printed.
 */

import { existsSync, readFileSync } from "node:fs";

import "./load-env.mjs";
import "../tests/support/register.mjs";

const option = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const flag = (name) => process.argv.includes(`--${name}`);

function stop(message) {
  console.error(`\n✖ ${message}\nNothing was changed.`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) stop("DATABASE_URL is not set. Put it in .env.local (or .env).");
const file = option("file");
if (!file) stop("Pass the file with the accounts: npm run db:set-accounts -- --file=<path>");
if (!existsSync(file)) stop(`File ${file} was not found.`);

const parsed = new URL(process.env.DATABASE_URL);
console.log(`Target database: ${parsed.pathname.replace(/^\//, "")} on ${parsed.hostname}`);

const { parseAccountList, planUserAccounts, syncUserAccounts } = await import("../server/admin/account-sync.service.ts");
const raw = readFileSync(file);
// Windows editors may save UTF-16; RTF is plain bytes.
const text = raw[0] === 0xff && raw[1] === 0xfe ? raw.toString("utf16le") : raw.toString("utf8").replace(/\0/g, "");
const accounts = parseAccountList(text);
const disableOthers = flag("disable-others");

const show = (plan) => {
  for (const entry of plan) {
    const label = { CREATE: "create      ", RESET: "set password", DISABLE: "remove password and disable" }[entry.action];
    console.log(`  ${label}  ${entry.email} (${entry.employeeCode})${entry.role ? ` → ${entry.role}` : ""}`);
  }
};

try {
  const plan = await planUserAccounts(accounts, { disableOthers });
  console.log(`\n${accounts.length} accounts in ${file}. Plan:`);
  show(plan);
  if (option("confirm") !== "APPLY") {
    console.log(`\nPreview only. To make these changes, run the same command with --confirm=APPLY at the end.`);
    process.exit(0);
  }
  await syncUserAccounts(accounts, { disableOthers });
  console.log("\n✔ Done. Changed accounts were signed out; sign in with the new passwords.");
  process.exit(0);
} catch (error) {
  stop(error?.message ?? String(error));
}
