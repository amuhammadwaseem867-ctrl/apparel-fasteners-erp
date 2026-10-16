/*
 * Creates or updates the built-in permissions and roles (idempotent).
 * Run against the database in DATABASE_URL:
 *   node --env-file=.env scripts/seed-access-control.mjs
 * Never creates users and never removes anything.
 */

import "../tests/support/register.mjs";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const { seedSystemAccessControl } = await import("../server/auth/seed.ts");
await seedSystemAccessControl();
console.log("Permissions and roles are up to date.");
process.exit(0);
