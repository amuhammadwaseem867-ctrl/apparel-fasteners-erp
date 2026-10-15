import { db } from "../core/database/client";
import { getStockSummary } from "../inventory/inventory.service";

export type DashboardPeriod =
  | "today"
  | "7d"
  | "30d"
  | "this_month";

function getPeriodDates(period: DashboardPeriod) {
  const now = new Date();

  const today = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    ),
  );

  if (period === "today") {
    return {
      dateFrom: today.toISOString().slice(0, 10),
      dateTo: today.toISOString().slice(0, 10),
    };
  }

  if (period === "7d") {
    const from = new Date(today);
    from.setUTCDate(from.getUTCDate() - 6);

    return {
      dateFrom: from.toISOString().slice(0, 10),
      dateTo: today.toISOString().slice(0, 10),
    };
  }

  if (period === "30d") {
    const from = new Date(today);
    from.setUTCDate(from.getUTCDate() - 29);

    return {
      dateFrom: from.toISOString().slice(0, 10),
      dateTo: today.toISOString().slice(0, 10),
    };
  }

  const monthStart = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      1,
    ),
  );

  return {
    dateFrom: monthStart.toISOString().slice(0, 10),
    dateTo: today.toISOString().slice(0, 10),
  };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function countStatuses(
  orders: Array<{ status: string }>,
) {
  return {
    draft: orders.filter((order) => order.status === "DRAFT").length,
    approved: orders.filter((order) => order.status === "APPROVED").length,
    cancelled: orders.filter((order) => order.status === "CANCELLED").length,
  };
}

export async function getDashboard(
  period: DashboardPeriod = "30d",
  permissions: string[] = [],
) {
  const { dateFrom, dateTo } = getPeriodDates(period);

  const [
    customers,
    products,
    orders,
    recentOrders,
    auditLogs,
  ] = await Promise.all([
    db.orm.public.Customer
      .where({ status: "ACTIVE" })
      .select("id")
      .all(),

    db.orm.public.Product
      .where((product) => product.status.neq("ARCHIVED"))
      .select("id")
      .all(),

    db.orm.public.SalesOrder
      .where((order) =>
        order.orderDate.gte(dateFrom),
      )
      .where((order) =>
        order.orderDate.lte(dateTo),
      )
      .all(),

    db.orm.public.SalesOrder
      .orderBy((order) => order.createdAt.desc())
      .limit(8)
      .all(),

    db.orm.public.AuditLog
      .orderBy((audit) => audit.createdAt.desc())
      .limit(8)
      .all(),
  ]);

  const statuses = countStatuses(orders);

  const totalSales = orders.reduce(
    (sum, order) => sum + Number(order.totalAmount),
    0,
  );

  const approvedSales = orders
    .filter((order) => order.status === "APPROVED")
    .reduce(
      (sum, order) => sum + Number(order.totalAmount),
      0,
    );

  const draftSales = orders
    .filter((order) => order.status === "DRAFT")
    .reduce(
      (sum, order) => sum + Number(order.totalAmount),
      0,
    );

  const cancelledSales = orders
    .filter((order) => order.status === "CANCELLED")
    .reduce(
      (sum, order) => sum + Number(order.totalAmount),
      0,
    );

  const orderIds = recentOrders.map((order) => order.id);

  const recentLines = orderIds.length
    ? await db.orm.public.SalesOrderLine
      .where((line) => line.salesOrderId.in(orderIds))
      .select(
        "salesOrderId",
        "isCustom",
      )
      .all()
    : [];

  const customerIds = [
    ...new Set(
      recentOrders.map((order) => order.customerId),
    ),
  ];

  const recentCustomers = customerIds.length
    ? await db.orm.public.Customer
      .where((customer) => customer.id.in(customerIds))
      .select("id", "name", "code")
      .all()
    : [];

  const customerMap = new Map(
    recentCustomers.map((customer) => [
      customer.id,
      customer,
    ]),
  );

  const lineMap = new Map<
    string,
    { items: number; customItems: number }
  >();

  for (const line of recentLines) {
    const current = lineMap.get(line.salesOrderId) ?? {
      items: 0,
      customItems: 0,
    };

    current.items += 1;

    if (line.isCustom) {
      current.customItems += 1;
    }

    lineMap.set(line.salesOrderId, current);
  }

  const today = new Date().toISOString().slice(0, 10);

  const dueSoonDate = new Date();
  dueSoonDate.setUTCDate(
    dueSoonDate.getUTCDate() + 7,
  );

  const dueSoon = dueSoonDate
    .toISOString()
    .slice(0, 10);

  const overdueOrders = orders.filter(
    (order) =>
      order.status !== "CANCELLED" &&
      order.status !== "APPROVED" &&
      Boolean(order.deliveryDate) &&
      order.deliveryDate! < today,
  ).length;

  const dueSoonOrders = orders.filter(
    (order) =>
      order.status !== "CANCELLED" &&
      Boolean(order.deliveryDate) &&
      order.deliveryDate! >= today &&
      order.deliveryDate! <= dueSoon,
  ).length;

  return {
    period: {
      key: period,
      dateFrom,
      dateTo,
    },

    kpis: {
      activeCustomers: customers.length,
      activeProducts: products.length,

      totalOrders: orders.length,
      draftOrders: statuses.draft,
      approvedOrders: statuses.approved,
      cancelledOrders: statuses.cancelled,

      totalSales: roundMoney(totalSales),
      approvedSales: roundMoney(approvedSales),
      draftSales: roundMoney(draftSales),
      cancelledSales: roundMoney(cancelledSales),

      overdueOrders,
      dueSoonOrders,
    },

    orderStatus: [
      {
        status: "DRAFT",
        count: statuses.draft,
        amount: roundMoney(draftSales),
      },
      {
        status: "APPROVED",
        count: statuses.approved,
        amount: roundMoney(approvedSales),
      },
      {
        status: "CANCELLED",
        count: statuses.cancelled,
        amount: roundMoney(cancelledSales),
      },
    ],

    recentOrders: recentOrders.map((order) => {
      const customer = customerMap.get(
        order.customerId,
      );

      const lineInfo = lineMap.get(order.id) ?? {
        items: 0,
        customItems: 0,
      };

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        customerName:
          customer?.name ?? "Customer unavailable",
        customerCode:
          customer?.code ?? null,
        orderDate: order.orderDate,
        deliveryDate: order.deliveryDate,
        status: order.status,
        items: lineInfo.items,
        customItems: lineInfo.customItems,
        totalAmount: Number(order.totalAmount),
      };
    }),

    activity: auditLogs.map((audit) => ({
      id: audit.id,
      action: audit.action,
      entityType: audit.entityType,
      entityId: audit.entityId,
      actorId: audit.actorId,
      requestId: audit.requestId,
      createdAt: audit.createdAt,
    })),

    // Counts and per-unit totals only; quantities in different units are
    // never added together.
    inventory: await inventorySnapshot(),

    // Each section only for users who may view that module.
    operations: await operationsSnapshot(dateFrom, dateTo, permissions),

    modules: {
      customers: true,
      products: true,
      sales: true,
      inventory: true,
      procurement: true,
      production: true,
      quality: true,
      dispatch: true,
      finance: true,
    },
  };
}
async function inventorySnapshot() {
  const summary = await getStockSummary();

  return {
    itemCount: summary.itemCount,
    trackedItemCount: summary.trackedItemCount,
    lowStockCount: summary.lowStockCount,
    outOfStockCount: summary.outOfStockCount,
    totalsByUnit: summary.totalsByUnit,
  };
}

