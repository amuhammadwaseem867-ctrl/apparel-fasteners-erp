/*
 * Inventory service: warehouses, storage locations, stock documents (the
 * ledger), balances, reservations and stock queries.
 *
 * Invariants (also enforced by CHECK constraints, see contract.prisma):
 * - balances change only inside postStockDocument / reservation functions,
 *   in one transaction, by atomic conditional UPDATEs that refuse to take
 *   available stock (onHand - reserved - qualityHold) below zero;
 * - every balance change writes an append-only StockMovement row with the
 *   signed delta and the resulting bucket balance;
 * - a document's idempotency key is unique: repeating a submission returns
 *   the original document and posts nothing;
 * - the audit event is written in the same transaction as the change.
 */

import { or } from "@prisma/orm-postgres/orm-client";

import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { findSqlQueryError } from "../core/errors/database-errors";
import {
  addDecimalStrings,
  decimalSign,
  normalizeDecimalString,
  subtractDecimalStrings,
  toPlainDecimalString,
} from "../core/utils/decimal";
import type {
  BalanceQuery,
  DocumentQuery,
  LocationInput,
  MovementQuery,
  ReservationInput,
  ReservationQuery,
  ReservationRelease,
  StockDocumentInput,
  WarehouseInput,
  WarehouseUpdate,
} from "./inventory.validation";
import {
  RESERVATION_DOCUMENT_TYPES,
  documentNumber,
  documentTypeRule,
  orderForLocking,
  quantityPrecisionError,
  type BalanceOperation,
  type PlannedOperation,
} from "./stock-rules";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface BalanceRow {
  onHand: string;
  reserved: string;
  qualityHold: string;
}

const BALANCE_SPEC = {
  onHand: "pg/text@1",
  reserved: "pg/text@1",
  qualityHold: "pg/text@1",
} as const;

function now() {
  return new Date().toISOString();
}

function notFound(message: string, code: string): AppError {
  return new AppError(message, { code, status: 404 });
}

/* ------------------------------------------------------------------ */
/* Warehouses and locations                                            */
/* ------------------------------------------------------------------ */

export async function listWarehouses(filters: { search: string; status: string }) {
  let query = db.orm.public.Warehouse;

  if (filters.status) {
    query = query.where({ status: filters.status });
  } else {
    query = query.where((warehouse) => warehouse.status.neq("ARCHIVED"));
  }

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    query = query.where((warehouse) => or(
      warehouse.code.ilike(pattern),
      warehouse.name.ilike(pattern),
    ));
  }

  const warehouses = await query.orderBy((warehouse) => warehouse.code.asc()).all();
  const ids = warehouses.map((warehouse) => warehouse.id);
  const locations = ids.length
    ? await db.orm.public.StorageLocation
      .where((location) => location.warehouseId.in(ids))
      .select("id", "warehouseId", "status")
      .all()
    : [];

  return warehouses.map((warehouse) => {
    const own = locations.filter((location) => location.warehouseId === warehouse.id);

    return {
      ...warehouse,
      locationCount: own.filter((location) => location.status !== "ARCHIVED").length,
    };
  });
}

export async function getWarehouse(id: string) {
  const warehouse = await db.orm.public.Warehouse.where({ id }).first();

  if (!warehouse) {
    throw notFound("Warehouse not found.", "WAREHOUSE_NOT_FOUND");
  }

  return warehouse;
}

export async function createWarehouse(input: WarehouseInput, actorId: string) {
  const code = input.code.toUpperCase();

  if (await db.orm.public.Warehouse.where({ code }).first()) {
    throw new AppError("A warehouse with that code already exists.", {
      code: "WAREHOUSE_CODE_EXISTS",
      status: 409,
    });
  }

  return db.transaction(async (tx) => {
    const warehouse = await tx.orm.public.Warehouse.create({
      code,
      name: input.name,
      warehouseType: input.warehouseType,
      address: input.address || null,
    });

    await recordAuditEvent({
      actorId,
      action: "WAREHOUSE_CREATED",
      entityType: "Warehouse",
      entityId: warehouse.id,
      metadata: { code },
    }, tx);

    return warehouse;
  });
}

export async function updateWarehouse(id: string, input: WarehouseUpdate, actorId: string) {
  const current = await getWarehouse(id);

  if (current.status === "ARCHIVED") {
    throw new AppError("Archived warehouses cannot be edited. Restore it first.", {
      code: "WAREHOUSE_ARCHIVED",
      status: 409,
    });
  }

  await db.transaction(async (tx) => {
    await tx.orm.public.Warehouse.where({ id }).update({
      name: input.name,
      warehouseType: input.warehouseType,
      address: input.address || null,
      updatedAt: now(),
    });

    await recordAuditEvent({
      actorId,
      action: "WAREHOUSE_UPDATED",
      entityType: "Warehouse",
      entityId: id,
      metadata: { code: current.code },
    }, tx);
  });

  return getWarehouse(id);
}

async function stockHeldAt(locationIds: string[]): Promise<boolean> {
  if (!locationIds.length) {
    return false;
  }

  const balance = await db.orm.public.StockBalance
    .where((row) => row.locationId.in(locationIds))
    .where((row) => row.onHand.gt("0"))
    .first();

  return Boolean(balance);
}

export async function setWarehouseStatus(id: string, status: string, actorId: string) {
  const current = await getWarehouse(id);

  if (current.status === status) {
    return current;
  }

  if (status === "ARCHIVED") {
    const locations = await db.orm.public.StorageLocation.where({ warehouseId: id }).select("id").all();

    if (await stockHeldAt(locations.map((location) => location.id))) {
      throw new AppError("This warehouse still holds stock. Transfer or adjust it out before archiving.", {
        code: "WAREHOUSE_HAS_STOCK",
        status: 409,
      });
    }
  }

  await db.transaction(async (tx) => {
    await tx.orm.public.Warehouse.where({ id }).update({ status, updatedAt: now() });
    await recordAuditEvent({
      actorId,
      action: "WAREHOUSE_STATUS_CHANGED",
      entityType: "Warehouse",
      entityId: id,
      metadata: { code: current.code, from: current.status, to: status },
    }, tx);
  });

  return getWarehouse(id);
}

