import { or } from "@prisma/orm-postgres/orm-client";

import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { recordAuditEvent } from "../auth/audit.service";
import type {
  CustomerInput,
  CustomerUpdateInput,
  SalesOrderInput,
  SalesOrderQuery,
} from "./sales.validation";
import { calculateLineAmounts } from "./sales.validation";
import { releaseOrderReservations } from "../inventory/inventory.service";
import {
  centsToDecimalString,
  toPlainDecimalString,
} from "../core/utils/decimal";

function money(cents: number) {
  return centsToDecimalString(BigInt(cents));
}

function cleanOptional(value: string | undefined) {
  return value?.trim() || null;
}

export async function listCustomers(search: string, page: number, pageSize: number) {
  let customers = db.orm.public.Customer.where((customer) =>
    customer.status.eq("ACTIVE"),
  );
  if (search) {
    const pattern = `%${search}%`;
    customers = customers.where((customer) => or(
      customer.code.ilike(pattern),
      customer.name.ilike(pattern),
      customer.email.ilike(pattern),
    ));
  }

  const rows = await customers
    .orderBy((customer) => customer.name.asc())
    .offset((page - 1) * pageSize)
    .limit(pageSize + 1)
    .all();

  return {
    customers: rows.slice(0, pageSize),
    page,
    pageSize,
    hasMore: rows.length > pageSize,
  };
}

export async function createCustomer(input: CustomerInput, actorId: string) {
  const duplicate = await db.orm.public.Customer.where({ code: input.code }).first();
  if (duplicate) {
    throw new AppError("A customer with that code already exists.", {
      code: "CUSTOMER_CODE_EXISTS",
      status: 409,
    });
  }

  const customer = await db.orm.public.Customer.create({
    ...input,
    email: cleanOptional(input.email),
    phone: cleanOptional(input.phone),
    address: cleanOptional(input.address),
    contactPerson: cleanOptional(input.contactPerson),
    ntn: cleanOptional(input.ntn),
    strn: cleanOptional(input.strn),
    status: "ACTIVE",
  });
  await recordAuditEvent({
    actorId,
    action: "CUSTOMER_CREATED",
    entityType: "Customer",
    entityId: customer.id,
    metadata: { code: customer.code },
  });
  return customer;
}

/* Name, contact and tax details; the code never changes (documents carry it). */
export async function updateCustomer(id: string, input: CustomerUpdateInput, actorId: string) {
  const existing = await db.orm.public.Customer.where({ id }).first();
  if (!existing) {
    throw new AppError("Customer not found.", { code: "CUSTOMER_NOT_FOUND", status: 404 });
  }
  await db.orm.public.Customer.where({ id }).update({
    name: input.name,
    email: cleanOptional(input.email),
    phone: cleanOptional(input.phone),
    address: cleanOptional(input.address),
    contactPerson: cleanOptional(input.contactPerson),
    ntn: cleanOptional(input.ntn),
    strn: cleanOptional(input.strn),
    updatedAt: new Date().toISOString(),
  });
  await recordAuditEvent({ actorId, action: "CUSTOMER_UPDATED", entityType: "Customer", entityId: id, metadata: { code: existing.code } });
  return db.orm.public.Customer.where({ id }).first();
}

function lineSnapshot(
  line: SalesOrderInput["lines"][number],
  product?: Awaited<ReturnType<typeof db.orm.public.Product.first>>,
) {
  if (line.kind === "catalog") {
    if (!product) {
      throw new AppError("A selected catalog product is no longer available.", {
        code: "PRODUCT_UNAVAILABLE",
        status: 400,
        details: { productId: line.productId },
      });
    }

    return {
      productId: product.id,
      isCustom: false,
      productName: product.name,
      customerReference: null,
      skuReference: product.sku,
      category: product.category,
      variant: product.variant,
      tapeColor: cleanOptional(line.tapeColor),
      finish: cleanOptional(line.finish) ?? product.finish ?? null,
      size: cleanOptional(line.size) ?? product.size ?? null,
      unit: product.unit,
      quantity: toPlainDecimalString(line.quantity),
      unitPrice: toPlainDecimalString(line.unitPrice),
      discountPercent: line.discountPercent,
      taxPercent: line.taxPercent,
      lineTotal: money(calculateLineAmounts(line).totalCents),
      notes: cleanOptional(line.notes),
    };
  }

  return {
    productId: null,
    isCustom: true,
    productName: line.productName,
    customerReference: cleanOptional(line.customerReference),
    skuReference: cleanOptional(line.skuReference),
    category: cleanOptional(line.category),
    variant: cleanOptional(line.variant),
    tapeColor: cleanOptional(line.tapeColor),
    finish: cleanOptional(line.finish),
    size: cleanOptional(line.size),
    unit: line.unit,
    quantity: toPlainDecimalString(line.quantity),
    unitPrice: toPlainDecimalString(line.unitPrice),
    discountPercent: line.discountPercent,
    taxPercent: line.taxPercent,
    lineTotal: money(calculateLineAmounts(line).totalCents),
    notes: cleanOptional(line.notes),
  };
}