/*
 * Live operational counts for the dashboard (D-028). Counts and exact
 * money strings only; each section is included only when the user holds
 * that module's view permission.
 */
async function operationsSnapshot(dateFrom: string, dateTo: string, permissions: string[]) {
  const can = (permission: string) => permissions.includes(permission);
  const upper = new Date(Date.parse(`${dateTo}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const one = async (plan: unknown) => ((await db.runtime().query(plan as never)) as unknown as Array<Record<string, string>>)[0];
  const result: Record<string, Record<string, string | number>> = {};

  if (can("production:view")) {
    const row = await one(db.raw.sql`
      select
        (select count(*) from erp_production_orders where status in ('RELEASED', 'IN_PROGRESS'))::text as active,
        (select count(*) from erp_production_orders where status = 'ON_HOLD')::text as "onHold",
        (select count(*) from erp_production_orders where status in ('PLANNED', 'RELEASED', 'IN_PROGRESS', 'ON_HOLD') and "dueDate" < ${today})::text as overdue,
        (select count(*) from erp_production_orders where status = 'COMPLETED' and "completedAt" >= ${dateFrom}::date and "completedAt" < ${upper}::date)::text as completed
    `.returnsRow({ active: "pg/text@1", onHold: "pg/text@1", overdue: "pg/text@1", completed: "pg/text@1" }).build());
    result.production = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
  }

  if (can("quality:view")) {
    const row = await one(db.raw.sql`
      select (select count(*) from erp_quality_inspections where status = 'OPEN')::text as open,
        coalesce((select round(sum("passedQuantity") * 100 / nullif(sum("inspectedQuantity"), 0), 1) from erp_quality_inspections
          where status = 'APPROVED' and "inspectionType" = 'FINAL' and "decidedAt" >= ${dateFrom}::date and "decidedAt" < ${upper}::date)::text, '') as "finalPassRate"
    `.returnsRow({ open: "pg/text@1", finalPassRate: "pg/text@1" }).build());
    result.quality = { open: Number(row.open), finalPassRate: row.finalPassRate };
  }

  if (can("dispatch:view")) {
    const row = await one(db.raw.sql`
      select (select count(*) from erp_packing_lists where status = 'CONFIRMED')::text as "readyToShip",
        (select count(*) from erp_shipments where status = 'DRAFT')::text as drafts,
        (select count(*) from erp_shipments where status = 'DISPATCHED')::text as "inTransit",
        (select count(*) from erp_shipments where status = 'DELIVERED' and "deliveredAt" >= ${dateFrom}::date and "deliveredAt" < ${upper}::date)::text as delivered
    `.returnsRow({ readyToShip: "pg/text@1", drafts: "pg/text@1", inTransit: "pg/text@1", delivered: "pg/text@1" }).build());
    result.dispatch = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
  }

  if (can("finance:view")) {
    const row = await one(db.raw.sql`
      select coalesce(sum(o), 0)::text as receivable, coalesce(sum(case when "dueDate" < ${today} then o else 0 end), 0)::text as overdue,
        (select coalesce(sum(amount), 0) from erp_customer_receipts where status = 'POSTED' and "receiptDate" between ${dateFrom} and ${dateTo})::text as received
      from (
        select i."dueDate", i."totalAmount" - coalesce((select sum("totalAmount") from erp_credit_notes c where c."invoiceId" = i.id), 0)
          - coalesce((select sum(amount) from erp_customer_receipts r where r."invoiceId" = i.id and r.status = 'POSTED'), 0) as o
        from erp_invoices i where i.status = 'ISSUED'
      ) x where o > 0
    `.returnsRow({ receivable: "pg/text@1", overdue: "pg/text@1", received: "pg/text@1" }).build());
    result.finance = row;
  }

  return result;
}
