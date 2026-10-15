import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  createRole,
  createUserAccount,
  listAuditLogs,
  listRoles,
  resetUserPassword,
  setRoleStatus,
  setUserStatus,
  updateRole,
  updateUserAccount,
} from "../../server/admin/admin.service.ts";
import { auditQuerySchema, roleInputSchema, userCreateSchema } from "../../server/admin/admin.validation.ts";
import { loginUser } from "../../server/auth/auth.service.ts";
import { resolveUserAccess } from "../../server/auth/authorization.service.ts";
import { seedSystemAccessControl } from "../../server/auth/seed.ts";
import { validateSessionToken } from "../../server/auth/session.service.ts";
import { db } from "../../server/core/database/client.ts";

const run = `A${Date.now().toString(36).toUpperCase()}`;
const password = "AdminTest#2026pw";
const ctx = {};

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`);
    return true;
  });
}

const account = (tag, roles) => createUserAccount(userCreateSchema.parse({
  employeeCode: `${tag}-${run}`, name: `${tag} ${run}`, email: `${tag.toLowerCase()}-${run.toLowerCase()}@test.local`, password, roles,
}), ctx.root);

test.before(async () => {
  await seedSystemAccessControl();
  ctx.root = randomUUID();
  ctx.admin = await account("ADM", ["ADMIN"]);
  ctx.root = ctx.admin.id;
});

test("accounts are created with valid, active roles only", async () => {
  ctx.clerk = await account("CLK", []);
  await expectCode(account("CLK", []), "USER_EXISTS");
  await expectCode(account("BAD", ["NO_SUCH_ROLE"]), "INVALID_ROLE");

  ctx.role = await createRole(roleInputSchema.parse({
    code: `QC_VIEW_${run}`.slice(0, 40), name: `QC viewer ${run}`, description: "Can view quality records", permissions: ["quality:view", "dashboard:view"],
  }), ctx.admin.id);
  assert.deepEqual(ctx.role.permissions, ["dashboard:view", "quality:view"]);
  await expectCode(createRole(roleInputSchema.parse({ code: ctx.role.code, name: "dup", description: "dup role" }), ctx.admin.id), "ROLE_EXISTS");
  await expectCode(createRole(roleInputSchema.parse({ code: `X_${run}`.slice(0, 40), name: `x ${run}`, description: "bad", permissions: ["nope:nope"] }), ctx.admin.id), "INVALID_PERMISSION");
});

test("roles change permissions; disabled roles grant nothing and cannot be assigned", async () => {
  const viewer = await account("VWR", [ctx.role.code]);
  assert.ok((await resolveUserAccess(viewer.id)).permissions.includes("quality:view"));

  await updateRole(ctx.role.id, { name: ctx.role.name, description: "Quality and dispatch viewer", permissions: ["quality:view", "dispatch:view"] }, ctx.admin.id);
  assert.ok((await resolveUserAccess(viewer.id)).permissions.includes("dispatch:view"));

  await setRoleStatus(ctx.role.id, "DISABLED", ctx.admin.id);
  const access = await resolveUserAccess(viewer.id);
  assert.deepEqual([access.permissions, access.roles], [[], []]);
  await expectCode(updateUserAccount(viewer.id, { name: viewer.name, roles: [ctx.role.code] }, ctx.admin.id), "ROLE_DISABLED");
  await setRoleStatus(ctx.role.id, "ACTIVE", ctx.admin.id);

  const system = (await listRoles()).find((role) => role.code === "ADMIN");
  assert.equal(system.isSystem, true);
  await expectCode(updateRole(system.id, { name: system.name, description: system.description, permissions: [] }, ctx.admin.id), "ROLE_SYSTEM_LOCKED");
  await expectCode(setRoleStatus(system.id, "DISABLED", ctx.admin.id), "ROLE_SYSTEM_LOCKED");
});

test("disabling a user or resetting a password ends that user's sessions", async () => {
  const user = await account("SES", [ctx.role.code]);
  const first = await loginUser({ email: user.email, password });
  assert.ok(await validateSessionToken(first.token));

  await resetUserPassword(user.id, "NewSecret#2026pw", ctx.admin.id);
  assert.equal(await validateSessionToken(first.token), null);
  await expectCode(loginUser({ email: user.email, password }), "AUTH_INVALID");
  const second = await loginUser({ email: user.email, password: "NewSecret#2026pw" });

  await expectCode(setUserStatus(ctx.admin.id, "DISABLED", ctx.admin.id), "SELF_DISABLE");
  await setUserStatus(user.id, "DISABLED", ctx.admin.id);
  assert.equal(await validateSessionToken(second.token), null);
  await expectCode(setUserStatus(user.id, "DISABLED", ctx.admin.id), "USER_STATUS_CONFLICT");
  await setUserStatus(user.id, "ACTIVE", ctx.admin.id);
});

test("the last active administrator cannot be removed, even by concurrent changes", async () => {
  const other = await account("AD2", ["ADMIN"]);
  // Leave exactly two administrators (ctx.admin, other); restore everyone afterwards.
  const parked = (await db.runtime().query(db.raw.sql`
    update erp_users set status = 'DISABLED'
    where status = 'ACTIVE' and id <> ${ctx.admin.id}::uuid and id <> ${other.id}::uuid
    returning id::text as id
  `.returnsRow({ id: "pg/text@1" }).build()));
  try {
    const outcomes = await Promise.allSettled([
      setUserStatus(other.id, "DISABLED", ctx.admin.id),
      updateUserAccount(ctx.admin.id, { name: ctx.admin.name, roles: [] }, other.id),
    ]);
    assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1, "one change wins");
    assert.equal(outcomes.find((outcome) => outcome.status === "rejected").reason.code, "ADMIN_LOCKOUT");

    const remaining = outcomes[0].status === "fulfilled" ? ctx.admin : other;
    const actor = remaining.id === ctx.admin.id ? other.id : ctx.admin.id;
    await expectCode(updateUserAccount(remaining.id, { name: remaining.name, roles: [ctx.role.code] }, actor), "ADMIN_LOCKOUT");
  } finally {
    for (const row of parked) {
      await db.orm.public.User.where({ id: row.id }).update({ status: "ACTIVE" });
    }
    await updateUserAccount(ctx.admin.id, { name: ctx.admin.name, roles: ["ADMIN"] }, other.id).catch(() => {});
    await db.orm.public.User.where({ id: other.id }).update({ status: "ACTIVE" });
  }
});

test("administration changes are audited and searchable", async () => {
  const log = await listAuditLogs(auditQuerySchema.parse({ entityId: ctx.role.id }));
  const actions = log.entries.map((entry) => entry.action);
  assert.ok(actions.includes("ROLE_CREATED") && actions.includes("ROLE_UPDATED") && actions.includes("ROLE_DISABLED"));
  assert.equal(log.entries[0].actorName, ctx.admin.name);
});
