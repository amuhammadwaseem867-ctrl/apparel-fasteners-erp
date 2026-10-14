/*
 * Which ERP areas have no server API or database tables yet.
 *
 * AppShell shows a banner on matching routes so a page that renders but
 * cannot load or save records says so. Routes with a working backend
 * (dashboard, products, BOM, sales orders, customers, inventory, MRP,
 * profile) are not listed.
 * Inventory pages render their own notice (InventoryBackendNotice).
 *
 * Remove an entry when that area's API and tables are in place.
 */

const UNAVAILABLE_AREAS = [
  { prefix: "/production", label: "Production" },
  { prefix: "/planning/capacity", label: "Capacity planning" },
  { prefix: "/planning/calendar", label: "Planning calendar" },
  { prefix: "/planning/production-plans", label: "Production plans" },
  { prefix: "/procurement", label: "Procurement" },
  { prefix: "/quality", label: "Quality control" },
  { prefix: "/packing", label: "Packing" },
  { prefix: "/dispatch", label: "Dispatch and delivery" },
  { prefix: "/finance", label: "Finance" },
  { prefix: "/people-payroll", label: "People and payroll" },
  { prefix: "/products/categories", label: "Product categories" },
  { prefix: "/products/variants", label: "Product variants" },
  { prefix: "/products/pricing", label: "Product pricing" },
  { prefix: "/products/documents", label: "Product documents" },
  { prefix: "/administration", label: "Administration" },
  {
    prefix: "/reports",
    label: "Reports",
    message:
      "Reports cannot show data yet: the modules they report on have no database tables or API. Live figures for sales orders, customers and products are on the Dashboard and Sales pages.",
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
