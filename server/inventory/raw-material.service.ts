/*
 * AF7 raw material stock (D-044).
 *
 * addStandardRawMaterials creates every item on AF7's raw material list
 * (teeth, top stops, bottoms, pin boxes, two pins, sliders) that is not in
 * the item master yet, as an active raw material with no stock. It is safe
 * to run again: existing items are matched by specification and never
 * duplicated. Inactive list items are made active; archived ones are left
 * alone. #4.5 teeth are always Y-Cut, so a #4.5 teeth item saved as Plain
 * is corrected. When no warehouse exists yet, one main warehouse with one
 * location is created so stock can be received straight away.
 *
 * getRawMaterialStock is the live stock list: for every item, what was
 * received, what was issued to production (less returns), what is in
 * stock now and where, in its own unit and, when the item has a unit
 * weight, in pieces and kg. Finished products are left out unless asked.
 */

import { buildCatalog, CATEGORY_LABELS, matchesCatalogEntry } from "../../lib/inventory/catalog.js";
import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { addDecimalStrings, decimalSign, normalizeDecimalString, subtractDecimalStrings } from "../core/utils/decimal";
import { createLocation, createWarehouse } from "./inventory.service";

type CatalogEntry = ReturnType<typeof buildCatalog>[number];

export const RAW_MATERIAL_TYPE = "Raw Material";

/* Teeth are bought and stored by weight; every component is counted in pieces. */
function unitFor(entry: CatalogEntry) {
  return entry.category === "teeth" ? "Kgs" : "Pcs";
}

const isYCutTeeth = (entry: CatalogEntry) => entry.category === "teeth" && entry.size === "#4.5";

export function standardRawMaterials() {
  return buildCatalog();
}

export async function addStandardRawMaterials(actorId: string) {
  const catalog = standardRawMaterials();
  const products = await db.orm.public.Product.all();
  const created: string[] = [];
  const activated: string[] = [];
  const corrected: string[] = [];

  for (const entry of catalog) {
    // A #4.5 teeth item saved before the Y-Cut rule matches its Plain form.
    const plainForm = isYCutTeeth(entry) ? { ...entry, type: "Plain" } : null;
    const match = products.find((product) => matchesCatalogEntry(product, entry))
      ?? (plainForm && products.find((product) => matchesCatalogEntry(product, plainForm)))
      ?? products.find((product) => product.sku === entry.sku);

    if (!match) {
      const product = await db.orm.public.Product.create({
        sku: entry.sku,
        name: entry.name,
        category: CATEGORY_LABELS[entry.category] ?? entry.category,
        productType: RAW_MATERIAL_TYPE,
        variant: entry.variant || null,
        unit: unitFor(entry),
        unitPrice: "0",
        status: "ACTIVE",
        size: entry.size || null,
        material: entry.material || null,
        itemType: entry.type || null,
        finish: entry.finish || null,
        logoType: entry.logo || null,
        minimumStock: "0",
      });
      products.push(product);
      created.push(product.sku);
      continue;
    }

    const changes: Record<string, string> = {};
    if (match.status === "INACTIVE") changes.status = "ACTIVE";
    if (isYCutTeeth(entry) && match.category === "Teeth" && String(match.itemType ?? "").toLowerCase() !== "y-cut") {
      changes.itemType = "Y-Cut";
      changes.name = entry.name;
    }
    if (Object.keys(changes).length === 0) continue;
    await db.orm.public.Product.where({ id: match.id }).update({ ...changes, updatedAt: new Date().toISOString() });
    if (changes.status) activated.push(match.sku);
    if (changes.itemType) corrected.push(match.sku);
  }

  const warehouse = await ensureOneWarehouse(actorId);

  await recordAuditEvent({
    actorId,
    action: "RAW_MATERIAL_LIST_ADDED",
    entityType: "Product",
    entityId: null,
    metadata: { created: created.length, activated, corrected, warehouseCreated: warehouse.created },
  });

  return { listSize: catalog.length, created, activated, corrected, warehouse };
}

