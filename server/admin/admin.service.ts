/*
 * User, role and audit administration over the existing RBAC tables (D-024).
 *
 * Every change that can affect who holds which permission runs in a
 * transaction serialised by one advisory lock, and is refused if it would
 * leave no ACTIVE user holding `users:update` through an ACTIVE role (so
 * administrators can never lock everyone out, even concurrently).
 * Disabling a user or resetting a password revokes that user's sessions.
 * System roles (seeded) keep their permissions; custom roles are editable.
 */

import { or } from "@prisma/orm-postgres/orm-client";

import { recordAuditEvent } from "../auth/audit.service";
import { createUser } from "../auth/auth.service";
import { resolveUserAccess } from "../auth/authorization.service";
import { hashPassword } from "../auth/password.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { findSqlQueryError } from "../core/errors/database-errors";
import type { Tx } from "../inventory/inventory.service";
import type { AuditQuery, RoleInput, RoleUpdateInput, UserCreateInput, UserQuery, UserUpdateInput } from "./admin.validation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADMIN_PERMISSION = "users:update";

type Runner = Tx | ReturnType<typeof db.runtime>;

async function rows<T>(runner: Runner, plan: unknown) {
  return (await runner.query(plan as never)) as unknown as T[];
}

function userNotFound(): never {
  throw new AppError("User not found.", { code: "USER_NOT_FOUND", status: 404 });
}

function roleNotFound(): never {
  throw new AppError("Role not found.", { code: "ROLE_NOT_FOUND", status: 404 });
}

/* Serialises access-control changes and rejects any that leave no administrator. */
async function withAccessLock<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await rows(tx, db.raw.sql`select pg_advisory_xact_lock(hashtext('erp-access-control'))::text as locked`
      .returnsRow({ locked: "pg/text@1" }).build());
    const result = await work(tx);
    const [admins] = await rows<{ count: string }>(tx, db.raw.sql`
      select count(distinct u.id)::text as count
      from erp_users u
      join erp_user_roles ur on ur."userId" = u.id
      join erp_roles r on r.id = ur."roleId" and r.status = 'ACTIVE'
      join erp_role_permissions rp on rp."roleId" = r.id
      join erp_permissions p on p.id = rp."permissionId" and p.code = ${ADMIN_PERMISSION}
      where u.status = 'ACTIVE'
    `.returnsRow({ count: "pg/text@1" }).build());
    if (Number(admins.count) === 0) {
      throw new AppError("This change would leave no active user who can manage users. Keep at least one active administrator.", {
        code: "ADMIN_LOCKOUT",
        status: 409,
      });
    }
    return result;
  });
}

async function revokeAllSessions(tx: Tx, userId: string, actorId: string) {
  await rows(tx, db.raw.sql`
    update erp_user_sessions set "revokedAt" = now(), "revokedBy" = ${actorId}::uuid
    where "userId" = ${userId}::uuid and "revokedAt" is null
    returning id::text as id
  `.returnsRow({ id: "pg/text@1" }).build());
}

