import assert from "node:assert/strict";
import test from "node:test";

import { createLoginRateLimiter } from "../../server/auth/login-rate-limit.ts";

function limiter(overrides = {}) {
  let clock = 0;
  const instance = createLoginRateLimiter({
    windowMs: 1000,
    maxFailuresPerEmail: 3,
    maxFailuresPerIp: 5,
    maxEntries: 100,
    now: () => clock,
    ...overrides,
  });

  return { instance, advance: (ms) => { clock += ms; } };
}

test("an account locks after the configured failures and unlocks after the window", () => {
  const { instance, advance } = limiter();

  assert.equal(instance.registerFailure("a@x.test", null), false);
  assert.equal(instance.registerFailure("a@x.test", null), false);
  assert.equal(instance.isLimited("a@x.test", null), false);
  assert.equal(instance.registerFailure("a@x.test", null), true);
  assert.equal(instance.isLimited("a@x.test", null), true);
  assert.equal(instance.isLimited("b@x.test", null), false);

  advance(1000);
  assert.equal(instance.isLimited("a@x.test", null), false);
});

test("one IP trying many accounts is limited even though no single account is", () => {
  const { instance } = limiter();

  for (let index = 0; index < 5; index += 1) {
    instance.registerFailure(`user${index}@x.test`, "203.0.113.9");
  }

  assert.equal(instance.isLimited("fresh@x.test", "203.0.113.9"), true);
  assert.equal(instance.isLimited("fresh@x.test", "198.51.100.1"), false);
});

test("a successful login clears the account counter but not the IP counter", () => {
  const { instance } = limiter();

  for (let index = 0; index < 4; index += 1) {
    instance.registerFailure(`user${index}@x.test`, "203.0.113.9");
  }
  instance.registerFailure("owner@x.test", "203.0.113.9");
  instance.registerSuccess("owner@x.test");

  assert.equal(instance.isLimited("owner@x.test", null), false);
  assert.equal(instance.isLimited("other@x.test", "203.0.113.9"), true);
});

test("the store stays bounded when flooded with distinct emails", () => {
  const { instance } = limiter({ maxEntries: 50 });

  for (let index = 0; index < 1000; index += 1) {
    instance.registerFailure(`spray${index}@x.test`, null);
  }

  assert.ok(instance.size() <= 50, `size ${instance.size()} exceeds bound`);
});