/* AF7 uses one warehouse. Creates it, with one location, only when there is none. */
async function ensureOneWarehouse(actorId: string) {
  const existing = await db.orm.public.Warehouse.where({ status: "ACTIVE" }).first();
  if (existing) return { created: false, code: existing.code };
  const warehouse = await createWarehouse({ code: "MAIN", name: "AF7 Main Warehouse", warehouseType: "GENERAL", address: "" }, actorId);
  await createLocation({ warehouseId: warehouse.id, code: "MAIN", name: "Main store" }, actorId);
  return { created: true, code: warehouse.code };
}

const CATEGORY_ORDER = Object.values(CATEGORY_LABELS);
function categoryOrder(a: string, b: string) {
  const rank = (value: string) => (CATEGORY_ORDER.includes(value) ? CATEGORY_ORDER.indexOf(value) : CATEGORY_ORDER.length);
  return rank(a) - rank(b) || a.localeCompare(b);
}

export type RawMaterialQuery = { search: string; category: string; includeProducts: boolean; stock: string };

const STOCK_COLUMNS = {
  id: "pg/text@1", sku: "pg/text@1", name: "pg/text@1", category: "pg/text@1", productType: "pg/text@1",
  size: "pg/text@1", itemType: "pg/text@1", material: "pg/text@1", finish: "pg/text@1", color: "pg/text@1",
  variant: "pg/text@1", logoType: "pg/text@1", unit: "pg/text@1", unitWeightGrams: "pg/text@1",
  minimumStock: "pg/text@1", status: "pg/text@1", onHand: "pg/text@1", reserved: "pg/text@1",
  qualityHold: "pg/text@1", locations: "pg/text@1", received: "pg/text@1", issued: "pg/text@1",
  returned: "pg/text@1", lastMovementAt: "pg/text@1",
} as const;

type StockRow = Record<keyof typeof STOCK_COLUMNS, string | null>;

/* Pieces and kg for a quantity in the item's own unit, when the unit weight is known. */
export function piecesAndKg(quantity: string, unit: string, unitWeightGrams: string | null) {
  const kind = unit.trim().toLowerCase();
  const isKg = kind === "kg" || kind === "kgs";
  const isPcs = kind === "pc" || kind === "pcs";
  const weight = unitWeightGrams === null ? null : Number(unitWeightGrams);
  const value = Number(quantity);
  const round = (number: number, places: number) => String(Math.round(number * 10 ** places) / 10 ** places);
  return {
    pieces: isPcs ? normalizeDecimalString(quantity) : isKg && weight ? round((value * 1000) / weight, 0) : null,
    kg: isKg ? normalizeDecimalString(quantity) : isPcs && weight ? round((value * weight) / 1000, 3) : null,
  };
}

