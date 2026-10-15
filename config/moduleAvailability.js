/*
 * Which ERP areas have no server API or database tables yet.
 *
 * AppShell shows a banner on matching routes so a page that renders but
 * cannot load or save records says so. Routes with a working backend
 * (dashboard, products, BOM, sales orders, customers, inventory, MRP,
 * production, quality inspections, packing, dispatch, invoicing and
 * receivables, procurement and payables, users, roles, audit, gate passes, HR and payroll, reports,
 * profile) are not listed.
 * Inventory pages render their own notice (InventoryBackendNotice).
 *
 * Remove an entry when that area's API and tables are in place.
 */

const UNAVAILABLE_AREAS = [
  { prefix: "/planning/capacity", label: "Capacity planning" },
  { prefix: "/planning/calendar", label: "Planning calendar" },
  { prefix: "/planning/production-plans", label: "Production plans" },
  { prefix: "/quality/ncr", label: "Non-conformance reports" },
  { prefix: "/quality/capa", label: "Corrective and preventive actions" },
  { prefix: "/packing/instructions", label: "Packing instructions" },
  { prefix: "/finance/accounts", label: "Chart of accounts" },
  { prefix: "/finance/income", label: "Income" },
  { prefix: "/finance/expenses", label: "Expenses" },
  { prefix: "/finance/cash-bank", label: "Cash and bank" },
  { prefix: "/finance/transactions", label: "Financial transactions" },
  { prefix: "/finance/reports", label: "Financial reports" },
  { prefix: "/people-payroll/shifts", label: "Shifts" },
  { prefix: "/people-payroll/leave", label: "Leave balances", message: "Leave balances and requests are not implemented yet. Record paid and unpaid leave on the Attendance page; payroll uses it." },
  { prefix: "/products/categories", label: "Product categories" },
  { prefix: "/products/variants", label: "Product variants" },
  { prefix: "/products/pricing", label: "Product pricing" },
  { prefix: "/products/documents", label: "Product documents" },
  {
    prefix: "/administration/settings",
    label: "System settings",
    message:
      "This page lists built-in configuration for reference only; it cannot be changed here. Users, roles and the audit log are managed on their own pages.",
  },
  { prefix: "/reports/quality/ncr", label: "NCR reports" },
  { prefix: "/reports/quality/capa", label: "CAPA reports" },
];

const AVAILABLE_ROUTES = [
  "/administration/profile",
];

function matches(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function getModuleAvailability(pathname) {
  if (!pathname) {
    return null;
  }

  if (AVAILABLE_ROUTES.some((route) => matches(pathname, route))) {
    return null;
  }

  const area = UNAVAILABLE_AREAS
    .filter((entry) => matches(pathname, entry.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];

  if (!area) {
    return null;
  }

  return {
    label: area.label,
    title: `${area.label} backend not available`,
    message:
      area.message ??
      `${area.label} records cannot be loaded or saved yet: the server has no API for this area and the database has no tables for it. Actions that would create or change records are disabled. An administrator needs to add the schema and apply its database migration before this area can be used.`,
  };
}
