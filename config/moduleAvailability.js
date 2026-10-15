/*
 * Which ERP areas have no server API or database tables yet.
 *
 * AppShell shows a banner on matching routes so a page that renders but
 * cannot load or save records says so. Routes with a working backend
 * (dashboard, products, BOM, sales orders, customers, inventory, MRP,
 * production, quality inspections, packing, dispatch, invoicing and
 * receivables, procurement and payables, general ledger, NCR/CAPA, shifts and leave, product catalogue, users, roles, audit, gate passes, HR and payroll, reports,
 * profile) are not listed.
 * Inventory pages render their own notice (InventoryBackendNotice).
 *
 * Remove an entry when that area's API and tables are in place.
 */

const UNAVAILABLE_AREAS = [
  { prefix: "/planning/capacity", label: "Capacity planning" },
  { prefix: "/planning/calendar", label: "Planning calendar" },
  { prefix: "/planning/production-plans", label: "Production plans" },
  { prefix: "/packing/instructions", label: "Packing instructions" },
  {
    prefix: "/administration/settings",
    label: "System settings",
    message:
      "This page lists built-in configuration for reference only; it cannot be changed here. Users, roles and the audit log are managed on their own pages.",
  },
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
