import { db } from "../core/database/client";

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

    modules: {
      customers: true,
      products: true,
      sales: true,
      inventory: false,
      procurement: false,
      production: false,
      quality: false,
      dispatch: false,
      finance: false,
    },
  };
}