async function resolveRoleIds(tx: Tx, codes: string[]) {
  const unique = [...new Set(codes)];
  if (!unique.length) return [];
  const roles = await tx.orm.public.Role.where((role) => role.code.in(unique)).all();
  const missing = unique.filter((code) => !roles.some((role) => role.code === code));
  if (missing.length) {
    throw new AppError(`Unknown role: ${missing.join(", ")}.`, { code: "INVALID_ROLE", status: 400 });
  }
  const disabled = roles.filter((role) => role.status !== "ACTIVE");
  if (disabled.length) {
    throw new AppError(`Disabled roles cannot be assigned: ${disabled.map((role) => role.code).join(", ")}.`, { code: "ROLE_DISABLED", status: 409 });
  }
  return roles.map((role) => role.id);
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export async function listUsers(filters: UserQuery) {
  const pattern = `%${filters.search}%`;
  const result = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select u.id::text as id, u."employeeCode", u.name, u.email, coalesce(u.phone, '') as phone, u.status,
      coalesce(u."lastLoginAt"::text, '') as "lastLoginAt",
      coalesce((select string_agg(r.code, ',' order by r.code) from erp_user_roles ur join erp_roles r on r.id = ur."roleId" where ur."userId" = u.id), '') as roles,
      (select count(*) from erp_user_sessions s where s."userId" = u.id and s."revokedAt" is null and s."expiresAt" > now())::text as sessions
    from erp_users u
    where (${filters.status} = '' or u.status = ${filters.status})
      and (${filters.search} = '' or u.name ilike ${pattern} or u.email ilike ${pattern} or u."employeeCode" ilike ${pattern})
      and (${filters.role} = '' or exists (select 1 from erp_user_roles ur join erp_roles r on r.id = ur."roleId" where ur."userId" = u.id and r.code = ${filters.role}))
    order by u.name, u.id
    limit ${filters.pageSize + 1} offset ${(filters.page - 1) * filters.pageSize}
  `.returnsRow({
    id: "pg/text@1", employeeCode: "pg/text@1", name: "pg/text@1", email: "pg/text@1", phone: "pg/text@1", status: "pg/text@1",
    lastLoginAt: "pg/text@1", roles: "pg/text@1", sessions: "pg/text@1",
  }).build());

  return {
    users: result.slice(0, filters.pageSize).map((row) => ({
      ...row,
      lastLoginAt: row.lastLoginAt || null,
      roles: row.roles ? row.roles.split(",") : [],
      activeSessions: Number(row.sessions),
    })),
    page: filters.page,
    pageSize: filters.pageSize,
    hasMore: result.length > filters.pageSize,
  };
}

export async function getUserDetail(id: string) {
  if (!UUID.test(id)) userNotFound();
  const access = await resolveUserAccess(id).catch(() => userNotFound());
  const sessions = await db.orm.public.UserSession
    .where({ userId: id })
    .orderBy((session) => session.createdAt.desc())
    .limit(10)
    .all();
  const roles = await db.orm.public.UserRole.where({ userId: id }).all();
  const roleRows = roles.length ? await db.orm.public.Role.where((role) => role.id.in(roles.map((item) => item.roleId))).all() : [];
  return {
    ...access,
    assignedRoles: roleRows.map((role) => ({ code: role.code, name: role.name, status: role.status })),
    sessions: sessions.map((session) => ({
      id: session.id,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
      ip: session.ip,
      userAgent: session.userAgent,
    })),
  };
}

export async function createUserAccount(input: UserCreateInput, actorId: string) {
  // Validate roles up front for a clear message; createUser re-checks them.
  await withAccessLock(async (tx) => resolveRoleIds(tx, input.roles));
  const user = await createUser({ ...input, phone: input.phone ?? "" }, actorId);
  return getUserDetail(user.id);
}

export async function updateUserAccount(id: string, input: UserUpdateInput, actorId: string) {
  if (!UUID.test(id)) userNotFound();
  await withAccessLock(async (tx) => {
    const user = await tx.orm.public.User.where({ id }).first();
    if (!user) userNotFound();
    const roleIds = await resolveRoleIds(tx, input.roles);
    const before = await tx.orm.public.UserRole.where({ userId: id }).all();

    await tx.orm.public.User.where({ id }).update({ name: input.name, phone: input.phone || null, updatedAt: new Date().toISOString() });
    await tx.orm.public.UserRole.where({ userId: id }).deleteAll();
    for (const roleId of roleIds) {
      await tx.orm.public.UserRole.create({ userId: id, roleId });
    }

    const beforeIds = before.map((row) => row.roleId).sort();
    const changed = beforeIds.join() !== [...roleIds].sort().join();
    await recordAuditEvent({
      actorId,
      action: changed ? "USER_ROLES_CHANGED" : "USER_UPDATED",
      entityType: "User",
      entityId: id,
      metadata: { roles: input.roles },
    }, tx);
  });
  return getUserDetail(id);
}

export async function setUserStatus(id: string, status: "ACTIVE" | "DISABLED", actorId: string) {
  if (!UUID.test(id)) userNotFound();
  if (id === actorId && status === "DISABLED") {
    throw new AppError("You cannot disable your own account.", { code: "SELF_DISABLE", status: 409 });
  }
  await withAccessLock(async (tx) => {
    const user = await tx.orm.public.User.where({ id }).first();
    if (!user) userNotFound();
    if (user.status === status) {
      throw new AppError(`The user is already ${status.toLowerCase()}.`, { code: "USER_STATUS_CONFLICT", status: 409 });
    }
    await tx.orm.public.User.where({ id }).update({ status, updatedAt: new Date().toISOString() });
    if (status === "DISABLED") await revokeAllSessions(tx, id, actorId);
    await recordAuditEvent({
      actorId,
      action: status === "DISABLED" ? "USER_DISABLED" : "USER_ENABLED",
      entityType: "User",
      entityId: id,
      metadata: { email: user.email },
    }, tx);
  });
  return getUserDetail(id);
}

/* An administrator sets a new password; the user's sessions end. */
export async function resetUserPassword(id: string, password: string, actorId: string) {
  if (!UUID.test(id)) userNotFound();
  if (id === actorId) {
    throw new AppError("Change your own password from your profile.", { code: "SELF_RESET", status: 409 });
  }
  await db.transaction(async (tx) => {
    const user = await tx.orm.public.User.where({ id }).first();
    if (!user) userNotFound();
    await tx.orm.public.User.where({ id }).update({ passwordHash: hashPassword(password), updatedAt: new Date().toISOString() });
    await revokeAllSessions(tx, id, actorId);
    await recordAuditEvent({ actorId, action: "USER_PASSWORD_RESET", entityType: "User", entityId: id, metadata: { email: user.email } }, tx);
  });
  return getUserDetail(id);
}

/* ------------------------------------------------------------------ */
/* Roles and permissions                                               */
/* ------------------------------------------------------------------ */

export async function listPermissions() {
  const permissions = await db.orm.public.Permission.orderBy((permission) => permission.code.asc()).all();
  return permissions.map((permission) => ({
    code: permission.code,
    name: permission.name,
    module: permission.module,
    action: permission.action,
    description: permission.description,
  }));
}

type RoleRow = { id: string; code: string; name: string; description: string; status: string; isSystem: string; permissions: string; users: string };

export async function listRoles() {
  const result = await rows<RoleRow>(db.runtime(), db.raw.sql`
    select r.id::text as id, r.code, r.name, r.description, r.status, r."isSystem"::text as "isSystem",
      coalesce((select string_agg(p.code, ',' order by p.code) from erp_role_permissions rp join erp_permissions p on p.id = rp."permissionId" where rp."roleId" = r.id), '') as permissions,
      (select count(*) from erp_user_roles ur join erp_users u on u.id = ur."userId" where ur."roleId" = r.id and u.status = 'ACTIVE')::text as users
    from erp_roles r
    order by r."isSystem" desc, r.name
  `.returnsRow({ id: "pg/text@1", code: "pg/text@1", name: "pg/text@1", description: "pg/text@1", status: "pg/text@1", isSystem: "pg/text@1", permissions: "pg/text@1", users: "pg/text@1" }).build());
  return result.map((row) => ({
    ...row,
    isSystem: row.isSystem === "true",
    permissions: row.permissions ? row.permissions.split(",") : [],
    activeUsers: Number(row.users),
  }));
}

async function setRolePermissions(tx: Tx, roleId: string, codes: string[]) {
  const unique = [...new Set(codes)];
  const permissions = unique.length ? await tx.orm.public.Permission.where((permission) => permission.code.in(unique)).all() : [];
  const missing = unique.filter((code) => !permissions.some((permission) => permission.code === code));
  if (missing.length) {
    throw new AppError(`Unknown permission: ${missing.join(", ")}.`, { code: "INVALID_PERMISSION", status: 400 });
  }
  await tx.orm.public.RolePermission.where({ roleId }).deleteAll();
  for (const permission of permissions) {
    await tx.orm.public.RolePermission.create({ roleId, permissionId: permission.id });
  }
}

export async function createRole(input: RoleInput, actorId: string) {
  try {
    const id = await withAccessLock(async (tx) => {
      const role = await tx.orm.public.Role.create({ code: input.code, name: input.name, description: input.description, status: "ACTIVE", isSystem: false });
      await setRolePermissions(tx, role.id, input.permissions);
      await recordAuditEvent({ actorId, action: "ROLE_CREATED", entityType: "Role", entityId: role.id, metadata: { code: input.code, permissions: input.permissions } }, tx);
      return role.id;
    });
    return (await listRoles()).find((role) => role.id === id)!;
  } catch (error) {
    const sqlError = findSqlQueryError(error) as { sqlState?: string } | null;
    if (sqlError?.sqlState === "23505") {
      throw new AppError("A role with that code or name already exists.", { code: "ROLE_EXISTS", status: 409 });
    }
    throw error;
  }
}

export async function updateRole(id: string, input: RoleUpdateInput, actorId: string) {
  if (!UUID.test(id)) roleNotFound();
  try {
    await withAccessLock(async (tx) => {
      const role = await tx.orm.public.Role.where({ id }).first();
      if (!role) roleNotFound();
      if (role.isSystem) {
        throw new AppError("System roles are managed by the application and cannot be changed. Create a custom role instead.", { code: "ROLE_SYSTEM_LOCKED", status: 409 });
      }
      await tx.orm.public.Role.where({ id }).update({ name: input.name, description: input.description, updatedAt: new Date().toISOString() });
      await setRolePermissions(tx, id, input.permissions);
      await recordAuditEvent({ actorId, action: "ROLE_UPDATED", entityType: "Role", entityId: id, metadata: { code: role.code, permissions: input.permissions } }, tx);
    });
  } catch (error) {
    const sqlError = findSqlQueryError(error) as { sqlState?: string } | null;
    if (sqlError?.sqlState === "23505") {
      throw new AppError("A role with that name already exists.", { code: "ROLE_EXISTS", status: 409 });
    }
    throw error;
  }
  return (await listRoles()).find((role) => role.id === id)!;
}

export async function setRoleStatus(id: string, status: "ACTIVE" | "DISABLED", actorId: string) {
  if (!UUID.test(id)) roleNotFound();
  await withAccessLock(async (tx) => {
    const role = await tx.orm.public.Role.where({ id }).first();
    if (!role) roleNotFound();
    if (role.isSystem) {
      throw new AppError("System roles cannot be disabled.", { code: "ROLE_SYSTEM_LOCKED", status: 409 });
    }
    await tx.orm.public.Role.where({ id }).update({ status, updatedAt: new Date().toISOString() });
    await recordAuditEvent({ actorId, action: status === "DISABLED" ? "ROLE_DISABLED" : "ROLE_ENABLED", entityType: "Role", entityId: id, metadata: { code: role.code } }, tx);
  });
  return (await listRoles()).find((role) => role.id === id)!;
}

/* ------------------------------------------------------------------ */
/* Audit log                                                           */
/* ------------------------------------------------------------------ */

export async function listAuditLogs(filters: AuditQuery) {
  let query = db.orm.public.AuditLog;
  if (filters.action) query = query.where({ action: filters.action });
  if (filters.entityType) query = query.where({ entityType: filters.entityType });
  if (filters.entityId) query = query.where({ entityId: filters.entityId });
  if (filters.actorId) query = query.where({ actorId: filters.actorId });
  if (filters.dateFrom) query = query.where((row) => row.createdAt.gte(`${filters.dateFrom}T00:00:00Z`));
  if (filters.dateTo) query = query.where((row) => row.createdAt.lt(new Date(Date.parse(`${filters.dateTo}T00:00:00Z`) + 86400000).toISOString()));
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    query = query.where((row) => or(row.action.ilike(pattern), row.entityType.ilike(pattern), row.entityId.ilike(pattern), row.metadata.ilike(pattern)));
  }
  const result = await query
    .orderBy((row) => row.createdAt.desc())
    .offset((filters.page - 1) * filters.pageSize)
    .limit(filters.pageSize + 1)
    .all();
  const page = result.slice(0, filters.pageSize);
  const actorIds = [...new Set(page.map((row) => row.actorId).filter(Boolean) as string[])];
  const actors = actorIds.length ? await db.orm.public.User.where((user) => user.id.in(actorIds)).select("id", "name", "email").all() : [];

  return {
    entries: page.map((row) => {
      let metadata: unknown = null;
      try {
        metadata = row.metadata ? JSON.parse(row.metadata) : null;
      } catch {
        metadata = row.metadata;
      }
      const actor = actors.find((item) => item.id === row.actorId);
      return { ...row, metadata, actorName: actor?.name ?? null, actorEmail: actor?.email ?? null };
    }),
    page: filters.page,
    pageSize: filters.pageSize,
    hasMore: result.length > filters.pageSize,
  };
}

export async function listAuditActions() {
  const result = await rows<{ action: string }>(db.runtime(), db.raw.sql`select distinct action from erp_audit_logs order by action`
    .returnsRow({ action: "pg/text@1" }).build());
  return result.map((row) => row.action);
}