export async function listLocations(filters: { warehouseId?: string; status: string }) {
  let query = db.orm.public.StorageLocation;

  if (filters.warehouseId) {
    query = query.where({ warehouseId: filters.warehouseId });
  }

  if (filters.status) {
    query = query.where({ status: filters.status });
  } else {
    query = query.where((location) => location.status.neq("ARCHIVED"));
  }

  const locations = await query.orderBy((location) => location.code.asc()).all();
  const warehouseIds = [...new Set(locations.map((location) => location.warehouseId))];
  const warehouses = warehouseIds.length
    ? await db.orm.public.Warehouse.where((warehouse) => warehouse.id.in(warehouseIds)).all()
    : [];
  const byId = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));

  return locations.map((location) => ({
    ...location,
    warehouseCode: byId.get(location.warehouseId)?.code ?? null,
    warehouseName: byId.get(location.warehouseId)?.name ?? null,
    warehouseStatus: byId.get(location.warehouseId)?.status ?? null,
  }));
}

async function getLocation(id: string) {
  const location = await db.orm.public.StorageLocation.where({ id }).first();

  if (!location) {
    throw notFound("Storage location not found.", "LOCATION_NOT_FOUND");
  }

  return location;
}

export async function createLocation(input: LocationInput, actorId: string) {
  const warehouse = await getWarehouse(input.warehouseId);

  if (warehouse.status !== "ACTIVE") {
    throw new AppError("Locations can only be added to an active warehouse.", {
      code: "WAREHOUSE_NOT_ACTIVE",
      status: 409,
    });
  }

  const code = input.code.toUpperCase();

  if (await db.orm.public.StorageLocation.where({ warehouseId: warehouse.id, code }).first()) {
    throw new AppError("That location code already exists in this warehouse.", {
      code: "LOCATION_CODE_EXISTS",
      status: 409,
    });
  }

  return db.transaction(async (tx) => {
    const location = await tx.orm.public.StorageLocation.create({
      warehouseId: warehouse.id,
      code,
      name: input.name,
    });

    await recordAuditEvent({
      actorId,
      action: "LOCATION_CREATED",
      entityType: "StorageLocation",
      entityId: location.id,
      metadata: { warehouse: warehouse.code, code },
    }, tx);

    return location;
  });
}

export async function updateLocation(id: string, name: string, actorId: string) {
  const current = await getLocation(id);

  await db.transaction(async (tx) => {
    await tx.orm.public.StorageLocation.where({ id }).update({ name, updatedAt: now() });
    await recordAuditEvent({
      actorId,
      action: "LOCATION_UPDATED",
      entityType: "StorageLocation",
      entityId: id,
      metadata: { code: current.code },
    }, tx);
  });

  return getLocation(id);
}

export async function setLocationStatus(id: string, status: string, actorId: string) {
  const current = await getLocation(id);

  if (current.status === status) {
    return current;
  }

  if (status === "ARCHIVED" && await stockHeldAt([id])) {
    throw new AppError("This location still holds stock. Transfer or adjust it out before archiving.", {
      code: "LOCATION_HAS_STOCK",
      status: 409,
    });
  }

  await db.transaction(async (tx) => {
    await tx.orm.public.StorageLocation.where({ id }).update({ status, updatedAt: now() });
    await recordAuditEvent({
      actorId,
      action: "LOCATION_STATUS_CHANGED",
      entityType: "StorageLocation",
      entityId: id,
      metadata: { code: current.code, from: current.status, to: status },
    }, tx);
  });

  return getLocation(id);
}

/* ------------------------------------------------------------------ */
/* Balance operations (inside a transaction)                           */
/* ------------------------------------------------------------------ */

const INCREASES = new Set<BalanceOperation>(["increase-on-hand", "increase-hold", "increase-reserved"]);

async function firstRow<T>(tx: Tx, plan: unknown): Promise<T | undefined> {
  const rows = (await tx.query(plan as any)) as unknown as T[];
  return rows[0];
}

async function currentBalance(tx: Tx, productId: string, locationId: string): Promise<BalanceRow> {
  const row = await firstRow<BalanceRow>(tx, db.raw.sql`
    select "onHand"::text as "onHand", "reserved"::text as "reserved", "qualityHold"::text as "qualityHold" from erp_stock_balances
    where "productId" = ${productId}::uuid and "locationId" = ${locationId}::uuid
  `.returnsRow(BALANCE_SPEC).build());

  return row ?? { onHand: "0", reserved: "0", qualityHold: "0" };
}

function available(balance: BalanceRow): string {
  return subtractDecimalStrings(
    subtractDecimalStrings(balance.onHand, balance.reserved),
    balance.qualityHold,
  );
}

