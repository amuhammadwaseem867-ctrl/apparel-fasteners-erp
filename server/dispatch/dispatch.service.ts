/*
 * Shipments to customers (D-022).
 *
 * DRAFT      lines are confirmed packing lists or loose finished-goods stock,
 *            for items on one approved sales order.
 * DISPATCHED one transaction, under the sales order's row lock: re-checks
 *            that no item ships past its ordered quantity, claims each packing
 *            list (CONFIRMED -> SHIPPED, compare-and-set), and posts one
 *            finished-goods dispatch from the ship-from location, consuming
 *            the order's reservations first.
 * DELIVERED  records who received it and the Delivered stage run of each
 *            packed production order.
 * Only drafts can be cancelled; dispatched shipments are history.
 */

import { or } from "@prisma/orm-postgres/orm-client";

import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { findSqlQueryError } from "../core/errors/database-errors";
import { addDecimalStrings, normalizeDecimalString, subtractDecimalStrings, toPlainDecimalString } from "../core/utils/decimal";
import { allocateDocumentNumber, postStockDocumentInTransaction, type Tx } from "../inventory/inventory.service";
import { quantityPrecisionError } from "../inventory/stock-rules";
import { FINAL_STAGE } from "../production/production-rules";
import { recordStageRunInTransaction } from "../production/production.service";
import { allocateToReservations, nextShipmentStatus, overShipment, sumByProduct } from "./dispatch-rules";
import type { ShipmentInput, ShipmentQuery } from "./dispatch.validation";

const dec = (value: unknown) => normalizeDecimalString(String(value ?? "0"));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound(): never {
  throw new AppError("Shipment not found.", { code: "SHIPMENT_NOT_FOUND", status: 404 });
}

type Runner = Tx | ReturnType<typeof db.runtime>;

/* Ordered catalogue quantity per item, and quantity on dispatched/delivered shipments. */
async function orderPosition(runner: Tx | null, salesOrderId: string, excludeShipmentId = "") {
  const client = (runner ?? db) as Tx;
  const lines = await client.orm.public.SalesOrderLine.where({ salesOrderId }).all();
  const ordered = sumByProduct(lines
    .filter((line) => line.productId && !line.isCustom)
    .map((line) => ({ productId: line.productId!, quantity: dec(line.quantity) })));

  const rows = (await (runner ?? db.runtime()).query(db.raw.sql`
    select l."productId"::text as "productId", sum(l.quantity)::text as quantity, s.status
    from erp_shipment_lines l join erp_shipments s on s.id = l."shipmentId"
    where s."salesOrderId" = ${salesOrderId}::uuid and s.status in ('DISPATCHED', 'DELIVERED')
      and s.id::text <> ${excludeShipmentId}
    group by l."productId", s.status
  `.returnsRow({ productId: "pg/text@1", quantity: "pg/text@1", status: "pg/text@1" }).build() as never)) as unknown as Array<{ productId: string; quantity: string; status: string }>;

  return {
    lines,
    ordered,
    shipped: sumByProduct(rows.map((row) => ({ productId: row.productId, quantity: dec(row.quantity) }))),
    delivered: sumByProduct(rows.filter((row) => row.status === "DELIVERED").map((row) => ({ productId: row.productId, quantity: dec(row.quantity) }))),
  };
}

async function overShipmentError(position: Awaited<ReturnType<typeof orderPosition>>, shipment: Map<string, string>) {
  const problem = overShipment(position.ordered, position.shipped, shipment);
  if (!problem) return;
  const product = await db.orm.public.Product.where({ id: problem.productId }).first();
  throw new AppError(
    position.ordered.has(problem.productId)
      ? `${product?.sku ?? "Item"}: ordered ${problem.ordered}, already shipped ${problem.shipped}; only ${problem.remaining} can still ship, not ${problem.requested}.`
      : `${product?.sku ?? "Item"} is not a catalogue line on this sales order.`,
    { code: "SHIPMENT_EXCEEDS_ORDER", status: 409, details: problem },
  );
}

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

