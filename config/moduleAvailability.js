/*
 * Which ERP areas have no server API or database tables yet.
 *
 * AppShell shows a banner on matching routes so a page that renders but
 * cannot load or save records says so. Since Phase 12 every area in the
 * navigation is connected, so the list is empty.
 *
 * Add an entry when a new area ships its screens before its API.
 */

// Every area has its backend now; keep the mechanism for future modules.
const UNAVAILABLE_AREAS = [];

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
