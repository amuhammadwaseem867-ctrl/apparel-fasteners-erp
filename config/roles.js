/**
 * Apparel Fastener ERP — Roles & Permissions configuration.
 * Backend-ready: consumed by lib/permissions and admin UI.
 */

export const PERMISSIONS = [
  // Orders
  { id: "orders:view", group: "Orders", label: "View orders" },
  { id: "orders:create", group: "Orders", label: "Create orders" },
  { id: "orders:update", group: "Orders", label: "Update orders" },

  // Production
  { id: "production:view", group: "Production", label: "View production" },
  { id: "production:update", group: "Production", label: "Update production" },
  { id: "production:complete", group: "Production", label: "Complete production stages" },

  // Inventory
  { id: "inventory:view", group: "Inventory", label: "View inventory" },
  { id: "inventory:issue", group: "Inventory", label: "Issue material to production" },
  { id: "inventory:transfer", group: "Inventory", label: "Transfer stock" },
  { id: "inventory:adjust", group: "Inventory", label: "Adjust stock" },

  // Quality
  { id: "quality:view", group: "Quality", label: "View quality" },
  { id: "quality:inspect", group: "Quality", label: "Perform inspections" },
  { id: "quality:approve", group: "Quality", label: "Approve / reject" },
  { id: "quality:ncr", group: "Quality", label: "Raise NCR / CAPA" },

  // Packing
  { id: "packing:view", group: "Packing", label: "View packing" },
  { id: "packing:create", group: "Packing", label: "Create packing orders" },
  { id: "packing:complete", group: "Packing", label: "Complete packing" },

  // Dispatch
  { id: "dispatch:view", group: "Dispatch", label: "View dispatch" },
  { id: "dispatch:create", group: "Dispatch", label: "Create dispatch / shipments" },
  { id: "dispatch:complete", group: "Dispatch", label: "Complete delivery" },
];

export const ROLES = [
  {
    id: "admin",
    label: "Admin",
    permissions: PERMISSIONS.map((p) => p.id),
  },
  {
    id: "management",
    label: "Management",
    permissions: [
      "orders:view", "production:view", "inventory:view",
      "quality:view", "packing:view", "dispatch:view",
    ],
  },
  {
    id: "production",
    label: "Production",
    permissions: [
      "orders:view", "production:view", "production:update", "production:complete",
      "inventory:view", "quality:view",
    ],
  },
  {
    id: "warehouse",
    label: "Warehouse",
    permissions: [
      "inventory:view", "inventory:issue", "inventory:transfer", "inventory:adjust",
      "dispatch:view", "packing:view",
    ],
  },
  {
    id: "qc",
    label: "QC",
    permissions: [
      "quality:view", "quality:inspect", "quality:approve", "quality:ncr",
      "production:view", "orders:view",
    ],
  },
  {
    id: "packing",
    label: "Packing",
    permissions: [
      "packing:view", "packing:create", "packing:complete",
      "orders:view", "inventory:view", "dispatch:view",
    ],
  },
  {
    id: "sales",
    label: "Sales / Order Management",
    permissions: ["orders:view", "orders:create", "orders:update", "inventory:view"],
  },
  {
    id: "hr",
    label: "HR",
    permissions: [],
  },
];

export function roleHasPermission(roleId, permissionId) {
  const role = ROLES.find((r) => r.id === roleId);
  return Boolean(role?.permissions.includes(permissionId));
}
