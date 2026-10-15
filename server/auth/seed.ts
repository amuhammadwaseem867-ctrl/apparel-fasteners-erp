import { db } from "../core/database/client";
import { logger } from "../core/logger/logger";

export const SYSTEM_PERMISSIONS = [
  { code: "dashboard:view", name: "View dashboard", module: "dashboard", action: "view", description: "View dashboard overview." },
  { code: "customers:view", name: "View customers", module: "customers", action: "view", description: "View customer records." },
  { code: "customers:create", name: "Create customers", module: "customers", action: "create", description: "Create customer records." },
  { code: "customers:update", name: "Update customers", module: "customers", action: "update", description: "Update customer records." },
  { code: "customers:delete", name: "Delete customers", module: "customers", action: "delete", description: "Delete customer records." },
  { code: "products:view", name: "View products", module: "products", action: "view", description: "View product catalog." },
  { code: "products:create", name: "Create products", module: "products", action: "create", description: "Create product records." },
  { code: "products:update", name: "Update products", module: "products", action: "update", description: "Update product records." },
  { code: "products:delete", name: "Delete products", module: "products", action: "delete", description: "Delete product records." },
  { code: "inventory:view", name: "View inventory", module: "inventory", action: "view", description: "View inventory records." },
  { code: "inventory:create", name: "Create inventory records", module: "inventory", action: "create", description: "Create inventory records." },
  { code: "inventory:transfer", name: "Transfer inventory", module: "inventory", action: "transfer", description: "Transfer inventory stock." },
  { code: "inventory:adjust", name: "Adjust inventory", module: "inventory", action: "adjust", description: "Adjust inventory stock." },
  { code: "sales:view", name: "View sales", module: "sales", action: "view", description: "View sales information." },
  { code: "sales:create", name: "Create sales", module: "sales", action: "create", description: "Create sales records." },
  { code: "sales:update", name: "Update sales", module: "sales", action: "update", description: "Update sales records." },
  { code: "sales:approve", name: "Approve sales", module: "sales", action: "approve", description: "Approve sales records." },
  { code: "purchasing:view", name: "View purchasing", module: "purchasing", action: "view", description: "View purchasing activity." },
  { code: "purchasing:create", name: "Create purchasing", module: "purchasing", action: "create", description: "Create purchasing records." },
  { code: "purchasing:approve", name: "Approve purchasing", module: "purchasing", action: "approve", description: "Approve purchasing records." },
  { code: "production:view", name: "View production", module: "production", action: "view", description: "View production records." },
  { code: "production:create", name: "Create production", module: "production", action: "create", description: "Create production records." },
  { code: "production:update", name: "Update production", module: "production", action: "update", description: "Update production records." },
  { code: "production:complete", name: "Complete production", module: "production", action: "complete", description: "Complete production jobs." },
  { code: "quality:view", name: "View quality", module: "quality", action: "view", description: "View quality records." },
  { code: "quality:create", name: "Create quality", module: "quality", action: "create", description: "Create quality records." },
  { code: "quality:approve", name: "Approve quality", module: "quality", action: "approve", description: "Approve quality records." },
  { code: "dispatch:view", name: "View dispatch", module: "dispatch", action: "view", description: "View dispatch records." },
  { code: "dispatch:create", name: "Create dispatch", module: "dispatch", action: "create", description: "Create dispatch records." },
  { code: "dispatch:update", name: "Update dispatch", module: "dispatch", action: "update", description: "Update dispatch records." },
  { code: "dispatch:ship", name: "Ship dispatch", module: "dispatch", action: "ship", description: "Ship dispatched orders." },
  { code: "finance:view", name: "View finance", module: "finance", action: "view", description: "View finance records." },
  { code: "finance:create", name: "Create finance", module: "finance", action: "create", description: "Create finance records." },
  { code: "finance:approve", name: "Approve finance", module: "finance", action: "approve", description: "Approve finance records." },
  { code: "reports:view", name: "View reports", module: "reports", action: "view", description: "View reports and analytics." },
  { code: "users:view", name: "View users", module: "users", action: "view", description: "View system users." },
  { code: "users:create", name: "Create users", module: "users", action: "create", description: "Create system users." },
  { code: "users:update", name: "Update users", module: "users", action: "update", description: "Update system users." },
  { code: "users:disable", name: "Disable users", module: "users", action: "disable", description: "Disable user accounts." },
  { code: "roles:view", name: "View roles", module: "roles", action: "view", description: "View system roles." },
  { code: "roles:create", name: "Create roles", module: "roles", action: "create", description: "Create system roles." },
  { code: "roles:update", name: "Update roles", module: "roles", action: "update", description: "Update system roles." },
  { code: "audit:view", name: "View audit logs", module: "audit", action: "view", description: "View audit log entries." },
  { code: "hr:view", name: "View HR", module: "hr", action: "view", description: "View employees, departments and attendance (no pay details)." },
  { code: "hr:manage", name: "Manage HR", module: "hr", action: "manage", description: "Create and update employees and departments; record attendance." },
  { code: "payroll:view", name: "View payroll", module: "payroll", action: "view", description: "View pay rates, advances, payroll runs and payslips." },
  { code: "payroll:process", name: "Process payroll", module: "payroll", action: "process", description: "Set pay rates, issue advances, prepare payroll runs." },
  { code: "payroll:approve", name: "Approve payroll", module: "payroll", action: "approve", description: "Approve payroll runs and mark them paid." },
];