export async function createShipment(input: ShipmentInput, actorId: string) {
  const replay = await db.orm.public.Shipment.where({ idempotencyKey: input.idempotencyKey }).first();
  if (replay) return getShipment(replay.id);

  const order = await db.orm.public.SalesOrder.where({ id: input.salesOrderId }).first();
  if (!order) {
    throw new AppError("Sales order not found.", { code: "SALES_ORDER_NOT_FOUND", status: 400 });
  }
  if (order.status !== "APPROVED") {
    throw new AppError("Only approved sales orders can be shipped.", { code: "SALES_ORDER_NOT_APPROVED", status: 409 });
  }
  const location = await db.orm.public.StorageLocation.where({ id: input.locationId }).first();
  if (!location) {
    throw new AppError("Storage location not found.", { code: "LOCATION_NOT_FOUND", status: 400 });
  }

  const resolved: Array<{ productId: string; quantity: string; packingListId: string | null }> = [];
  for (const [index, line] of input.lines.entries()) {
    if (line.packingListId) {
      const list = await db.orm.public.PackingList.where({ id: line.packingListId }).first();
      if (!list || list.status !== "CONFIRMED") {
        throw new AppError(`Line ${index + 1}: only confirmed, unshipped packing lists can be shipped.`, { code: "PACKING_LIST_NOT_SHIPPABLE", status: 409 });
      }
      if (list.salesOrderId && list.salesOrderId !== order.id) {
        throw new AppError(`Line ${index + 1}: ${list.packingNumber} was packed for another sales order.`, { code: "PACKING_LIST_OTHER_ORDER", status: 409 });
      }
      if (list.locationId !== location.id) {
        throw new AppError(`Line ${index + 1}: ${list.packingNumber} is stored at another location. Ship from that location or transfer the stock first.`, {
          code: "PACKING_LIST_OTHER_LOCATION",
          status: 409,
        });
      }
      resolved.push({ productId: list.productId, quantity: dec(list.totalQuantity), packingListId: list.id });
    } else {
      const product = await db.orm.public.Product.where({ id: line.productId! }).first();
      if (!product) {
        throw new AppError(`Line ${index + 1}: item not found.`, { code: "PRODUCT_NOT_FOUND", status: 400 });
      }
      const precision = quantityPrecisionError(line.quantity!, product.unit);
      if (precision) {
        throw new AppError(`Line ${index + 1}: ${precision}`, { code: "QUANTITY_PRECISION", status: 400 });
      }
      resolved.push({ productId: product.id, quantity: toPlainDecimalString(line.quantity!), packingListId: null });
    }
  }

  await overShipmentError(await orderPosition(null, order.id), sumByProduct(resolved));
  // Link a shipment line to its sales order line only when the item is on
  // exactly one catalogue line; otherwise the link would be arbitrary.
  const catalogLines = (await db.orm.public.SalesOrderLine.where({ salesOrderId: order.id }).all())
    .filter((line) => line.productId && !line.isCustom);
  const lineIds = new Map(catalogLines
    .filter((line) => catalogLines.filter((other) => other.productId === line.productId).length === 1)
    .map((line) => [line.productId!, line.id]));

  try {
    const id = await db.transaction(async (tx) => {
      const shipmentNumber = await allocateDocumentNumber(tx, "SHP");
      const shipment = await tx.orm.public.Shipment.create({
        shipmentNumber,
        salesOrderId: order.id,
        customerId: order.customerId,
        locationId: location.id,
        vehicleNumber: input.vehicleNumber || null,
        driverName: input.driverName || null,
        driverPhone: input.driverPhone || null,
        transporter: input.transporter || null,
        trackingReference: input.trackingReference || null,
        deliveryAddress: input.deliveryAddress || null,
        notes: input.notes || null,
        idempotencyKey: input.idempotencyKey,
        createdBy: actorId,
      });
      for (const [index, line] of resolved.entries()) {
        await tx.orm.public.ShipmentLine.create({
          shipmentId: shipment.id,
          lineNo: index + 1,
          productId: line.productId,
          salesOrderLineId: lineIds.get(line.productId) ?? null,
          packingListId: line.packingListId,
          quantity: line.quantity,
        });
      }
      await recordAuditEvent({
        actorId,
        action: "SHIPMENT_CREATED",
        entityType: "Shipment",
        entityId: shipment.id,
        metadata: { shipmentNumber, salesOrderId: order.id, lines: resolved.length },
      }, tx);
      return shipment.id;
    });
    return getShipment(id);
  } catch (error) {
    const sqlError = findSqlQueryError(error) as { sqlState?: string; constraint?: string } | null;
    if (sqlError?.sqlState === "23505" && sqlError.constraint?.includes("idempotencyKey")) {
      const original = await db.orm.public.Shipment.where({ idempotencyKey: input.idempotencyKey }).first();
      if (original) return getShipment(original.id);
    }
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Dispatch / deliver / cancel                                         */
/* ------------------------------------------------------------------ */

async function rows<T>(tx: Runner, plan: unknown) {
  return (await tx.query(plan as never)) as unknown as T[];
}

async function dispatch(tx: Tx, shipment: { id: string; shipmentNumber: string; salesOrderId: string; locationId: string }, actorId: string) {
  const order = await rows<{ status: string }>(tx, db.raw.sql`
    select status from erp_sales_orders where id = ${shipment.salesOrderId}::uuid for update
  `.returnsRow({ status: "pg/text@1" }).build());
  if (order[0]?.status !== "APPROVED") {
    throw new AppError("The sales order is no longer approved; this shipment cannot be dispatched.", { code: "SALES_ORDER_NOT_APPROVED", status: 409 });
  }

  const lines = await tx.orm.public.ShipmentLine.where({ shipmentId: shipment.id }).orderBy((line) => line.lineNo.asc()).all();
  const quantities = sumByProduct(lines.map((line) => ({ productId: line.productId, quantity: dec(line.quantity) })));
  await overShipmentError(await orderPosition(tx, shipment.salesOrderId, shipment.id), quantities);

  for (const line of lines.filter((item) => item.packingListId)) {
    const claimed = await rows<{ id: string }>(tx, db.raw.sql`
      update erp_packing_lists set status = 'SHIPPED', "shipmentId" = ${shipment.id}::uuid
      where id = ${line.packingListId!}::uuid and status = 'CONFIRMED' and "locationId" = ${shipment.locationId}::uuid
      returning id::text as id
    `.returnsRow({ id: "pg/text@1" }).build());
    if (!claimed.length) {
      throw new AppError(`Line ${line.lineNo}: the packing list was already shipped or is no longer confirmed.`, { code: "PACKING_LIST_NOT_SHIPPABLE", status: 409 });
    }
  }

  // Consume this order's open reservations at the ship-from location first.
  const documentLines: Array<{ productId: string; locationId: string; quantity: number; reservationId?: string }> = [];
  for (const [productId, quantity] of quantities) {
    const reservations = await rows<{ id: string; open: string }>(tx, db.raw.sql`
      select id::text as id, ("quantity" - "consumedQuantity" - "releasedQuantity")::text as open
      from erp_stock_reservations
      where "salesOrderId" = ${shipment.salesOrderId}::uuid and "productId" = ${productId}::uuid
        and "locationId" = ${shipment.locationId}::uuid and status = 'ACTIVE'
      order by "createdAt", id
    `.returnsRow({ id: "pg/text@1", open: "pg/text@1" }).build());
    for (const part of allocateToReservations(quantity, reservations)) {
      documentLines.push({
        productId,
        locationId: shipment.locationId,
        quantity: Number(part.quantity),
        ...(part.reservationId ? { reservationId: part.reservationId } : {}),
      });
    }
  }

  await postStockDocumentInTransaction(tx, {
    documentType: "FG_DISPATCH",
    idempotencyKey: `shp-${shipment.id}`,
    reference: shipment.shipmentNumber,
    reason: "",
    notes: "",
    sourceType: "Shipment",
    sourceId: shipment.id,
    lines: documentLines,
  }, actorId);
}

async function deliver(tx: Tx, shipment: { id: string; shipmentNumber: string }, actorId: string) {
  const lines = await tx.orm.public.ShipmentLine.where({ shipmentId: shipment.id }).orderBy((line) => line.lineNo.asc()).all();
  for (const line of lines.filter((item) => item.packingListId)) {
    const list = (await tx.orm.public.PackingList.where({ id: line.packingListId! }).first())!;
    await recordStageRunInTransaction(tx, list.productionOrderId, FINAL_STAGE.key, {
      idempotencyKey: `shp-line-${line.id}`,
      inputQuantity: Number(dec(line.quantity)),
      acceptedQuantity: Number(dec(line.quantity)),
      rejectedQuantity: 0,
      wastageQuantity: 0,
      reworkQuantity: 0,
      operatorName: "",
      workstation: "",
      remarks: `Delivered on shipment ${shipment.shipmentNumber} (${list.packingNumber})`,
    }, actorId, "dispatch");
  }
}

export async function changeShipment(
  id: string,
  action: "dispatch" | "deliver" | "cancel",
  details: { receivedBy?: string; deliveryNote?: string },
  actorId: string,
) {
  if (!UUID.test(id)) notFound();

  await db.transaction(async (tx) => {
    const current = await tx.orm.public.Shipment.where({ id }).first();
    if (!current) notFound();
    const next = nextShipmentStatus(action, current.status);
    if (!next) {
      throw new AppError(`A ${current.status.toLowerCase()} shipment cannot be ${action === "dispatch" ? "dispatched" : action === "deliver" ? "delivered" : "cancelled"}.`, {
        code: "SHIPMENT_STATUS_CONFLICT",
        status: 409,
      });
    }

    // Compare-and-set on the status just read: a concurrent change makes this a no-op.
    const claimed = await rows<{ id: string }>(tx, db.raw.sql`
      update erp_shipments set status = ${next},
        "dispatchedBy" = case when ${next} = 'DISPATCHED' then ${actorId}::uuid else "dispatchedBy" end,
        "dispatchedAt" = case when ${next} = 'DISPATCHED' then now() else "dispatchedAt" end,
        "deliveredBy" = case when ${next} = 'DELIVERED' then ${actorId}::uuid else "deliveredBy" end,
        "deliveredAt" = case when ${next} = 'DELIVERED' then now() else "deliveredAt" end,
        "receivedBy" = case when ${next} = 'DELIVERED' then ${details.receivedBy ?? ""} else "receivedBy" end,
        "deliveryNote" = case when ${next} = 'DELIVERED' then ${details.deliveryNote ?? ""} else "deliveryNote" end
      where id = ${id}::uuid and status = ${current.status}
      returning id::text as id
    `.returnsRow({ id: "pg/text@1" }).build());
    if (!claimed.length) {
      throw new AppError("This shipment was changed by someone else. Reload and try again.", { code: "SHIPMENT_STATUS_CONFLICT", status: 409 });
    }

    if (action === "dispatch") await dispatch(tx, current, actorId);
    if (action === "deliver") await deliver(tx, current, actorId);

    await recordAuditEvent({
      actorId,
      action: `SHIPMENT_${next}`,
      entityType: "Shipment",
      entityId: id,
      metadata: { shipmentNumber: current.shipmentNumber, from: current.status, to: next },
    }, tx);
  });

  return getShipment(id);
}

/* ------------------------------------------------------------------ */
/* Read                                                                */
/* ------------------------------------------------------------------ */

async function headerLookups(rows: Array<{ salesOrderId: string; customerId: string; locationId: string }>) {
  const unique = (values: string[]) => [...new Set(values)];
  const [orders, customers, locations] = await Promise.all([
    rows.length ? db.orm.public.SalesOrder.where((item) => item.id.in(unique(rows.map((row) => row.salesOrderId)))).all() : [],
    rows.length ? db.orm.public.Customer.where((item) => item.id.in(unique(rows.map((row) => row.customerId)))).all() : [],
    rows.length ? db.orm.public.StorageLocation.where((item) => item.id.in(unique(rows.map((row) => row.locationId)))).all() : [],
  ]);
  const warehouses = locations.length
    ? await db.orm.public.Warehouse.where((item) => item.id.in(unique(locations.map((location) => location.warehouseId)))).all()
    : [];
  return (row: { salesOrderId: string; customerId: string; locationId: string }) => {
    const location = locations.find((item) => item.id === row.locationId);
    return {
      salesOrderNumber: orders.find((item) => item.id === row.salesOrderId)?.orderNumber ?? null,
      customerName: customers.find((item) => item.id === row.customerId)?.name ?? null,
      locationLabel: location ? `${warehouses.find((item) => item.id === location.warehouseId)?.code ?? "?"}/${location.code}` : null,
    };
  };
}

export async function getShipment(id: string) {
  if (!UUID.test(id)) notFound();
  const shipment = await db.orm.public.Shipment.where({ id }).first();
  if (!shipment) notFound();

  const lines = await db.orm.public.ShipmentLine.where({ shipmentId: id }).orderBy((line) => line.lineNo.asc()).all();
  const products = lines.length ? await db.orm.public.Product.where((item) => item.id.in([...new Set(lines.map((line) => line.productId))])).all() : [];
  const listIds = lines.map((line) => line.packingListId).filter(Boolean) as string[];
  const lists = listIds.length ? await db.orm.public.PackingList.where((item) => item.id.in(listIds)).all() : [];
  const orderIds = [...new Set(lists.map((list) => list.productionOrderId))];
  const productionOrders = orderIds.length ? await db.orm.public.ProductionOrder.where((item) => item.id.in(orderIds)).all() : [];
  const documents = await db.orm.public.StockDocument.where({ sourceType: "Shipment", sourceId: id }).all();
  const users = await db.orm.public.User
    .where((user) => user.id.in([shipment.createdBy, shipment.dispatchedBy, shipment.deliveredBy].filter(Boolean) as string[]))
    .select("id", "name")
    .all();
  const name = (userId: string | null) => (userId ? users.find((user) => user.id === userId)?.name ?? null : null);
  const describe = await headerLookups([shipment]);

  return {
    ...shipment,
    ...describe(shipment),
    createdByName: name(shipment.createdBy),
    dispatchedByName: name(shipment.dispatchedBy),
    deliveredByName: name(shipment.deliveredBy),
    lines: lines.map((line) => {
      const product = products.find((item) => item.id === line.productId);
      const list = lists.find((item) => item.id === line.packingListId);
      return {
        ...line,
        quantity: dec(line.quantity),
        sku: product?.sku ?? null,
        productName: product?.name ?? null,
        unit: product?.unit ?? null,
        packingNumber: list?.packingNumber ?? null,
        packageCount: list?.packageCount ?? null,
        productionOrderId: list?.productionOrderId ?? null,
        productionOrderNumber: productionOrders.find((item) => item.id === list?.productionOrderId)?.orderNumber ?? null,
      };
    }),
    stockDocuments: documents.map((document) => ({ id: document.id, documentNumber: document.documentNumber, documentType: document.documentType })),
  };
}

export async function listShipments(filters: ShipmentQuery) {
  let query = db.orm.public.Shipment;
  if (filters.status === "OPEN") query = query.where((row) => row.status.in(["DRAFT", "DISPATCHED"]));
  else if (filters.status) query = query.where({ status: filters.status });
  if (filters.salesOrderId) query = query.where({ salesOrderId: filters.salesOrderId });
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    const orders = await db.orm.public.SalesOrder.where((order) => order.orderNumber.ilike(pattern)).select("id").all();
    const customers = await db.orm.public.Customer.where((customer) => customer.name.ilike(pattern)).select("id").all();
    query = query.where((row) => or(
      row.shipmentNumber.ilike(pattern),
      ...(orders.length ? [row.salesOrderId.in(orders.map((order) => order.id))] : []),
      ...(customers.length ? [row.customerId.in(customers.map((customer) => customer.id))] : []),
    ));
  }
  const result = await query
    .orderBy((row) => row.createdAt.desc())
    .offset((filters.page - 1) * filters.pageSize)
    .limit(filters.pageSize + 1)
    .all();
  const page = result.slice(0, filters.pageSize);
  const describe = await headerLookups(page);
  const totals = page.length
    ? await db.orm.public.ShipmentLine.where((line) => line.shipmentId.in(page.map((row) => row.id))).select("shipmentId", "quantity").all()
    : [];

  return {
    shipments: page.map((row) => ({
      ...row,
      ...describe(row),
      lineCount: totals.filter((line) => line.shipmentId === row.id).length,
    })),
    page: filters.page,
    pageSize: filters.pageSize,
    hasMore: result.length > filters.pageSize,
  };
}

/* Ordered, shipped, delivered and remaining per catalogue item of a sales order. */
export async function getSalesOrderFulfilment(salesOrderId: string) {
  if (!UUID.test(salesOrderId)) {
    throw new AppError("Sales order not found.", { code: "SALES_ORDER_NOT_FOUND", status: 404 });
  }
  const order = await db.orm.public.SalesOrder.where({ id: salesOrderId }).first();
  if (!order) {
    throw new AppError("Sales order not found.", { code: "SALES_ORDER_NOT_FOUND", status: 404 });
  }
  const position = await orderPosition(null, salesOrderId);
  const packed = await db.orm.public.PackingList.where({ salesOrderId, status: "CONFIRMED" }).all();
  const productIds = [...position.ordered.keys()];
  const products = productIds.length ? await db.orm.public.Product.where((item) => item.id.in(productIds)).all() : [];
  const customer = await db.orm.public.Customer.where({ id: order.customerId }).first();

  return {
    salesOrderId,
    orderNumber: order.orderNumber,
    status: order.status,
    customerName: customer?.name ?? null,
    customLines: position.lines.filter((line) => line.isCustom || !line.productId).length,
    items: productIds.map((productId) => {
      const ordered = position.ordered.get(productId)!;
      const shipped = position.shipped.get(productId) ?? "0";
      const product = products.find((item) => item.id === productId);
      return {
        productId,
        sku: product?.sku ?? null,
        productName: product?.name ?? null,
        unit: product?.unit ?? null,
        ordered: dec(ordered),
        shipped: dec(shipped),
        delivered: dec(position.delivered.get(productId) ?? "0"),
        remaining: dec(subtractDecimalStrings(ordered, shipped)),
        packedReady: dec(packed.filter((list) => list.productId === productId).reduce((sum, list) => addDecimalStrings(sum, dec(list.totalQuantity)), "0")),
      };
    }),
    readyPackingLists: packed.map((list) => ({
      id: list.id,
      packingNumber: list.packingNumber,
      productId: list.productId,
      totalQuantity: dec(list.totalQuantity),
      packageCount: list.packageCount,
      locationId: list.locationId,
    })),
  };
}