async function validateOrderReferences(input: SalesOrderInput) {
  const customer = await db.orm.public.Customer
    .where({ id: input.customerId, status: "ACTIVE" })
    .first();
  if (!customer) {
    throw new AppError("Select an active customer.", {
      code: "CUSTOMER_UNAVAILABLE",
      status: 400,
      details: { customerId: input.customerId },
    });
  }

  const productIds = [...new Set(input.lines
    .filter((line) => line.kind === "catalog")
    .map((line) => line.productId))];
  const products = productIds.length
    ? await db.orm.public.Product
      .where((product) => product.id.in(productIds))
      .where({ status: "ACTIVE" })
      .all()
    : [];
  const productsById = new Map(products.map((product) => [product.id, product]));

  for (const line of input.lines) {
    if (line.kind === "catalog" && !productsById.has(line.productId)) {
      throw new AppError("A selected catalog product is no longer available.", {
        code: "PRODUCT_UNAVAILABLE",
        status: 400,
        details: { productId: line.productId },
      });
    }
  }

  return productsById;
}

function orderTotals(input: SalesOrderInput) {
  const amounts = input.lines.map((line) => calculateLineAmounts(line));
  const subtotal = amounts.reduce((sum, line) => sum + line.grossCents, 0);
  const discountTotal = amounts.reduce((sum, line) => sum + line.discountCents, 0);
  const taxTotal = amounts.reduce((sum, line) => sum + line.taxCents, 0);

  return {
    subtotal: money(subtotal),
    discountTotal: money(discountTotal),
    taxTotal: money(taxTotal),
    totalAmount: money(subtotal - discountTotal + taxTotal),
  };
}

async function saveOrderLines(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  orderId: string,
  input: SalesOrderInput,
  products: Awaited<ReturnType<typeof validateOrderReferences>>,
) {
  for (const [index, line] of input.lines.entries()) {
    const product = line.kind === "catalog" ? products.get(line.productId) : undefined;
    await tx.orm.public.SalesOrderLine.create({
      salesOrderId: orderId,
      lineNo: index + 1,
      ...lineSnapshot(line, product),
    });
  }
}