export const SYSTEM_ROLES = [
  { name: "SUPER_ADMIN", code: "SUPER_ADMIN", description: "Top-level system administrator.", permissions: SYSTEM_PERMISSIONS.map((permission) => permission.code) },
  { name: "ADMIN", code: "ADMIN", description: "Administrative user with full operational access.", permissions: SYSTEM_PERMISSIONS.map((permission) => permission.code) },
  { name: "SALES_MANAGER", code: "SALES_MANAGER", description: "Sales leadership role.", permissions: ["dashboard:view", "sales:view", "sales:create", "sales:update", "sales:approve", "customers:view", "customers:create", "customers:update", "products:view", "reports:view"] },
  { name: "SALES_EXECUTIVE", code: "SALES_EXECUTIVE", description: "Sales operations role.", permissions: ["dashboard:view", "sales:view", "sales:create", "sales:update", "customers:view", "customers:create", "products:view", "reports:view"] },
  { name: "PURCHASE_MANAGER", code: "PURCHASE_MANAGER", description: "Purchasing leadership role.", permissions: ["dashboard:view", "purchasing:view", "purchasing:create", "purchasing:approve", "products:view", "reports:view"] },
  { name: "INVENTORY_MANAGER", code: "INVENTORY_MANAGER", description: "Inventory management role.", permissions: ["dashboard:view", "inventory:view", "inventory:create", "inventory:transfer", "inventory:adjust", "products:view", "reports:view"] },
  { name: "PRODUCTION_MANAGER", code: "PRODUCTION_MANAGER", description: "Production management role.", permissions: ["dashboard:view", "production:view", "production:create", "production:update", "production:complete", "inventory:view", "reports:view"] },
  { name: "QUALITY_MANAGER", code: "QUALITY_MANAGER", description: "Quality management role.", permissions: ["dashboard:view", "quality:view", "quality:create", "quality:approve", "production:view", "reports:view"] },
  { name: "DISPATCH_MANAGER", code: "DISPATCH_MANAGER", description: "Dispatch management role.", permissions: ["dashboard:view", "dispatch:view", "dispatch:create", "dispatch:update", "dispatch:ship", "inventory:view", "reports:view"] },
  { name: "FINANCE_MANAGER", code: "FINANCE_MANAGER", description: "Finance management role.", permissions: ["dashboard:view", "finance:view", "finance:create", "finance:approve", "reports:view"] },
  { name: "HR_MANAGER", code: "HR_MANAGER", description: "Employee records and attendance (no pay details).", permissions: ["dashboard:view", "hr:view", "hr:manage", "reports:view"] },
  { name: "PAYROLL_OFFICER", code: "PAYROLL_OFFICER", description: "Prepares payroll; approval is separate.", permissions: ["dashboard:view", "hr:view", "payroll:view", "payroll:process"] },
  { name: "REPORT_VIEWER", code: "REPORT_VIEWER", description: "Read-only analytics role.", permissions: ["dashboard:view", "reports:view"] },
];

export async function seedSystemAccessControl(): Promise<void> {
  for (const permission of SYSTEM_PERMISSIONS) {
    const existingPermission = await db.orm.public.Permission.where({ code: permission.code }).first();

    if (existingPermission) {
      await db.orm.public.Permission.where({ id: existingPermission.id }).update({
        name: permission.name,
        module: permission.module,
        action: permission.action,
        description: permission.description,
      });
    } else {
      await db.orm.public.Permission.create({
        code: permission.code,
        name: permission.name,
        module: permission.module,
        action: permission.action,
        description: permission.description,
      });
    }
  }

  const permissionRows = await db.orm.public.Permission.select("code", "id").all();
  const permissionMap = new Map(permissionRows.map((permission) => [permission.code, permission.id]));

  for (const role of SYSTEM_ROLES) {
    const existingRole = await db.orm.public.Role.where({ code: role.code }).first();

    const createdRole = existingRole
      ? await db.orm.public.Role.where({ id: existingRole.id }).update({
          name: role.name,
          description: role.description,
          status: "ACTIVE",
          isSystem: true,
        })
      : await db.orm.public.Role.create({
          code: role.code,
          name: role.name,
          description: role.description,
          status: "ACTIVE",
          isSystem: true,
        });

    if (!createdRole) {
      throw new Error(`Unable to resolve seeded role: ${role.code}`);
    }

    const permissionIds = role.permissions
      .map((permissionCode) => permissionMap.get(permissionCode))
      .filter((permissionId): permissionId is string => Boolean(permissionId));

    for (const permissionId of permissionIds) {
      const existingLink = await db.orm.public.RolePermission.where({ roleId: createdRole.id, permissionId }).first();
      if (!existingLink) {
        await db.orm.public.RolePermission.create({
          roleId: createdRole.id,
          permissionId,
        });
      }
    }
  }

  logger.info("System RBAC seed initialized.");
}
