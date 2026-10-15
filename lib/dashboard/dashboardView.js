/*
 * Dashboard view helpers.
 *
 * Maps the GET /api/dashboard payload (server/dashboard/dashboard.service.ts)
 * to display values. A value the API did not return as a finite number is
 * kept as null and rendered as "—", never as a placeholder zero.
 */

export const DASHBOARD_PERIODS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "this_month", label: "This month" },
];

export const DEFAULT_DASHBOARD_PERIOD = "30d";

const MODULE_LABELS = {
  customers: "Customers",
  products: "Products",
  sales: "Sales",
  inventory: "Inventory",
  procurement: "Procurement",
  production: "Production",
  quality: "Quality",
  dispatch: "Dispatch",
  finance: "Finance",
};

export function toMetric(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

export function formatCount(value) {
  const metric = toMetric(value);

  return metric === null ? "—" : metric.toLocaleString("en-US");
}

export function formatAmount(value) {
  const metric = toMetric(value);

  return metric === null
    ? "—"
    : metric.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
}

export function toDashboardView(data) {
  const kpis = data?.kpis ?? {};
  const modules = data?.modules ?? {};

  const recentOrders = Array.isArray(data?.recentOrders)
    ? data.recentOrders
    : [];

  const activity = Array.isArray(data?.activity)
    ? data.activity
    : [];

  const orderStatus = Array.isArray(data?.orderStatus)
    ? data.orderStatus.map((row) => ({
      status: row.status,
      count: toMetric(row.count),
      amount: toMetric(row.amount),
    }))
    : [];

  const totalOrders = toMetric(kpis.totalOrders);

  return {
    period: data?.period ?? null,

    kpis: {
      totalOrders,
      draftOrders: toMetric(kpis.draftOrders),
      approvedOrders: toMetric(kpis.approvedOrders),
      cancelledOrders: toMetric(kpis.cancelledOrders),
      approvedSales: toMetric(kpis.approvedSales),
      draftSales: toMetric(kpis.draftSales),
      cancelledSales: toMetric(kpis.cancelledSales),
      overdueOrders: toMetric(kpis.overdueOrders),
      dueSoonOrders: toMetric(kpis.dueSoonOrders),
      activeCustomers: toMetric(kpis.activeCustomers),
      activeProducts: toMetric(kpis.activeProducts),
    },

    orderStatus,
    recentOrders,
    activity,

    inventory: data?.inventory
      ? {
        itemCount: toMetric(data.inventory.itemCount),
        trackedItemCount: toMetric(data.inventory.trackedItemCount),
        lowStockCount: toMetric(data.inventory.lowStockCount),
        outOfStockCount: toMetric(data.inventory.outOfStockCount),
        totalsByUnit: Array.isArray(data.inventory.totalsByUnit) ? data.inventory.totalsByUnit : [],
      }
      : null,

    operations: data?.operations && typeof data.operations === "object" ? data.operations : {},

    /*
     * Modules the API explicitly reports as not connected. Their KPIs are
     * not shown at all rather than displayed as zero.
     */
    unavailableModules: Object.entries(modules)
      .filter(([, connected]) => connected === false)
      .map(([key]) => MODULE_LABELS[key] ?? key),

    isEmpty:
      totalOrders === 0 &&
      recentOrders.length === 0 &&
      activity.length === 0,
  };
}
