/*
 * Creates or updates the built-in permissions and roles (idempotent).
 * Run against the database in DATABASE_URL:
 *   npm run db:seed-access   (DATABASE_URL from .env.local or .env)
 * Never creates users and never removes anything.
 */

import "./load-env.mjs";
import "../tests/support/register.mjs";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const { seedSystemAccessControl } = await import("../server/auth/seed.ts");
await seedSystemAccessControl();
console.log("Permissions and roles are up to date.");
process.exit(0);