async function applyOperation(tx: Tx, op: PlannedOperation): Promise<BalanceRow> {
  const { productId: p, locationId: l, quantity: q } = op;
  let plan;

  switch (op.operation) {
    case "increase-on-hand":
      plan = db.raw.sql`
        insert into erp_stock_balances (id, "productId", "locationId", "onHand", "updatedAt")
        values (gen_random_uuid(), ${p}::uuid, ${l}::uuid, ${q}::numeric, now())
        on conflict ("productId", "locationId") do update
          set "onHand" = erp_stock_balances."onHand" + excluded."onHand", "updatedAt" = now()
        returning "onHand"::text as "onHand", "reserved"::text as "reserved", "qualityHold"::text as "qualityHold"`;
      break;
    case "decrease-available":
      plan = db.raw.sql`
        update erp_stock_balances set "onHand" = "onHand" - ${q}::numeric, "updatedAt" = now()
        where "productId" = ${p}::uuid and "locationId" = ${l}::uuid
          and "onHand" - "reserved" - "qualityHold" >= ${q}::numeric
        returning "onHand"::text as "onHand", "reserved"::text as "reserved", "qualityHold"::text as "qualityHold"`;
      break;
    case "consume-reserved":
      plan = db.raw.sql`
        update erp_stock_balances
          set "onHand" = "onHand" - ${q}::numeric, "reserved" = "reserved" - ${q}::numeric, "updatedAt" = now()
        where "productId" = ${p}::uuid and "locationId" = ${l}::uuid and "reserved" >= ${q}::numeric
        returning "onHand"::text as "onHand", "reserved"::text as "reserved", "qualityHold"::text as "qualityHold"`;
      break;
    case "increase-hold":
      plan = db.raw.sql`
        update erp_stock_balances set "qualityHold" = "qualityHold" + ${q}::numeric, "updatedAt" = now()
        where "productId" = ${p}::uuid and "locationId" = ${l}::uuid
          and "onHand" - "reserved" - "qualityHold" >= ${q}::numeric
        returning "onHand"::text as "onHand", "reserved"::text as "reserved", "qualityHold"::text as "qualityHold"`;
      break;
    case "decrease-hold":
      plan = db.raw.sql`
        update erp_stock_balances set "qualityHold" = "qualityHold" - ${q}::numeric, "updatedAt" = now()
        where "productId" = ${p}::uuid and "locationId" = ${l}::uuid and "qualityHold" >= ${q}::numeric
        returning "onHand"::text as "onHand", "reserved"::text as "reserved", "qualityHold"::text as "qualityHold"`;
      break;
    case "scrap-held":
      plan = db.raw.sql`
        update erp_stock_balances
          set "qualityHold" = "qualityHold" - ${q}::numeric, "onHand" = "onHand" - ${q}::numeric, "updatedAt" = now()
        where "productId" = ${p}::uuid and "locationId" = ${l}::uuid and "qualityHold" >= ${q}::numeric
        returning "onHand"::text as "onHand", "reserved"::text as "reserved", "qualityHold"::text as "qualityHold"`;
      break;
    case "increase-reserved":
      plan = db.raw.sql`
        update erp_stock_balances set "reserved" = "reserved" + ${q}::numeric, "updatedAt" = now()
        where "productId" = ${p}::uuid and "locationId" = ${l}::uuid
          and "onHand" - "reserved" - "qualityHold" >= ${q}::numeric
        returning "onHand"::text as "onHand", "reserved"::text as "reserved", "qualityHold"::text as "qualityHold"`;
      break;
    case "decrease-reserved":
      plan = db.raw.sql`
        update erp_stock_balances set "reserved" = "reserved" - ${q}::numeric, "updatedAt" = now()
        where "productId" = ${p}::uuid and "locationId" = ${l}::uuid and "reserved" >= ${q}::numeric
        returning "onHand"::text as "onHand", "reserved"::text as "reserved", "qualityHold"::text as "qualityHold"`;
      break;
  }

  const row = await firstRow<BalanceRow>(tx, plan.returnsRow(BALANCE_SPEC).build());

  if (row) {
    return row;
  }

  // The conditional update matched nothing: report what is actually there.
  const balance = await currentBalance(tx, p, l);
  const bucketAvailable = op.operation === "consume-reserved" || op.operation === "decrease-reserved"
    ? balance.reserved
    : op.operation === "decrease-hold" || op.operation === "scrap-held"
      ? balance.qualityHold
      : available(balance);

  const requested = normalizeDecimalString(q);
  const have = normalizeDecimalString(bucketAvailable);
  const what = op.operation === "consume-reserved" || op.operation === "decrease-reserved"
    ? "reserved"
    : op.operation === "decrease-hold" || op.operation === "scrap-held"
      ? "on quality hold"
      : "available";

  throw new AppError(
    `Not enough stock at this location: requested ${requested}, ${what} ${have}.`,
    {
      code: "INSUFFICIENT_STOCK",
      status: 409,
      details: {
        productId: p,
        locationId: l,
        requested,
        available: have,
        onHand: normalizeDecimalString(balance.onHand),
        reserved: normalizeDecimalString(balance.reserved),
        qualityHold: normalizeDecimalString(balance.qualityHold),
      },
    },
  );
}

/* Which buckets an operation moves, and in which direction. */
const BUCKET_EFFECTS: Record<BalanceOperation, Array<["ON_HAND" | "RESERVED" | "QUALITY_HOLD", 1 | -1]>> = {
  "increase-on-hand": [["ON_HAND", 1]],
  "decrease-available": [["ON_HAND", -1]],
  "consume-reserved": [["ON_HAND", -1], ["RESERVED", -1]],
  "increase-hold": [["QUALITY_HOLD", 1]],
  "decrease-hold": [["QUALITY_HOLD", -1]],
  "scrap-held": [["QUALITY_HOLD", -1], ["ON_HAND", -1]],
  "increase-reserved": [["RESERVED", 1]],
  "decrease-reserved": [["RESERVED", -1]],
};

const BUCKET_FIELD = { ON_HAND: "onHand", RESERVED: "reserved", QUALITY_HOLD: "qualityHold" } as const;

async function writeMovements(
  tx: Tx,
  documentId: string,
  lineNo: number,
  op: PlannedOperation,
  after: BalanceRow,
  actorId: string,
) {
  for (const [bucket, sign] of BUCKET_EFFECTS[op.operation]) {
    await tx.orm.public.StockMovement.create({
      documentId,
      lineNo,
      movementType: op.movementType,
      productId: op.productId,
      locationId: op.locationId,
      bucket,
      quantityDelta: sign < 0 ? `-${op.quantity}` : op.quantity,
      balanceAfter: after[BUCKET_FIELD[bucket]],
      reservationId: op.reservationId ?? null,
      createdBy: actorId,
    });
  }
}

export async function allocateDocumentNumber(tx: Tx, prefix: string): Promise<string> {
  const year = new Date().getUTCFullYear();
  const key = `${prefix}-${year}`;
  const row = await firstRow<{ value: string }>(tx, db.raw.sql`
    insert into erp_document_sequences (key, "nextValue", "updatedAt") values (${key}, 2, now())
    on conflict (key) do update
      set "nextValue" = erp_document_sequences."nextValue" + 1, "updatedAt" = now()
    returning ("nextValue" - 1)::text as value
  `.returnsRow({ value: "pg/text@1" }).build());

  return documentNumber(prefix, year, Number(row!.value));
}

function isIdempotencyConflict(error: unknown): boolean {
  const sqlError = findSqlQueryError(error) as { sqlState?: string; constraint?: string } | null;

  return sqlError?.sqlState === "23505" && Boolean(sqlError.constraint?.includes("idempotencyKey"));
}

