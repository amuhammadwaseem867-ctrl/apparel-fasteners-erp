import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { createDatabaseLoginRateLimiter } from "../../server/auth/login-rate-limit.db.ts";
import { db } from "../../server/core/database/client.ts";

const options = { windowMs: 2000, maxFailuresPerEmail: 3, maxFailuresPerIp: 5 };
const email = () => `rl-${randomUUID()}@test.local`;

test("counters are shared between server instances", async () => {
  const serverA = createDatabaseLoginRateLimiter(options);
  const serverB = createDatabaseLoginRateLimiter(options);
  const address = email();

  assert.equal(await serverA.registerFailure(address, null), false);
  assert.equal(await serverB.registerFailure(address, null), false);
  assert.equal(await serverA.isLimited(address, null), false);
  assert.equal(await serverB.registerFailure(address, null), true, "the third failure on any instance locks");
  assert.equal(await serverA.isLimited(address, null), true);
});

test("concurrent failures are all counted", async () => {
  const limiter = createDatabaseLoginRateLimiter({ ...options, maxFailuresPerEmail: 50 });
  const address = email();
  await Promise.all(Array.from({ length: 20 }, () => limiter.registerFailure(address, null)));
  const rows = await db.orm.public.LoginAttemptCounter.all();
  assert.ok(rows.some((row) => row.count === 20), "exactly 20 failures recorded for the key");
});

test("one IP across many accounts is limited; success clears only the account", async () => {
  const limiter = createDatabaseLoginRateLimiter(options);
  const ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}-${randomUUID().slice(0, 8)}`;
  for (let index = 0; index < 5; index += 1) await limiter.registerFailure(email(), ip);
  assert.equal(await limiter.isLimited(email(), ip), true);
  assert.equal(await limiter.isLimited(email(), null), false);

  const address = email();
  await limiter.registerFailure(address, null);
  await limiter.registerFailure(address, null);
  await limiter.registerSuccess(address);
  assert.equal(await limiter.registerFailure(address, null), false, "the account counter restarted");
  assert.equal(await limiter.isLimited(email(), ip), true, "the IP counter did not reset");
});

test("limits expire after the window, and raw emails and IPs are not stored", async () => {
  const limiter = createDatabaseLoginRateLimiter(options);
  const address = email();
  for (let index = 0; index < 3; index += 1) await limiter.registerFailure(address, "203.0.113.77");
  assert.equal(await limiter.isLimited(address, null), true);

  await new Promise((resolve) => setTimeout(resolve, 2100));
  assert.equal(await limiter.isLimited(address, null), false);
  assert.equal(await limiter.registerFailure(address, null), false, "a new window starts at one");

  const keys = (await db.orm.public.LoginAttemptCounter.all()).map((row) => row.key);
  assert.ok(keys.every((key) => /^[0-9a-f]{64}$/.test(key)));
  assert.ok(!keys.some((key) => key.includes("@") || key.includes("203.0.113.77")));
});