export async function getRawMaterialStock(filters: RawMaterialQuery) {
  const pattern = `%${filters.search}%`;
  const rows = (await db.runtime().query(db.raw.sql`
    select p.id::text as id, p.sku, p.name, p.category, p."productType", p.size, p."itemType", p.material,
      p.finish, p.color, p.variant, p."logoType", p.unit, p."unitWeightGrams"::text as "unitWeightGrams",
      p."minimumStock"::text as "minimumStock", p.status,
      coalesce(b."onHand", 0)::text as "onHand", coalesce(b.reserved, 0)::text as reserved,
      coalesce(b."qualityHold", 0)::text as "qualityHold", coalesce(b.locations, '') as locations,
      coalesce(m.received, 0)::text as received, coalesce(m.issued, 0)::text as issued,
      coalesce(m.returned, 0)::text as returned, m."lastMovementAt"::text as "lastMovementAt"
    from erp_products p
    left join (
      select sb."productId", sum(sb."onHand") as "onHand", sum(sb.reserved) as reserved, sum(sb."qualityHold") as "qualityHold",
        string_agg(case when sb."onHand" > 0 then l.name end, ', ' order by l.name) as locations
      from erp_stock_balances sb
      join erp_storage_locations l on l.id = sb."locationId"
      group by sb."productId"
    ) b on b."productId" = p.id
    left join (
      select sm."productId",
        sum(case when sm."movementType" in ('GOODS_RECEIPT', 'STOCK_IN', 'FG_RECEIPT') then sm."quantityDelta" else 0 end) as received,
        sum(case when sm."movementType" = 'MATERIAL_ISSUE' then -sm."quantityDelta" else 0 end) as issued,
        sum(case when sm."movementType" = 'MATERIAL_RETURN' then sm."quantityDelta" else 0 end) as returned,
        max(sm."createdAt") as "lastMovementAt"
      from erp_stock_movements sm
      where sm.bucket = 'ON_HAND'
      group by sm."productId"
    ) m on m."productId" = p.id
    where p.status <> 'ARCHIVED'
      and (${filters.includeProducts} or p."productType" not ilike 'finished%')
      and (${filters.category} = '' or p.category = ${filters.category})
      and (${filters.search} = '' or p.sku ilike ${pattern} or p.name ilike ${pattern} or p.finish ilike ${pattern}
        or p.size ilike ${pattern} or p."itemType" ilike ${pattern} or p.variant ilike ${pattern})
    order by p.category, p.size nulls first, p."itemType" nulls first, p.finish nulls first, p.variant nulls first, p."logoType" nulls first, p.sku
  `.returnsRow(STOCK_COLUMNS).build())) as unknown as StockRow[];

  const items = rows.map((row) => {
    const onHand = row.onHand ?? "0";
    const available = subtractDecimalStrings(subtractDecimalStrings(onHand, row.reserved ?? "0"), row.qualityHold ?? "0");
    const minimum = row.minimumStock ?? "0";
    const outOfStock = decimalSign(available) <= 0;
    const lowStock = !outOfStock && decimalSign(minimum) > 0 && decimalSign(subtractDecimalStrings(available, minimum)) < 0;
    const unit = row.unit ?? "";
    return {
      ...row,
      onHand: normalizeDecimalString(onHand),
      reserved: normalizeDecimalString(row.reserved ?? "0"),
      qualityHold: normalizeDecimalString(row.qualityHold ?? "0"),
      available: normalizeDecimalString(available),
      received: normalizeDecimalString(row.received ?? "0"),
      issued: normalizeDecimalString(row.issued ?? "0"),
      returned: normalizeDecimalString(row.returned ?? "0"),
      minimumStock: normalizeDecimalString(minimum),
      unitWeightGrams: row.unitWeightGrams === null ? null : normalizeDecimalString(row.unitWeightGrams),
      stockStatus: outOfStock ? "OUT" : lowStock ? "LOW" : "OK",
      ...piecesAndKg(onHand, unit, row.unitWeightGrams),
    };
  });

  const filtered = filters.stock ? items.filter((item) => item.stockStatus === filters.stock || (filters.stock === "ALERT" && item.stockStatus !== "OK")) : items;
  const standard = standardRawMaterials();
  const all = (await db.orm.public.Product.all()).filter((product) => product.status !== "ARCHIVED");
  const missing = standard.filter((entry) => !all.some((product) => matchesCatalogEntry(product, entry))).length;
  const listed = all.filter((product) => filters.includeProducts || !/^finished/i.test(product.productType));

  return {
    items: filtered,
    // Category chips come from every listed item, not just the current filter.
    categories: [...new Set(listed.map((product) => product.category))].sort(categoryOrder),
    counts: {
      items: items.length,
      low: items.filter((item) => item.stockStatus === "LOW").length,
      out: items.filter((item) => item.stockStatus === "OUT").length,
    },
    standardList: { size: standard.length, missing },
  };
}

const CARD_COLUMNS = {
  id: "pg/text@1", createdAt: "pg/text@1", documentId: "pg/text@1", documentNumber: "pg/text@1",
  movementType: "pg/text@1", reference: "pg/text@1", reason: "pg/text@1", location: "pg/text@1",
  quantityDelta: "pg/text@1", userName: "pg/text@1",
} as const;

const CARD_LIMIT = 2000;

/*
 * Stock card for one item: opening balance at the start of the range, every
 * on-hand movement in it (oldest first) with a running balance, and the
 * closing balance. Totals in and out are per movement type.
 */
