import assert from "node:assert/strict";
import test from "node:test";

import { db } from "../../server/core/database/client.ts";
import { createUser, loginUser, logoutUser } from "../../server/auth/auth.service.ts";
import {
  hasPermission,
  hasRole,
  requirePermission,
  requireRole,
} from "../../server/auth/authorization.service.ts";
import { hashPassword, verifyPassword } from "../../server/auth/password.service.ts";
import { seedSystemAccessControl } from "../../server/auth/seed.ts";
import {
  createSessionForUser,
  createSessionToken,
  hashSessionToken,
  revokeSessionToken,
  validateSessionToken,
} from "../../server/auth/session.service.ts";

test("password hashing works and verification is secure", async () => {
  const password = "TestPassword123!";
  const hash = hashPassword(password);
  assert.notEqual(hash, password);
  assert.equal(hash.includes("scrypt:"), true);
  assert.equal(verifyPassword(password, hash), true);
  assert.equal(verifyPassword("WrongPassword123!", hash), false);
});

test("valid login succeeds, invalid login fails, and disabled users are blocked", async () => {
  await seedSystemAccessControl();
  const email = `auth-success-${Date.now()}@example.com`;
  const password = "StrongPassword123!";

  const user = await createUser({
    employeeCode: `AUTH-${Date.now()}`,
    name: "Auth Success User",
    email,
    password,
    roles: ["ADMIN"],
  });

  const result = await loginUser({ email, password });
  assert.equal(result.user.id, user.id);
  assert.equal("passwordHash" in result.user, false);

  await assert.rejects(
    () => loginUser({ email, password: "WrongPassword123!" }),
    (error) => {
      assert.equal(error.code, "AUTH_INVALID");
      return true;
    },
  );

  await db.user.update({
    where: { id: user.id },
    data: { status: "DISABLED" },
  });

  await assert.rejects(
    async () => loginUser({ email, password }),
    (error) => {
      assert.equal(error.code, "AUTH_INVALID");
      return true;
    },
  );
});

test("session creation, validation, expiration, revocation, and logout all work", async () => {
  await seedSystemAccessControl();
  const email = `auth-session-${Date.now()}@example.com`;
  const password = "SessionPassword123!";

  const user = await createUser({
    employeeCode: `SESSION-${Date.now()}`,
    name: "Session User",
    email,
    password,
    roles: ["ADMIN"],
  });

  const freshToken = createSessionToken();
  const freshSession = await createSessionForUser(user.id, freshToken);
  const freshValidation = await validateSessionToken(freshToken);
  assert.ok(freshValidation);
  assert.equal(freshValidation.user.id, user.id);
  assert.equal(freshSession.id, freshValidation.session.id);

  const expiredToken = createSessionToken();
  await db.userSession.create({
    data: {
      userId: user.id,
      tokenHash: hashSessionToken(expiredToken),
      expiresAt: new Date(Date.now() - 60000).toISOString(),
      lastUsedAt: new Date().toISOString(),
    },
  });
  assert.equal(await validateSessionToken(expiredToken), null);

  const revokedToken = createSessionToken();
  await createSessionForUser(user.id, revokedToken);
  await revokeSessionToken(revokedToken);
  assert.equal(await validateSessionToken(revokedToken), null);

  const logoutToken = createSessionToken();
  await createSessionForUser(user.id, logoutToken);
  const loggedOut = await logoutUser(logoutToken, user.id);
  assert.equal(loggedOut, true);
  assert.equal(await validateSessionToken(logoutToken), null);
});

test("RBAC permissions and role checks resolve correctly and reject unauthorized access", async () => {
  await seedSystemAccessControl();

  const adminUser = await createUser({
    employeeCode: `RBAC-ADMIN-${Date.now()}`,
    name: "RBAC Admin",
    email: `rbac-admin-${Date.now()}@example.com`,
    password: "AdminPassword123!",
    roles: ["ADMIN"],
  });

  assert.equal(await hasPermission(adminUser.id, "inventory:adjust"), true);
  assert.equal(await hasRole(adminUser.id, "ADMIN"), true);
  await requirePermission(adminUser.id, "inventory:adjust");
  await requireRole(adminUser.id, "ADMIN");

  const viewerUser = await createUser({
    employeeCode: `RBAC-VIEW-${Date.now()}`,
    name: "RBAC Viewer",
    email: `rbac-viewer-${Date.now()}@example.com`,
    password: "ViewerPassword123!",
    roles: ["REPORT_VIEWER"],
  });

  assert.equal(await hasPermission(viewerUser.id, "inventory:adjust"), false);
  await assert.rejects(() => requirePermission(viewerUser.id, "inventory:adjust"), (error) => {
    assert.equal(error.code, "FORBIDDEN");
    return true;
  });
});
