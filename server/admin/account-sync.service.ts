/*
 * Owner-run account reset (scripts/set-user-accounts.mjs): makes the listed
 * accounts exist with exactly the given password and role, and with
 * `disableOthers` removes every other account's password and disables it.
 * Nothing is deleted (audit history keeps its actors). One transaction under
 * the access-control lock; it refuses to finish with no active user who can
 * manage users. Passwords are only ever stored as scrypt hashes and never logged.
 */

import { randomBytes } from "node:crypto";

import { recordAuditEvent } from "../auth/audit.service";
import { hashPassword } from "../auth/password.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import type { Tx } from "../inventory/inventory.service";

export type AccountSpec = { employeeCode: string; name: string; email: string; password: string; role: string };
export type AccountPlanEntry = { email: string; employeeCode: string; action: "CREATE" | "RESET" | "DISABLE"; role?: string; id?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function rows<T>(runner: Tx, plan: unknown) {
  return (await runner.query(plan as never)) as unknown as T[];
}

/* Rows like ["AF-EMP-001","Name","a@b.com","password","ROLE"] from JSON, JS or an RTF copy of either. */
export function parseAccountList(text: string): AccountSpec[] {
  const pattern = /\[\s*"([^"]*)"\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"\s*\]/g;
  return [...text.matchAll(pattern)].map(([, employeeCode, name, email, password, role]) => ({
    employeeCode: employeeCode.trim(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password,
    role: role.trim().toUpperCase(),
  }));
}

export function validateAccountList(accounts: AccountSpec[]) {
  const problems: string[] = [];
  if (accounts.length === 0) problems.push("No accounts were found in the file.");
  const seen = new Set<string>();
  for (const [index, account] of accounts.entries()) {
    const where = `Row ${index + 1} (${account.email || "no email"})`;
    if (account.employeeCode.length < 2) problems.push(`${where}: employee code is required.`);
    if (account.name.length < 2) problems.push(`${where}: name is required.`);
    if (!EMAIL.test(account.email)) problems.push(`${where}: email is not valid.`);
    if (account.password.length < 8) problems.push(`${where}: password must be at least 8 characters.`);
    if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(account.role)) problems.push(`${where}: role "${account.role}" is not a role code.`);
    for (const key of [`e:${account.email}`, `c:${account.employeeCode.toLowerCase()}`]) {
      if (seen.has(key)) problems.push(`${where}: ${key.startsWith("e:") ? "email" : "employee code"} appears twice.`);
      seen.add(key);
    }
  }
  if (problems.length) throw new AppError(problems.join("\n"), { code: "ACCOUNT_LIST_INVALID", status: 400 });
}

async function buildPlan(tx: Tx, accounts: AccountSpec[], disableOthers: boolean) {
  const users = await tx.orm.public.User.all();
  const roles = await tx.orm.public.Role.all();
  const plan: AccountPlanEntry[] = [];
  const kept = new Set<string>();

  for (const account of accounts) {
    const role = roles.find((candidate) => candidate.code === account.role);
    if (!role) throw new AppError(`Role ${account.role} does not exist. Run npm run db:seed-access first.`, { code: "INVALID_ROLE", status: 400 });
    if (role.status !== "ACTIVE") throw new AppError(`Role ${account.role} is disabled.`, { code: "ROLE_DISABLED", status: 409 });

    const byEmail = users.find((user) => user.email.toLowerCase() === account.email);
    const byCode = users.find((user) => user.employeeCode.toLowerCase() === account.employeeCode.toLowerCase());
    if (byEmail && byCode && byEmail.id !== byCode.id) {
      throw new AppError(
        `${account.email} belongs to employee ${byEmail.employeeCode}, but ${account.employeeCode} is already used by ${byCode.email}.`,
        { code: "ACCOUNT_CONFLICT", status: 409 },
      );
    }
    const existing = byEmail ?? byCode;
    if (existing) kept.add(existing.id);
    plan.push({ email: account.email, employeeCode: account.employeeCode, action: existing ? "RESET" : "CREATE", role: account.role, id: existing?.id });
  }

  if (disableOthers) {
    for (const user of users) {
      if (!kept.has(user.id)) plan.push({ email: user.email, employeeCode: user.employeeCode, action: "DISABLE", id: user.id });
    }
  }
  return { plan, roles };
}