async function existingDocument(idempotencyKey: string, documentType: string) {
  const document = await db.orm.public.StockDocument.where({ idempotencyKey }).first();

  if (document && document.documentType !== documentType) {
    throw new AppError("This submission key was already used for a different transaction.", {
      code: "IDEMPOTENCY_KEY_REUSED",
      status: 409,
    });
  }

  return document;
}

/* ------------------------------------------------------------------ */
/* Posting stock documents                                             */
/* ------------------------------------------------------------------ */

interface LineContext {
  productId: string;
  locationId: string;
  toLocationId?: string;
  quantity: number;
  reservationId?: string;
}

async function loadReferences(lines: LineContext[]) {
  const productIds = [...new Set(lines.map((line) => line.productId))];
  const locationIds = [...new Set(lines.flatMap((line) => [line.locationId, line.toLocationId].filter(Boolean) as string[]))];

  const products = await db.orm.public.Product.where((product) => product.id.in(productIds)).all();
  const locations = await db.orm.public.StorageLocation.where((location) => location.id.in(locationIds)).all();
  const warehouseIds = [...new Set(locations.map((location) => location.warehouseId))];
  const warehouses = warehouseIds.length
    ? await db.orm.public.Warehouse.where((warehouse) => warehouse.id.in(warehouseIds)).all()
    : [];

  return {
    products: new Map(products.map((product) => [product.id, product])),
    locations: new Map(locations.map((location) => [location.id, location])),
    warehouses: new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])),
  };
}

type References = Awaited<ReturnType<typeof loadReferences>>;

function validateLine(
  refs: References,
  line: LineContext,
  index: number,
  increasesStock: boolean,
) {
  const product = refs.products.get(line.productId);

  if (!product) {
    throw new AppError(`Line ${index + 1}: item not found.`, { code: "PRODUCT_NOT_FOUND", status: 400 });
  }

  if (increasesStock && product.status === "ARCHIVED") {
    throw new AppError(`Line ${index + 1}: ${product.sku} is archived and cannot receive stock.`, {
      code: "PRODUCT_ARCHIVED",
      status: 409,
    });
  }

  const precision = quantityPrecisionError(Math.abs(line.quantity), product.unit);
  if (precision) {
    throw new AppError(`Line ${index + 1}: ${precision}`, { code: "QUANTITY_PRECISION", status: 400 });
  }

  for (const [locationId, receives] of [[line.locationId, increasesStock], [line.toLocationId, true]] as const) {
    if (!locationId) {
      continue;
    }

    const location = refs.locations.get(locationId);
    const warehouse = location && refs.warehouses.get(location.warehouseId);

    if (!location || !warehouse) {
      throw new AppError(`Line ${index + 1}: storage location not found.`, { code: "LOCATION_NOT_FOUND", status: 400 });
    }

    if (receives && (location.status !== "ACTIVE" || warehouse.status !== "ACTIVE")) {
      throw new AppError(`Line ${index + 1}: ${warehouse.code}/${location.code} is not active and cannot receive stock.`, {
        code: "LOCATION_NOT_ACTIVE",
        status: 409,
      });
    }
  }

  return product;
}

async function consumeReservation(tx: Tx, line: LineContext, quantity: string) {
  const row = await firstRow<{ id: string }>(tx, db.raw.sql`
    update erp_stock_reservations
      set "consumedQuantity" = "consumedQuantity" + ${quantity}::numeric,
          "status" = case
            when "quantity" - ("consumedQuantity" + ${quantity}::numeric) - "releasedQuantity" = 0
              then 'CONSUMED' else "status" end,
          "updatedAt" = now()
    where id = ${line.reservationId!}::uuid and "status" = 'ACTIVE'
      and "productId" = ${line.productId}::uuid and "locationId" = ${line.locationId}::uuid
      and "quantity" - "consumedQuantity" - "releasedQuantity" >= ${quantity}::numeric
    returning id::text as id
  `.returnsRow({ id: "pg/text@1" }).build());

  if (!row) {
    throw new AppError(
      "The reservation is not active for this item and location, or has less open quantity than requested.",
      { code: "RESERVATION_UNAVAILABLE", status: 409, details: { reservationId: line.reservationId } },
    );
  }
}

/*
 * Validates and posts one stock document inside the caller's transaction,
 * so modules that change stock together with their own records (quality,
 * packing, dispatch) commit both or neither. Returns the new document id.
 */
export async function postStockDocumentInTransaction(tx: Tx, input: StockDocumentInput, actorId: string) {
  const rule = documentTypeRule(input.documentType);
  const refs = await loadReferences(input.lines);
  const increasing = rule.operation === "increase-on-hand"
    || rule.operation === "count"
    || rule.operation === "signed-adjustment";

  input.lines.forEach((line, index) => {
    const positive = line.quantity > 0;
    validateLine(refs, line, index, increasing && (rule.operation !== "signed-adjustment" || positive));
  });

  const number = await allocateDocumentNumber(tx, rule.prefix);
  const document = await tx.orm.public.StockDocument.create({
    documentNumber: number,
    documentType: input.documentType,
    reference: input.reference || null,
    reason: input.reason || null,
    notes: input.notes || null,
    sourceType: input.sourceType || null,
    sourceId: input.sourceId || null,
    idempotencyKey: input.idempotencyKey,
    createdBy: actorId,
  });

  // Build operations with their ledger line numbers (input order).
  const planned: Array<PlannedOperation & { lineNo: number; line: LineContext }> = [];
  let lineNo = 0;

  for (const line of input.lines) {
    const magnitude = toPlainDecimalString(Math.abs(line.quantity));

    if (rule.operation === "count") {
      // Lock the balance, then post the difference to the counted quantity.
      await tx.query(db.raw.sql`
        select id::text as id from erp_stock_balances
        where "productId" = ${line.productId}::uuid and "locationId" = ${line.locationId}::uuid
        for update
      `.returnsRow({ id: "pg/text@1" }).build());

      const balance = await currentBalance(tx, line.productId, line.locationId);
      const delta = subtractDecimalStrings(toPlainDecimalString(line.quantity), balance.onHand);
      const sign = decimalSign(delta);

      if (sign !== 0) {
        planned.push({
          lineNo: ++lineNo,
          line,
          operation: sign > 0 ? "increase-on-hand" : "decrease-available",
          productId: line.productId,
          locationId: line.locationId,
          quantity: delta.replace(/^-/, ""),
          movementType: input.documentType,
        });
      }
      continue;
    }

    const operation: BalanceOperation = rule.operation === "signed-adjustment"
      ? (line.quantity > 0 ? "increase-on-hand" : "decrease-available")
      : line.reservationId
        ? "consume-reserved"
        : rule.operation;

    planned.push({
      lineNo: ++lineNo,
      line,
      operation,
      productId: line.productId,
      locationId: line.locationId,
      quantity: magnitude,
      movementType: input.documentType,
      reservationId: line.reservationId,
    });

    if ("destination" in rule && rule.destination && line.toLocationId) {
      planned.push({
        lineNo: ++lineNo,
        line,
        operation: rule.destination,
        productId: line.productId,
        locationId: line.toLocationId,
        quantity: magnitude,
        movementType: input.documentType,
      });
    }
  }

  for (const op of orderForLocking(planned)) {
    if (op.operation === "consume-reserved") {
      await consumeReservation(tx, op.line, op.quantity);
    }

    const after = await applyOperation(tx, op);
    await writeMovements(tx, document.id, op.lineNo, op, after, actorId);
  }

  await recordAuditEvent({
    actorId,
    action: "STOCK_DOCUMENT_POSTED",
    entityType: "StockDocument",
    entityId: document.id,
    metadata: { documentNumber: number, documentType: input.documentType, lines: input.lines.length },
  }, tx);

  return document.id;
}

