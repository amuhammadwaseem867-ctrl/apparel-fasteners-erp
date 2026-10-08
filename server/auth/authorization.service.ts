import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";

export async function getUserPermissionCodes(
  userId: string,
): Promise<string[]> {
  const userRoles = await db.orm.public.UserRole
    .where({ userId })
    .select("roleId")
    .all();

  if (!userRoles.length) {
    return [];
  }

  const roleIds = [...new Set(userRoles.map((userRole) => userRole.roleId))];

  const permissionRows = await db.orm.public.RolePermission
    .where((row) => row.roleId.in(roleIds))
    .select("permissionId")
    .all();

  const permissionIds = [
    ...new Set(permissionRows.map((permissionRow) => permissionRow.permissionId)),
  ];

  if (!permissionIds.length) {
    return [];
  }

  const permissions = await db.orm.public.Permission
    .where((row) => row.id.in(permissionIds))
    .select("code")
    .all();

  return [...new Set(permissions.map((permission) => permission.code))];
}

export async function getUserRoleCodes(
  userId: string,
): Promise<string[]> {
  const userRoles = await db.orm.public.UserRole
    .where({ userId })
    .select("roleId")
    .all();

  if (!userRoles.length) {
    return [];
  }

  const roleIds = [...new Set(userRoles.map((userRole) => userRole.roleId))];

  const roles = await db.orm.public.Role
    .where((row) => row.id.in(roleIds))
    .select("code")
    .all();

  return [...new Set(roles.map((role) => role.code))];
}

export async function resolveUserAccess(userId: string) {
  const user = await db.orm.public.User
    .where({ id: userId })
    .first();

  if (!user) {
    throw new AppError("User not found.", {
      code: "USER_NOT_FOUND",
      status: 404,
    });
  }

  const [roles, permissions] = await Promise.all([
    getUserRoleCodes(userId),
    getUserPermissionCodes(userId),
  ]);

  return {
    id: user.id,
    employeeCode: user.employeeCode,
    name: user.name,
    email: user.email,
    phone: user.phone,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    roles,
    permissions,
  };
}

export async function hasPermission(
  userId: string,
  permissionCode: string,
): Promise<boolean> {
  const permissions = await getUserPermissionCodes(userId);

  return permissions.includes(permissionCode);
}

export async function hasAnyPermission(
  userId: string,
  permissionCodes: string[],
): Promise<boolean> {
  if (!permissionCodes.length) {
    return false;
  }

  const permissions = await getUserPermissionCodes(userId);

  return permissionCodes.some((code) => permissions.includes(code));
}

export async function hasAllPermissions(
  userId: string,
  permissionCodes: string[],
): Promise<boolean> {
  if (!permissionCodes.length) {
    return true;
  }

  const permissions = await getUserPermissionCodes(userId);

  return permissionCodes.every((code) => permissions.includes(code));
}

export async function hasRole(
  userId: string,
  roleCode: string,
): Promise<boolean> {
  const roles = await getUserRoleCodes(userId);

  return roles.includes(roleCode);
}

export async function requirePermission(
  userId: string,
  permissionCode: string,
): Promise<void> {
  const allowed = await hasPermission(userId, permissionCode);

  if (!allowed) {
    throw new AppError("Forbidden.", {
      code: "FORBIDDEN",
      status: 403,
      details: {
        requiredPermission: permissionCode,
      },
    });
  }
}

export async function requireRole(
  userId: string,
  roleCode: string,
): Promise<void> {
  const allowed = await hasRole(userId, roleCode);

  if (!allowed) {
    throw new AppError("Forbidden.", {
      code: "FORBIDDEN",
      status: 403,
      details: {
        requiredRole: roleCode,
      },
    });
  }
}