/* Read-only preview of what syncUserAccounts would do. */
export async function planUserAccounts(accounts: AccountSpec[], { disableOthers = false } = {}) {
  validateAccountList(accounts);
  return db.transaction(async (tx) => (await buildPlan(tx, accounts, disableOthers)).plan);
}

export async function syncUserAccounts(accounts: AccountSpec[], { disableOthers = false } = {}) {
  validateAccountList(accounts);
  return db.transaction(async (tx) => {
    await rows(tx, db.raw.sql`select pg_advisory_xact_lock(hashtext('erp-access-control'))::text as locked`
      .returnsRow({ locked: "pg/text@1" }).build());
    const { plan, roles } = await buildPlan(tx, accounts, disableOthers);
    const now = new Date().toISOString();

    for (const entry of plan) {
      const account = accounts.find((candidate) => candidate.email === entry.email);
      let userId = entry.id;

      if (entry.action === "CREATE" && account) {
        const created = await tx.orm.public.User.create({
          employeeCode: account.employeeCode,
          name: account.name,
          email: account.email,
          passwordHash: hashPassword(account.password),
          status: "ACTIVE",
        });
        userId = created.id;
        entry.id = created.id;
      } else if (entry.action === "RESET" && account && userId) {
        await tx.orm.public.User.where({ id: userId }).update({
          name: account.name,
          email: account.email,
          employeeCode: account.employeeCode,
          passwordHash: hashPassword(account.password),
          status: "ACTIVE",
          updatedAt: now,
        });
      } else if (entry.action === "DISABLE" && userId) {
        // A random secret nobody knows: the old password stops working for good.
        await tx.orm.public.User.where({ id: userId }).update({
          passwordHash: hashPassword(randomBytes(32).toString("base64url")),
          status: "DISABLED",
          updatedAt: now,
        });
      }

      if (!userId) continue;
      if (account) {
        const roleId = roles.find((role) => role.code === account.role)!.id;
        await tx.orm.public.UserRole.where({ userId }).deleteAll();
        await tx.orm.public.UserRole.create({ userId, roleId });
      }
      await rows(tx, db.raw.sql`
        update erp_user_sessions set "revokedAt" = now()
        where "userId" = ${userId}::uuid and "revokedAt" is null
        returning id::text as id
      `.returnsRow({ id: "pg/text@1" }).build());
      await recordAuditEvent({
        actorId: null,
        action: entry.action === "CREATE" ? "USER_CREATED" : entry.action === "RESET" ? "USER_PASSWORD_RESET" : "USER_DISABLED",
        entityType: "User",
        entityId: userId,
        metadata: { email: entry.email, source: "set-user-accounts", ...(entry.role ? { role: entry.role } : {}) },
      }, tx);
    }

    const [admins] = await rows<{ count: string }>(tx, db.raw.sql`
      select count(distinct u.id)::text as count
      from erp_users u
      join erp_user_roles ur on ur."userId" = u.id
      join erp_roles r on r.id = ur."roleId" and r.status = 'ACTIVE'
      join erp_role_permissions rp on rp."roleId" = r.id
      join erp_permissions p on p.id = rp."permissionId" and p.code = 'users:update'
      where u.status = 'ACTIVE'
    `.returnsRow({ count: "pg/text@1" }).build());
    if (Number(admins.count) === 0) {
      throw new AppError("This would leave no active user who can manage users; nothing was changed.", { code: "ADMIN_LOCKOUT", status: 409 });
    }
    return plan;
  });
}