export async function postStockDocument(input: StockDocumentInput, actorId: string) {
  const replay = await existingDocument(input.idempotencyKey, input.documentType);
  if (replay) {
    return { document: await getStockDocument(replay.id), replayed: true };
  }

  // These sources are posted only by their own modules, inside their transactions.
  if (input.sourceType && ["QualityInspection", "PackingList", "Shipment", "StockReservation"].includes(input.sourceType)) {
    throw new AppError(`Stock documents for a ${input.sourceType} are posted by that module, not directly.`, {
      code: "SOURCE_NOT_ALLOWED",
      status: 400,
    });
  }

  if (input.sourceType === "ProductionOrder" && !["MATERIAL_ISSUE", "MATERIAL_RETURN"].includes(input.documentType)) {
    throw new AppError("Only material issues and returns can be posted against a production order.", {
      code: "SOURCE_NOT_ALLOWED",
      status: 400,
    });
  }

  try {
    const documentId = await db.transaction(async (tx) => {
      if (input.sourceType === "ProductionOrder") {
        // Shares the lock production status changes take, so an order cannot
        // be cancelled or completed while material is being issued to it.
        const orders = (await tx.query(db.raw.sql`
          select status from erp_production_orders
          where id::text = ${input.sourceId ?? ""} for share
        `.returnsRow({ status: "pg/text@1" }).build() as never)) as unknown as Array<{ status: string }>;

        if (!orders.length || !["RELEASED", "IN_PROGRESS"].includes(orders[0].status)) {
          throw new AppError("Material can only be issued to or returned from a released or in-progress production order.", {
            code: "PRODUCTION_ORDER_NOT_OPEN",
            status: 409,
          });
        }
      }

      return postStockDocumentInTransaction(tx, input, actorId);
    });

    return { document: await getStockDocument(documentId), replayed: false };
  } catch (error) {
    if (isIdempotencyConflict(error)) {
      const original = await existingDocument(input.idempotencyKey, input.documentType);
      if (original) {
        return { document: await getStockDocument(original.id), replayed: true };
      }
    }

    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Reservations                                                        */
/* ------------------------------------------------------------------ */

async function validateReservationSource(input: ReservationInput) {
  if (!input.salesOrderId) {
    if (input.salesOrderLineId) {
      throw new AppError("A sales order line needs its sales order.", { code: "VALIDATION_FAILED", status: 400 });
    }
    return;
  }

  const order = await db.orm.public.SalesOrder.where({ id: input.salesOrderId }).first();

  if (!order) {
    throw notFound("Sales order not found.", "SALES_ORDER_NOT_FOUND");
  }

  if (order.status === "CANCELLED") {
    throw new AppError("Stock cannot be reserved for a cancelled order.", {
      code: "SALES_ORDER_CANCELLED",
      status: 409,
    });
  }

  if (input.salesOrderLineId) {
    const line = await db.orm.public.SalesOrderLine
      .where({ id: input.salesOrderLineId, salesOrderId: order.id })
      .first();

    if (!line) {
      throw new AppError("That line does not belong to this sales order.", {
        code: "SALES_ORDER_LINE_NOT_FOUND",
        status: 400,
      });
    }

    if (line.productId && line.productId !== input.productId) {
      throw new AppError("The reserved item does not match the order line's item.", {
        code: "RESERVATION_ITEM_MISMATCH",
        status: 400,
      });
    }
  }
}

export async function createReservation(input: ReservationInput, actorId: string) {
  const replay = await existingDocument(input.idempotencyKey, "RESERVATION");
  if (replay) {
    const reservation = await db.orm.public.StockReservation
      .where({ id: replay.sourceId ?? "" })
      .first();
    return { reservation, replayed: true };
  }

  const refs = await loadReferences([input]);
  validateLine(refs, input, 0, true);
  await validateReservationSource(input);

  const quantity = toPlainDecimalString(input.quantity);

  try {
    const reservationId = await db.transaction(async (tx) => {
      const reservation = await tx.orm.public.StockReservation.create({
        productId: input.productId,
        locationId: input.locationId,
        salesOrderId: input.salesOrderId ?? null,
        salesOrderLineId: input.salesOrderLineId ?? null,
        quantity,
        notes: input.notes || null,
        createdBy: actorId,
      });

      const number = await allocateDocumentNumber(tx, RESERVATION_DOCUMENT_TYPES.RESERVATION.prefix);
      const document = await tx.orm.public.StockDocument.create({
        documentNumber: number,
        documentType: "RESERVATION",
        reference: input.salesOrderId ?? null,
        notes: input.notes || null,
        sourceType: "StockReservation",
        sourceId: reservation.id,
        idempotencyKey: input.idempotencyKey,
        createdBy: actorId,
      });

      const op: PlannedOperation = {
        operation: "increase-reserved",
        productId: input.productId,
        locationId: input.locationId,
        quantity,
        movementType: "RESERVATION",
        reservationId: reservation.id,
      };
      const after = await applyOperation(tx, op);
      await writeMovements(tx, document.id, 1, op, after, actorId);

      await recordAuditEvent({
        actorId,
        action: "STOCK_RESERVED",
        entityType: "StockReservation",
        entityId: reservation.id,
        metadata: { documentNumber: number, quantity, salesOrderId: input.salesOrderId ?? null },
      }, tx);

      return reservation.id;
    });

    return { reservation: await getReservation(reservationId), replayed: false };
  } catch (error) {
    if (isIdempotencyConflict(error)) {
      const original = await existingDocument(input.idempotencyKey, "RESERVATION");
      if (original?.sourceId) {
        return { reservation: await getReservation(original.sourceId), replayed: true };
      }
    }

    throw error;
  }
}

export async function getReservation(id: string) {
  const reservation = await db.orm.public.StockReservation.where({ id }).first();

  if (!reservation) {
    throw notFound("Reservation not found.", "RESERVATION_NOT_FOUND");
  }

  return {
    ...reservation,
    quantity: normalizeDecimalString(String(reservation.quantity)),
    consumedQuantity: normalizeDecimalString(String(reservation.consumedQuantity)),
    releasedQuantity: normalizeDecimalString(String(reservation.releasedQuantity)),
    openQuantity: normalizeDecimalString(subtractDecimalStrings(
      subtractDecimalStrings(String(reservation.quantity), String(reservation.consumedQuantity)),
      String(reservation.releasedQuantity),
    )),
  };
}

export async function releaseReservation(id: string, input: ReservationRelease, actorId: string) {
  const replay = await existingDocument(input.idempotencyKey, "RESERVATION_RELEASE");
  if (replay) {
    return { reservation: await getReservation(id), replayed: true };
  }

  const current = await getReservation(id);

  if (current.status !== "ACTIVE") {
    throw new AppError("Only active reservations can be released.", {
      code: "RESERVATION_NOT_ACTIVE",
      status: 409,
    });
  }

  const quantity = input.quantity !== undefined
    ? toPlainDecimalString(input.quantity)
    : current.openQuantity;

  if (decimalSign(quantity) <= 0) {
    throw new AppError("Nothing is left to release on this reservation.", {
      code: "RESERVATION_NOTHING_OPEN",
      status: 409,
    });
  }

  try {
    await db.transaction(async (tx) => {
      const updated = await firstRow<{ id: string }>(tx, db.raw.sql`
        update erp_stock_reservations
          set "releasedQuantity" = "releasedQuantity" + ${quantity}::numeric,
              "status" = case
                when "quantity" - "consumedQuantity" - ("releasedQuantity" + ${quantity}::numeric) = 0
                  then 'RELEASED' else "status" end,
              "updatedAt" = now()
        where id = ${id}::uuid and "status" = 'ACTIVE'
          and "quantity" - "consumedQuantity" - "releasedQuantity" >= ${quantity}::numeric
        returning id::text as id
      `.returnsRow({ id: "pg/text@1" }).build());

      if (!updated) {
        throw new AppError("The reservation has less open quantity than requested, or is no longer active.", {
          code: "RESERVATION_UNAVAILABLE",
          status: 409,
        });
      }

      const number = await allocateDocumentNumber(tx, RESERVATION_DOCUMENT_TYPES.RESERVATION_RELEASE.prefix);
      const document = await tx.orm.public.StockDocument.create({
        documentNumber: number,
        documentType: "RESERVATION_RELEASE",
        notes: input.notes || null,
        sourceType: "StockReservation",
        sourceId: id,
        idempotencyKey: input.idempotencyKey,
        createdBy: actorId,
      });

      const op: PlannedOperation = {
        operation: "decrease-reserved",
        productId: current.productId,
        locationId: current.locationId,
        quantity,
        movementType: "RESERVATION_RELEASE",
        reservationId: id,
      };
      const after = await applyOperation(tx, op);
      await writeMovements(tx, document.id, 1, op, after, actorId);

      await recordAuditEvent({
        actorId,
        action: "STOCK_RESERVATION_RELEASED",
        entityType: "StockReservation",
        entityId: id,
        metadata: { documentNumber: number, quantity },
      }, tx);
    });
  } catch (error) {
    if (!isIdempotencyConflict(error)) {
      throw error;
    }
  }

  return { reservation: await getReservation(id), replayed: false };
}

/*
 * Releases every open reservation of a sales order (used when an order is
 * cancelled). Each release is its own idempotent document.
 */
export async function releaseOrderReservations(salesOrderId: string, actorId: string) {
  const open = await db.orm.public.StockReservation
    .where({ salesOrderId, status: "ACTIVE" })
    .all();

  for (const reservation of open) {
    await releaseReservation(
      reservation.id,
      { idempotencyKey: `order-cancel:${salesOrderId}:${reservation.id}` },
      actorId,
    );
  }

  return open.length;
}

export async function listReservations(filters: ReservationQuery) {
  let query = db.orm.public.StockReservation;

  if (filters.productId) {
    query = query.where({ productId: filters.productId });
  }
  if (filters.salesOrderId) {
    query = query.where({ salesOrderId: filters.salesOrderId });
  }
  if (filters.status) {
    query = query.where({ status: filters.status });
  }

  const rows = await query
    .orderBy((row) => row.createdAt.desc())
    .offset((filters.page - 1) * filters.pageSize)
    .limit(filters.pageSize + 1)
    .all();
  const page = rows.slice(0, filters.pageSize);
  const enrich = await enrichment(page);

  return {
    reservations: await Promise.all(page.map(async (row) => ({
      ...(await getReservation(row.id)),
      ...enrich(row),
    }))),
    page: filters.page,
    pageSize: filters.pageSize,
    hasMore: rows.length > filters.pageSize,
  };
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

async function enrichment(rows: Array<{ productId: string; locationId: string }>) {
  const productIds = [...new Set(rows.map((row) => row.productId))];
  const locationIds = [...new Set(rows.map((row) => row.locationId))];
  const products = productIds.length
    ? await db.orm.public.Product.where((product) => product.id.in(productIds)).all()
    : [];
  const locations = locationIds.length
    ? await db.orm.public.StorageLocation.where((location) => location.id.in(locationIds)).all()
    : [];
  const warehouseIds = [...new Set(locations.map((location) => location.warehouseId))];
  const warehouses = warehouseIds.length
    ? await db.orm.public.Warehouse.where((warehouse) => warehouse.id.in(warehouseIds)).all()
    : [];

  const productMap = new Map(products.map((product) => [product.id, product]));
  const locationMap = new Map(locations.map((location) => [location.id, location]));
  const warehouseMap = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));

  return (row: { productId: string; locationId: string }) => {
    const product = productMap.get(row.productId);
    const location = locationMap.get(row.locationId);
    const warehouse = location ? warehouseMap.get(location.warehouseId) : undefined;

    return {
      sku: product?.sku ?? null,
      productName: product?.name ?? null,
      unit: product?.unit ?? null,
      category: product?.category ?? null,
      locationCode: location?.code ?? null,
      warehouseId: warehouse?.id ?? null,
      warehouseCode: warehouse?.code ?? null,
      warehouseName: warehouse?.name ?? null,
    };
  };
}

export async function listBalances(filters: BalanceQuery) {
  let query = db.orm.public.StockBalance;

  if (filters.productId) {
    query = query.where({ productId: filters.productId });
  }
  if (filters.locationId) {
    query = query.where({ locationId: filters.locationId });
  }
  if (filters.warehouseType) {
    const warehouses = await db.orm.public.Warehouse.where({ warehouseType: filters.warehouseType }).select("id").all();
    const warehouseIds = warehouses.map((warehouse) => warehouse.id);
    const locations = warehouseIds.length
      ? await db.orm.public.StorageLocation.where((location) => location.warehouseId.in(warehouseIds)).select("id").all()
      : [];
    if (!locations.length) {
      return { balances: [], page: filters.page, pageSize: filters.pageSize, hasMore: false };
    }
    query = query.where((row) => row.locationId.in(locations.map((location) => location.id)));
  }
  if (filters.warehouseId) {
    const locations = await db.orm.public.StorageLocation.where({ warehouseId: filters.warehouseId }).select("id").all();
    const ids = locations.map((location) => location.id);
    if (!ids.length) {
      return { balances: [], page: filters.page, pageSize: filters.pageSize, hasMore: false };
    }
    query = query.where((row) => row.locationId.in(ids));
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    const products = await db.orm.public.Product
      .where((product) => or(product.sku.ilike(pattern), product.name.ilike(pattern)))
      .select("id")
      .all();
    const ids = products.map((product) => product.id);
    if (!ids.length) {
      return { balances: [], page: filters.page, pageSize: filters.pageSize, hasMore: false };
    }
    query = query.where((row) => row.productId.in(ids));
  }

  const rows = await query
    .orderBy((row) => row.updatedAt.desc())
    .offset((filters.page - 1) * filters.pageSize)
    .limit(filters.pageSize + 1)
    .all();
  const page = rows.slice(0, filters.pageSize);
  const enrich = await enrichment(page);

  return {
    balances: page.map((row) => {
      const balance = { onHand: String(row.onHand), reserved: String(row.reserved), qualityHold: String(row.qualityHold) };

      return {
        id: row.id,
        productId: row.productId,
        locationId: row.locationId,
        onHand: normalizeDecimalString(balance.onHand),
        reserved: normalizeDecimalString(balance.reserved),
        qualityHold: normalizeDecimalString(balance.qualityHold),
        available: normalizeDecimalString(available(balance)),
        updatedAt: row.updatedAt,
        ...enrich(row),
      };
    }),
    page: filters.page,
    pageSize: filters.pageSize,
    hasMore: rows.length > filters.pageSize,
  };
}

interface ProductStockRow {
  id: string;
  sku: string;
  name: string;
  unit: string;
  category: string;
  minimumStock: string;
  onHand: string;
  reserved: string;
  qualityHold: string;
  locations: string;
}

/*
 * Stock position per item (all locations), aggregated in the database.
 * Totals are reported per unit of measure: adding pieces to metres would
 * produce a meaningless number.
 */
export async function getStockSummary(options: { includeItems?: boolean } = {}) {
  const rows = (await db.runtime().query(db.raw.sql`
    select p.id::text as id, p.sku, p.name, p.unit, p.category,
           p."minimumStock"::text as "minimumStock",
           coalesce(sum(b."onHand"), 0)::text as "onHand",
           coalesce(sum(b."reserved"), 0)::text as "reserved",
           coalesce(sum(b."qualityHold"), 0)::text as "qualityHold",
           count(b.id)::text as locations
    from erp_products p
    left join erp_stock_balances b on b."productId" = p.id
    where p.status <> 'ARCHIVED'
    group by p.id
  `.returnsRow({
    id: "pg/text@1", sku: "pg/text@1", name: "pg/text@1", unit: "pg/text@1", category: "pg/text@1",
    minimumStock: "pg/text@1", onHand: "pg/text@1", reserved: "pg/text@1", qualityHold: "pg/text@1",
    locations: "pg/text@1",
  }).build())) as unknown as ProductStockRow[];

  const items = rows.map((row) => {
    const free = available(row);
    const minimum = row.minimumStock;
    const tracked = Number(row.locations) > 0 || decimalSign(minimum) > 0;
    const outOfStock = tracked && decimalSign(free) <= 0;
    const lowStock = !outOfStock && decimalSign(minimum) > 0
      && decimalSign(subtractDecimalStrings(free, minimum)) < 0;

    return {
      productId: row.id,
      sku: row.sku,
      name: row.name,
      unit: row.unit,
      category: row.category,
      minimumStock: normalizeDecimalString(minimum),
      onHand: normalizeDecimalString(row.onHand),
      reserved: normalizeDecimalString(row.reserved),
      qualityHold: normalizeDecimalString(row.qualityHold),
      available: normalizeDecimalString(free),
      lowStock,
      outOfStock,
      tracked,
    };
  });

  const byUnit = new Map<string, { unit: string; onHand: string; reserved: string; qualityHold: string; available: string; items: number }>();

  for (const item of items.filter((entry) => entry.tracked)) {
    const total = byUnit.get(item.unit) ?? { unit: item.unit, onHand: "0", reserved: "0", qualityHold: "0", available: "0", items: 0 };
    total.onHand = addDecimalStrings(total.onHand, item.onHand);
    total.reserved = addDecimalStrings(total.reserved, item.reserved);
    total.qualityHold = addDecimalStrings(total.qualityHold, item.qualityHold);
    total.available = addDecimalStrings(total.available, item.available);
    total.items += 1;
    byUnit.set(item.unit, total);
  }

  return {
    itemCount: items.length,
    trackedItemCount: items.filter((item) => item.tracked).length,
    lowStockCount: items.filter((item) => item.lowStock).length,
    outOfStockCount: items.filter((item) => item.outOfStock).length,
    totalsByUnit: [...byUnit.values()].sort((a, b) => a.unit.localeCompare(b.unit)),
    alerts: items
      .filter((item) => item.lowStock || item.outOfStock)
      .sort((a, b) => Number(b.outOfStock) - Number(a.outOfStock) || a.sku.localeCompare(b.sku))
      .slice(0, 100),
    ...(options.includeItems ? { items } : {}),
  };
}

export async function listMovements(filters: MovementQuery) {
  let query = db.orm.public.StockMovement;

  if (filters.productId) {
    query = query.where({ productId: filters.productId });
  }
  if (filters.locationId) {
    query = query.where({ locationId: filters.locationId });
  }
  if (filters.documentType) {
    query = query.where({ movementType: filters.documentType });
  }
  if (filters.dateFrom) {
    query = query.where((row) => row.createdAt.gte(`${filters.dateFrom}T00:00:00.000Z`));
  }
  if (filters.dateTo) {
    query = query.where((row) => row.createdAt.lte(`${filters.dateTo}T23:59:59.999Z`));
  }

  const rows = await query
    .orderBy((row) => row.createdAt.desc())
    .offset((filters.page - 1) * filters.pageSize)
    .limit(filters.pageSize + 1)
    .all();
  const page = rows.slice(0, filters.pageSize);
  const enrich = await enrichment(page);
  const documentIds = [...new Set(page.map((row) => row.documentId))];
  const documents = documentIds.length
    ? await db.orm.public.StockDocument.where((document) => document.id.in(documentIds)).all()
    : [];
  const documentMap = new Map(documents.map((document) => [document.id, document]));

  return {
    movements: page.map((row) => ({
      id: row.id,
      documentId: row.documentId,
      documentNumber: documentMap.get(row.documentId)?.documentNumber ?? null,
      reference: documentMap.get(row.documentId)?.reference ?? null,
      movementType: row.movementType,
      bucket: row.bucket,
      quantityDelta: normalizeDecimalString(String(row.quantityDelta)),
      balanceAfter: normalizeDecimalString(String(row.balanceAfter)),
      productId: row.productId,
      locationId: row.locationId,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      ...enrich(row),
    })),
    page: filters.page,
    pageSize: filters.pageSize,
    hasMore: rows.length > filters.pageSize,
  };
}

export async function listStockDocuments(filters: DocumentQuery) {
  let query = db.orm.public.StockDocument;

  // Accepts one type or a comma-separated list (e.g. "ADJUSTMENT,DAMAGE").
  const types = filters.documentType.split(",").map((type) => type.trim()).filter(Boolean);
  if (types.length === 1) {
    query = query.where({ documentType: types[0] });
  } else if (types.length > 1) {
    query = query.where((document) => document.documentType.in(types));
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    query = query.where((document) => or(
      document.documentNumber.ilike(pattern),
      document.reference.ilike(pattern),
    ));
  }
  if (filters.dateFrom) {
    query = query.where((row) => row.postedAt.gte(`${filters.dateFrom}T00:00:00.000Z`));
  }
  if (filters.dateTo) {
    query = query.where((row) => row.postedAt.lte(`${filters.dateTo}T23:59:59.999Z`));
  }

  const rows = await query
    .orderBy((row) => row.postedAt.desc())
    .offset((filters.page - 1) * filters.pageSize)
    .limit(filters.pageSize + 1)
    .all();

  const documents = rows.slice(0, filters.pageSize);
  const ids = documents.map((document) => document.id);
  const movements = ids.length
    ? await db.orm.public.StockMovement.where((row) => row.documentId.in(ids)).select("documentId", "lineNo").all()
    : [];
  const creatorIds = [...new Set(documents.map((document) => document.createdBy))];
  const creators = creatorIds.length
    ? await db.orm.public.User.where((user) => user.id.in(creatorIds)).select("id", "name").all()
    : [];
  const creatorNames = new Map(creators.map((user) => [user.id, user.name]));

  return {
    documents: documents.map((document) => ({
      ...document,
      createdByName: creatorNames.get(document.createdBy) ?? null,
      lineCount: new Set(movements.filter((row) => row.documentId === document.id).map((row) => row.lineNo)).size,
    })),
    page: filters.page,
    pageSize: filters.pageSize,
    hasMore: rows.length > filters.pageSize,
  };
}

export async function getStockDocument(id: string) {
  const document = await db.orm.public.StockDocument.where({ id }).first();

  if (!document) {
    throw notFound("Stock document not found.", "STOCK_DOCUMENT_NOT_FOUND");
  }

  const movements = await db.orm.public.StockMovement
    .where({ documentId: id })
    .orderBy((row) => row.lineNo.asc())
    .all();
  const enrich = await enrichment(movements);
  const creator = await db.orm.public.User.where({ id: document.createdBy }).select("name").first();

  return {
    ...document,
    createdByName: creator?.name ?? null,
    movements: movements.map((row) => ({
      id: row.id,
      lineNo: row.lineNo,
      movementType: row.movementType,
      bucket: row.bucket,
      quantityDelta: normalizeDecimalString(String(row.quantityDelta)),
      balanceAfter: normalizeDecimalString(String(row.balanceAfter)),
      productId: row.productId,
      locationId: row.locationId,
      reservationId: row.reservationId,
      ...enrich(row),
    })),
  };
}