function newOrderNumber() {
  return `SO-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function getSalesOrder(id: string) {
  const order = await db.orm.public.SalesOrder.where({ id }).first();
  if (!order) {
    throw new AppError("Sales order not found.", {
      code: "SALES_ORDER_NOT_FOUND",
      status: 404,
    });
  }
  const [customer, lines] = await Promise.all([
    db.orm.public.Customer.where({ id: order.customerId }).first(),
    db.orm.public.SalesOrderLine
      .where({ salesOrderId: order.id })
      .orderBy((line) => line.id.asc())
      .all(),
  ]);

  if (!customer) {
    throw new AppError("The customer associated with this order was not found.", {
      code: "ORDER_CUSTOMER_MISSING",
      status: 500,
    });
  }

  return {
    ...order,
    subtotal: Number(order.subtotal),
    discountTotal: Number(order.discountTotal),
    taxTotal: Number(order.taxTotal),
    totalAmount: Number(order.totalAmount),
    customer,
    // Order-sheet order; lines saved before line numbers existed keep their old order after them.
    lines: [...lines].sort((a, b) => (a.lineNo ?? Number.MAX_SAFE_INTEGER) - (b.lineNo ?? Number.MAX_SAFE_INTEGER)).map((line) => ({
      ...line,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      lineTotal: Number(line.lineTotal),
    })),
  };
}

export async function listSalesOrders(filters: SalesOrderQuery) {
  let orders = db.orm.public.SalesOrder;
  if (filters.customerId) {
    orders = orders.where({ customerId: filters.customerId });
  }
  if (filters.status) {
    orders = orders.where({ status: filters.status });
  }
  if (filters.dateFrom) {
    orders = orders.where((order) => order.orderDate.gte(filters.dateFrom!));
  }
  if (filters.dateTo) {
    orders = orders.where((order) => order.orderDate.lte(filters.dateTo!));
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    const matches = await db.orm.public.Customer
      .where((customer) => or(
        customer.name.ilike(pattern),
        customer.code.ilike(pattern),
      ))
      .select("id")
      .all();
    orders = orders.where((order) => or(
      order.orderNumber.ilike(pattern),
      order.customerId.in(matches.map((customer) => customer.id)),
    ));
  }

  const rows = await orders
    .orderBy((order) => order.createdAt.desc())
    .offset((filters.page - 1) * filters.pageSize)
    .limit(filters.pageSize + 1)
    .all();
  const hasMore = rows.length > filters.pageSize;
  const pageOrders = rows.slice(0, filters.pageSize);
  const customerIds = [...new Set(pageOrders.map((order) => order.customerId))];
  const customers = customerIds.length
    ? await db.orm.public.Customer
      .where((customer) => customer.id.in(customerIds))
      .all()
    : [];
  const customerNames = new Map(customers.map((customer) => [customer.id, customer.name]));
  const orderIds = pageOrders.map((order) => order.id);
  const lines = orderIds.length
    ? await db.orm.public.SalesOrderLine
      .where((line) => line.salesOrderId.in(orderIds))
      .select("salesOrderId")
      .all()
    : [];
  const lineCounts = new Map<string, number>();
  for (const line of lines) {
    lineCounts.set(line.salesOrderId, (lineCounts.get(line.salesOrderId) ?? 0) + 1);
  }

  return {
    orders: pageOrders.map((order) => ({
      ...order,
      customerName: customerNames.get(order.customerId) ?? "Customer unavailable",
      items: lineCounts.get(order.id) ?? 0,
      totalAmount: Number(order.totalAmount),
    })),
    page: filters.page,
    pageSize: filters.pageSize,
    hasMore,
  };
}

export const SALES_ORDER_EXPORT_LIMIT = 10000;

/*
 * All orders matching the list filters, for export. Pages through the same
 * query as the list so the export matches what the user filtered. Refuses
 * rather than truncates when the result is larger than the export limit.
 */
export async function exportSalesOrders(
  filters: Omit<SalesOrderQuery, "page" | "pageSize">,
) {
  const pageSize = 100;
  const rows: Awaited<ReturnType<typeof listSalesOrders>>["orders"] = [];

  for (let page = 1; ; page += 1) {
    const result = await listSalesOrders({ ...filters, page, pageSize });
    rows.push(...result.orders);

    if (rows.length > SALES_ORDER_EXPORT_LIMIT) {
      throw new AppError(
        `More than ${SALES_ORDER_EXPORT_LIMIT} orders match these filters. Narrow the date range or filters and export again.`,
        { code: "EXPORT_TOO_LARGE", status: 422 },
      );
    }

    if (!result.hasMore) {
      return rows;
    }
  }
}

export async function createSalesOrder(input: SalesOrderInput, actorId: string) {
  const products = await validateOrderReferences(input);
  const totals = orderTotals(input);
  const order = await db.transaction(async (tx) => {
    const created = await tx.orm.public.SalesOrder.create({
      orderNumber: newOrderNumber(),
      customerId: input.customerId,
      orderDate: input.orderDate,
      deliveryDate: cleanOptional(input.deliveryDate),
      customerPo: cleanOptional(input.customerPo),
      status: "DRAFT",
      notes: cleanOptional(input.notes),
      ...totals,
      createdBy: actorId,
    });
    await saveOrderLines(tx, created.id, input, products);
    return created;
  });

  await recordAuditEvent({
    actorId,
    action: "SALES_ORDER_CREATED",
    entityType: "SalesOrder",
    entityId: order.id,
    metadata: { orderNumber: order.orderNumber, totalAmount: order.totalAmount },
  });
  return getSalesOrder(order.id);
}

export async function updateSalesOrder(
  id: string,
  input: SalesOrderInput,
  actorId: string,
) {
  const current = await getSalesOrder(id);
  if (current.status !== "DRAFT") {
    throw new AppError("Only draft sales orders can be edited.", {
      code: "SALES_ORDER_NOT_EDITABLE",
      status: 409,
    });
  }

  const products = await validateOrderReferences(input);
  const totals = orderTotals(input);
  await db.transaction(async (tx) => {
    // Lock the order and re-check inside the transaction: an approval or
    // cancellation that commits after the check above must win.
    const locked = (await tx.query(db.raw.sql`
      select status from erp_sales_orders where id = ${id}::uuid for update
    `.returnsRow({ status: "pg/text@1" }).build())) as unknown as Array<{ status: string }>;
    if (locked[0]?.status !== "DRAFT") {
      throw new AppError("Only draft sales orders can be edited.", {
        code: "SALES_ORDER_NOT_EDITABLE",
        status: 409,
      });
    }

    // Editing replaces every line (new line ids). Reservations made
    // against specific lines would be orphaned, so they must be released
    // first.
    const lineReservation = await tx.orm.public.StockReservation
      .where({ salesOrderId: id, status: "ACTIVE" })
      .where((reservation) => reservation.salesOrderLineId.isNotNull())
      .first();
    if (lineReservation) {
      throw new AppError("Release this order's line reservations before editing its lines.", {
        code: "SALES_ORDER_HAS_RESERVATIONS",
        status: 409,
      });
    }

    await tx.orm.public.SalesOrder.where({ id }).update({
      customerId: input.customerId,
      orderDate: input.orderDate,
      deliveryDate: cleanOptional(input.deliveryDate),
      customerPo: cleanOptional(input.customerPo),
      notes: cleanOptional(input.notes),
      ...totals,
      updatedAt: new Date().toISOString(),
    });
    await tx.orm.public.SalesOrderLine.where({ salesOrderId: id }).deleteAll();
    await saveOrderLines(tx, id, input, products);
  });

  await recordAuditEvent({
    actorId,
    action: "SALES_ORDER_UPDATED",
    entityType: "SalesOrder",
    entityId: id,
    metadata: { orderNumber: current.orderNumber },
  });
  return getSalesOrder(id);
}

export async function changeSalesOrderStatus(
  id: string,
  action: "approve" | "cancel",
  actorId: string,
) {
  const order = await getSalesOrder(id);
  const status = action === "approve" ? "APPROVED" : "CANCELLED";
  if (order.status !== "DRAFT" && !(action === "cancel" && order.status === "APPROVED")) {
    const verb = action === "approve" ? "approved" : "cancelled";
    throw new AppError(`A ${order.status.toLowerCase()} order cannot be ${verb}.`, {
      code: "SALES_ORDER_STATUS_CONFLICT",
      status: 409,
    });
  }

  // Conditional on the status just read, so concurrent approve/cancel
  // requests cannot both succeed.
  // Raw compare-and-set: the ORM's filtered update is not atomic under
  // concurrency (verified by tests/server/inventory.db.test.mjs).
  await db.transaction(async (tx) => {
    if (status === "CANCELLED") {
      // Dispatch locks the order row too, so a shipment cannot be dispatched
      // between this check and the cancellation (D-022).
      await tx.query(db.raw.sql`select id::text as id from erp_sales_orders where id = ${id}::uuid for update`
        .returnsRow({ id: "pg/text@1" }).build());
      const shipped = (await tx.query(db.raw.sql`
        select "shipmentNumber" as number from erp_shipments
        where "salesOrderId" = ${id}::uuid and status in ('DISPATCHED', 'DELIVERED') limit 1
      `.returnsRow({ number: "pg/text@1" }).build())) as unknown as Array<{ number: string }>;
      if (shipped.length) {
        throw new AppError(`Goods have already been dispatched on ${shipped[0].number}; this order can no longer be cancelled.`, {
          code: "SALES_ORDER_SHIPPED",
          status: 409,
        });
      }
      await tx.query(db.raw.sql`
        update erp_shipments set status = 'CANCELLED' where "salesOrderId" = ${id}::uuid and status = 'DRAFT'
        returning id::text as id
      `.returnsRow({ id: "pg/text@1" }).build());
    }

    const updated = (await tx.query(db.raw.sql`
      update erp_sales_orders set status = ${status}, "updatedAt" = now()
      where id = ${id}::uuid and status = ${order.status}
      returning id::text as id
    `.returnsRow({ id: "pg/text@1" }).build())) as unknown as Array<{ id: string }>;
    if (!updated.length) {
      throw new AppError("The order was changed by someone else. Reload and try again.", {
        code: "SALES_ORDER_STATUS_CONFLICT",
        status: 409,
      });
    }
  });

  if (status === "CANCELLED") {
    // A cancelled order must not keep stock reserved.
    await releaseOrderReservations(id, actorId);
  }

  await recordAuditEvent({
    actorId,
    action: action === "approve" ? "SALES_ORDER_APPROVED" : "SALES_ORDER_CANCELLED",
    entityType: "SalesOrder",
    entityId: id,
    metadata: { orderNumber: order.orderNumber, previousStatus: order.status },
  });
  return getSalesOrder(id);
}