export async function getItemStockCard(productId: string, range: { dateFrom?: string; dateTo?: string }) {
  const product = await db.orm.public.Product.where({ id: productId }).first();
  if (!product) throw new AppError("Item not found.", { code: "PRODUCT_NOT_FOUND", status: 404 });
  const from = range.dateFrom ? `${range.dateFrom}T00:00:00.000Z` : "";
  const to = range.dateTo ? `${range.dateTo}T23:59:59.999Z` : "";

  const [opening] = (await db.runtime().query(db.raw.sql`
    select coalesce(sum("quantityDelta"), 0)::text as total from erp_stock_movements
    where "productId" = ${productId}::uuid and bucket = 'ON_HAND' and "createdAt" < nullif(${from}, '')::timestamptz
  `.returnsRow({ total: "pg/text@1" }).build())) as unknown as { total: string }[];

  const rows = (await db.runtime().query(db.raw.sql`
    select m.id::text as id, m."createdAt"::text as "createdAt", d.id::text as "documentId", d."documentNumber",
      m."movementType", d.reference, d.reason, l.name as location,
      m."quantityDelta"::text as "quantityDelta", u.name as "userName"
    from erp_stock_movements m
    join erp_stock_documents d on d.id = m."documentId"
    join erp_storage_locations l on l.id = m."locationId"
    left join erp_users u on u.id = m."createdBy"
    where m."productId" = ${productId}::uuid and m.bucket = 'ON_HAND'
      and m."createdAt" >= coalesce(nullif(${from}, '')::timestamptz, '-infinity')
      and m."createdAt" <= coalesce(nullif(${to}, '')::timestamptz, 'infinity')
    order by m."createdAt", m."lineNo"
    limit ${CARD_LIMIT + 1}
  `.returnsRow(CARD_COLUMNS).build())) as unknown as Record<keyof typeof CARD_COLUMNS, string | null>[];

  const [sums] = (await db.runtime().query(db.raw.sql`
    select
      coalesce(sum(case when "movementType" in ('GOODS_RECEIPT', 'STOCK_IN', 'FG_RECEIPT') then "quantityDelta" else 0 end), 0)::text as received,
      coalesce(sum(case when "movementType" = 'MATERIAL_ISSUE' then -"quantityDelta" else 0 end), 0)::text as issued,
      coalesce(sum(case when "movementType" = 'MATERIAL_RETURN' then "quantityDelta" else 0 end), 0)::text as returned
    from erp_stock_movements
    where "productId" = ${productId}::uuid and bucket = 'ON_HAND'
      and "createdAt" >= coalesce(nullif(${from}, '')::timestamptz, '-infinity')
      and "createdAt" <= coalesce(nullif(${to}, '')::timestamptz, 'infinity')
  `.returnsRow({ received: "pg/text@1", issued: "pg/text@1", returned: "pg/text@1" }).build())) as unknown as { received: string; issued: string; returned: string }[];

  let balance = normalizeDecimalString(opening?.total ?? "0");
  const openingBalance = balance;
  let totalIn = "0";
  let totalOut = "0";
  const lines = rows.slice(0, CARD_LIMIT).map((row) => {
    const delta = row.quantityDelta ?? "0";
    balance = addDecimalStrings(balance, delta);
    if (decimalSign(delta) > 0) totalIn = addDecimalStrings(totalIn, delta);
    else totalOut = subtractDecimalStrings(totalOut, delta);
    const positive = decimalSign(delta) > 0;
    return {
      ...row,
      quantityIn: positive ? normalizeDecimalString(delta) : null,
      quantityOut: positive ? null : normalizeDecimalString(delta.replace(/^-/, "")),
      balance: normalizeDecimalString(balance),
    };
  });

  return {
    item: { ...product, unitWeightGrams: product.unitWeightGrams === null ? null : normalizeDecimalString(String(product.unitWeightGrams)) },
    range: { dateFrom: range.dateFrom || null, dateTo: range.dateTo || null },
    openingBalance,
    received: normalizeDecimalString(sums.received),
    issued: normalizeDecimalString(sums.issued),
    returned: normalizeDecimalString(sums.returned),
    totalIn: normalizeDecimalString(totalIn),
    totalOut: normalizeDecimalString(totalOut),
    closingBalance: normalizeDecimalString(balance),
    closing: piecesAndKg(balance, product.unit, product.unitWeightGrams === null ? null : String(product.unitWeightGrams)),
    lines,
    truncated: rows.length > CARD_LIMIT,
  };
}
