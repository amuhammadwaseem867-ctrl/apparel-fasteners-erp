/*
 * Guard for database-writing tests (npm run test:db).
 *
 * Tests that write to PostgreSQL run only against an explicitly isolated
 * database: TEST_DATABASE_URL must point at localhost and name a database
 * ending in "_test". Only then is DATABASE_URL set for the test process.
 * Any other value aborts before a single test module is loaded, so these
 * tests can never write to a shared, staging or production database.
 */

import "./register.mjs";

const raw = process.env.TEST_DATABASE_URL;

function refuse(reason) {
  console.error(`Refusing to run database tests: ${reason}`);
  process.exit(1);
}

if (!raw) {
  refuse("TEST_DATABASE_URL is not set.");
}

let url;

try {
  url = new URL(raw);
} catch {
  refuse("TEST_DATABASE_URL is not a valid URL.");
}

const host = url.hostname;
const database = url.pathname.replace(/^\//, "");

if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  refuse(`host "${host}" is not local.`);
}

if (!/_test$/.test(database)) {
  refuse(`database "${database}" does not end with "_test".`);
}

process.env.DATABASE_URL = raw;
console.log(`Database tests using isolated database "${database}" on ${host}:${url.port || 5432}.`);
