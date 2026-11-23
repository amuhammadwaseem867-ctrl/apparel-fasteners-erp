/*
 * Order costing report (D-055): an order's lines costed with the costing
 * rates. The rates are kept in erp_app_settings under "costing.rates",
 * apart from the general settings list; until they are saved, the master
 * sheet's rates (DEFAULT_COSTING_RATES) are used.
 */

import { z } from "zod";

import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { allocateDocumentNumber } from "../inventory/inventory.service";
import { getSalesOrder } from "../sales/sales.service";
import { DEFAULT_COSTING_RATES, costOrder, type CostingRates } from "./costing-rules";

const KEY = "costing.rates";
const rate = z.number().finite().min(0).max(100000000);
const positive = z.number().finite().gt(0).max(100000000);

export const gaugeRatesSchema = z.object({
  gauge: z.string().trim().regex(/^\d+(\.\d+)?$/, "Use a number, e.g. 4.5 or 5.").transform((value) => String(Number(value))),
  marginCm: rate,
  rollMeters: positive,
  tapeMetersPerKg: positive,
  brassGramsPerMeter: rate,
  rollWeightKg: positive,
  brassKgPerRoll: rate,
  openEndGapCm: rate,
  tapePricePerKg: rate,
  dyeingPerMeter: rate,
  platingPerMeter: rate,
  bottomStopPerPc: rate,
  pinBoxSetPerPc: rate,
  // Rates saved before 2-way zippers (D-059) have none: the default is used.
  twoWayPinBoxSetPerPc: rate.optional(),
  aluminiumChainPerMeter: rate.optional(),
  topStopPerPc: rate,
  pullerPerPc: rate,
});

export const costingRatesSchema = z.object({
  brassPricePerKg: rate,
  packingPerPc: rate,
  scrapRecoveryPercent: z.number().finite().min(0).max(100),
  teethDeductionCm: rate,
  wastageSmallKg: rate,
  wastageMediumKg: rate,
  wastageLargeKgPer1000m: rate,
  platedFinishes: z.array(z.string().trim().min(1).max(40)).max(30),
  gauges: z.array(gaugeRatesSchema).min(1).max(20),
}).superRefine((value, context) => {
  const gauges = value.gauges.map((item) => item.gauge);
  if (new Set(gauges).size !== gauges.length) context.addIssue({ code: "custom", path: ["gauges"], message: "Each gauge only once." });
});

export async function getCostingRates(): Promise<CostingRates & { configured: boolean }> {
  const row = await db.orm.public.AppSetting.where({ key: KEY }).first();
  if (!row) return { ...DEFAULT_COSTING_RATES, configured: false };
  const parsed = costingRatesSchema.safeParse(JSON.parse(row.value));
  if (!parsed.success) throw new AppError("The saved costing rates are invalid; save them again.", { code: "SETTING_INVALID", status: 500 });
  const gauges = parsed.data.gauges.map((gauge) => ({
    ...gauge,
    twoWayPinBoxSetPerPc: gauge.twoWayPinBoxSetPerPc
      ?? DEFAULT_COSTING_RATES.gauges.find((item) => item.gauge === gauge.gauge)?.twoWayPinBoxSetPerPc
      ?? DEFAULT_COSTING_RATES.gauges[0].twoWayPinBoxSetPerPc,
    aluminiumChainPerMeter: gauge.aluminiumChainPerMeter
      ?? DEFAULT_COSTING_RATES.gauges.find((item) => item.gauge === gauge.gauge)?.aluminiumChainPerMeter
      ?? DEFAULT_COSTING_RATES.gauges[0].aluminiumChainPerMeter,
  }));
  return { ...parsed.data, gauges, configured: true };
}

export async function setCostingRates(value: unknown, actorId: string) {
  const parsed = costingRatesSchema.safeParse(value);
  if (!parsed.success) throw new AppError("Costing rates validation failed.", { code: "VALIDATION_FAILED", status: 400, details: parsed.error.issues });
  const json = JSON.stringify(parsed.data);
  await db.runtime().query(db.raw.sql`
    insert into erp_app_settings (key, value, "updatedBy", "updatedAt") values (${KEY}, ${json}, ${actorId}::uuid, now())
    on conflict (key) do update set value = excluded.value, "updatedBy" = excluded."updatedBy", "updatedAt" = now()
    returning key
  `.returnsRow({ key: "pg/text@1" }).build() as never);
  await recordAuditEvent({ actorId, action: "COSTING_RATES_UPDATED", entityType: "AppSetting", entityId: null, metadata: { key: KEY } });
  return getCostingRates();
}

/* The consumption and cost of one order, with its revenue (before sales tax) and profit. */
export async function getOrderCosting(salesOrderId: string) {
  const order = await getSalesOrder(salesOrderId);
  const rates = await getCostingRates();
  const revenue = Number(order.subtotal) - Number(order.discountTotal);
  const lines = order.lines.map((line, index) => ({
    lineNo: line.lineNo ?? index + 1,
    productName: line.productName,
    size: line.size ?? null,
    finish: line.finish ?? null,
    quantity: Number(line.quantity),
  }));
  return {
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      status: order.status,
      customerName: order.customer?.name ?? null,
      lines: order.lines.map((line) => ({ id: line.id, productName: line.productName, size: line.size, finish: line.finish, teethType: line.teethType, slider: line.slider, tapeColor: line.tapeColor, quantity: Number(line.quantity), unit: line.unit })),
    },
    ratesConfigured: rates.configured,
    rates,
    ...costOrder(lines, rates, revenue),
  };
}

/*
 * Quick costing (D-059): the costing document for lines typed in by hand,
 * for quick documentation. It only reads the costing rates: no order,
 * invoice, stock or accounting entry is made, and nothing is saved.
 */
export const quickCostingSchema = z.object({
  customerName: z.string().trim().max(160).default(""),
  reference: z.string().trim().max(80).default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-11-16."),
  lines: z.array(z.object({
    productName: z.string().trim().min(1, "Each line needs an item, e.g. #5 Metal Zipper Close End.").max(160),
    size: z.string().trim().max(40).default(""),
    finish: z.string().trim().max(60).default(""),
    quantity: z.number().finite().gt(0, "Quantity must be more than 0.").max(100000000),
    unitPrice: z.number().finite().min(0).max(100000000).default(0),
    unit: z.enum(["Pcs", "Mtr", "Roll"]).default("Pcs"),
  })).min(1, "Add at least one line.").max(100),
});

export async function getQuickCosting(input: unknown) {
  const parsed = quickCostingSchema.safeParse(input);
  if (!parsed.success) throw new AppError("Quick costing validation failed.", { code: "VALIDATION_FAILED", status: 400, details: parsed.error.issues });
  const { customerName, reference, date, lines } = parsed.data;
  const rates = await getCostingRates();
  const revenue = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const costLines = lines.map((line, index) => ({
    lineNo: index + 1,
    productName: line.productName,
    size: line.size || null,
    finish: line.finish || null,
    quantity: line.quantity,
    unit: line.unit,
  }));
  return {
    quick: true,
    order: {
      id: null,
      orderNumber: reference || "—",
      orderDate: date,
      status: null,
      customerName: customerName || "—",
      lines: lines.map((line, index) => ({ id: String(index + 1), ...line })),
    },
    ratesConfigured: rates.configured,
    rates,
    ...costOrder(costLines, rates, revenue),
  };
}

/* ------------------------------------------------------------------ */
/* Costing history (D-060)                                             */
/* ------------------------------------------------------------------ */

type CostingResult = Awaited<ReturnType<typeof getQuickCosting>>;
type Runner = Parameters<Parameters<typeof db.transaction>[0]>[0] | ReturnType<typeof db.runtime>;

async function rows<T>(runner: Runner, plan: unknown) {
  return (await runner.query(plan as never)) as unknown as T[];
}

const money = (value: number) => (Math.round(value * 100) / 100).toFixed(2);

async function insertRecord(tx: Runner, input: {
  source: "QUICK" | "INVOICE"; date: string; customerName: string; reference: string; result: CostingResult | Record<string, unknown>;
  totals: { pieces: number; revenue: number; materialCost: number; profit: number }; notCostedRevenue: number;
}, actorId: string) {
  const number = await allocateDocumentNumber(tx as never, "QC");
  const data = JSON.stringify({ ...input.result, recordNumber: number });
  const [row] = await rows<{ id: string; recordNumber: string }>(tx, db.raw.sql`
    insert into erp_costing_records (id, "recordNumber", source, "documentDate", "customerName", reference, pieces, revenue, "materialCost", profit, "notCostedRevenue", data, "createdBy", "createdAt")
    values (gen_random_uuid(), ${number}, ${input.source}, ${input.date}, nullif(${input.customerName}, ''), nullif(${input.reference}, ''),
      ${String(input.totals.pieces)}::numeric, ${money(input.totals.revenue)}::numeric, ${money(input.totals.materialCost)}::numeric,
      ${money(input.totals.profit)}::numeric, ${money(input.notCostedRevenue)}::numeric, ${data}, ${actorId}::uuid, now())
    on conflict (source, reference) where source = 'INVOICE' do update set
      "documentDate" = excluded."documentDate", "customerName" = excluded."customerName", pieces = excluded.pieces,
      revenue = excluded.revenue, "materialCost" = excluded."materialCost", profit = excluded.profit,
      "notCostedRevenue" = excluded."notCostedRevenue",
      data = jsonb_set(excluded.data::jsonb, '{recordNumber}', to_jsonb(erp_costing_records."recordNumber"))::text
    returning id::text as id, "recordNumber"
  `.returnsRow({ id: "pg/text@1", recordNumber: "pg/text@1" }).build());
  return row;
}

/* Saves a quick costing to the history; still no order, invoice or accounting entry. */
export async function saveQuickCosting(input: unknown, actorId: string) {
  const result = await getQuickCosting(input);
  const header = quickCostingSchema.parse(input);
  const saved = await db.transaction(async (tx) => {
    const row = await insertRecord(tx, {
      source: "QUICK", date: header.date, customerName: header.customerName, reference: header.reference, result,
      totals: result.totals, notCostedRevenue: 0,
    }, actorId);
    await recordAuditEvent({ actorId, action: "COSTING_SAVED", entityType: "CostingRecord", entityId: row.id, metadata: { recordNumber: row.recordNumber } }, tx);
    return row;
  });
  return getCostingRecord(saved.id);
}

export const costingRecordQuerySchema = z.object({
  search: z.string().trim().max(120).default(""),
  source: z.enum(["", "QUICK", "INVOICE"]).default(""),
  from: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).default(""),
  to: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).default(""),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

export async function listCostingRecords(query: unknown) {
  const filters = costingRecordQuerySchema.parse(query ?? {});
  const pageSize = 50;
  const like = `%${filters.search.toLowerCase()}%`;
  const list = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select id::text as id, "recordNumber", source, "documentDate", coalesce("customerName", '') as "customerName", coalesce(reference, '') as reference,
      pieces::text as pieces, revenue::text as revenue, "materialCost"::text as "materialCost", profit::text as profit, "notCostedRevenue"::text as "notCostedRevenue"
    from erp_costing_records
    where (${filters.search} = '' or lower(coalesce("customerName", '') || ' ' || coalesce(reference, '') || ' ' || "recordNumber") like ${like})
      and (${filters.source} = '' or source = ${filters.source})
      and (${filters.from} = '' or "documentDate" >= ${filters.from})
      and (${filters.to} = '' or "documentDate" <= ${filters.to})
    order by "documentDate" desc, "recordNumber" desc
    limit ${pageSize + 1} offset ${(filters.page - 1) * pageSize}
  `.returnsRow({
    id: "pg/text@1", recordNumber: "pg/text@1", source: "pg/text@1", documentDate: "pg/text@1", customerName: "pg/text@1", reference: "pg/text@1",
    pieces: "pg/text@1", revenue: "pg/text@1", materialCost: "pg/text@1", profit: "pg/text@1", notCostedRevenue: "pg/text@1",
  }).build());
  const [sums] = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select count(*)::text as count, coalesce(sum(revenue), 0)::text as revenue,
      -- A costing with no value (order sheet, prices in dollars) has no profit or loss to count.
      coalesce(sum("materialCost") filter (where revenue > 0), 0)::text as "materialCost",
      coalesce(sum(profit) filter (where revenue > 0), 0)::text as profit,
      count(*) filter (where revenue = 0)::text as "noValue"
    from erp_costing_records
    where (${filters.search} = '' or lower(coalesce("customerName", '') || ' ' || coalesce(reference, '') || ' ' || "recordNumber") like ${like})
      and (${filters.source} = '' or source = ${filters.source})
      and (${filters.from} = '' or "documentDate" >= ${filters.from})
      and (${filters.to} = '' or "documentDate" <= ${filters.to})
  `.returnsRow({ count: "pg/text@1", revenue: "pg/text@1", materialCost: "pg/text@1", profit: "pg/text@1", noValue: "pg/text@1" }).build());
  return { records: list.slice(0, pageSize), hasMore: list.length > pageSize, page: filters.page, totals: sums };
}

type RecordRow = {
  id: string; recordNumber: string; source: string; documentDate: string; customerName: string; reference: string;
  revenue: string; materialCost: string; profit: string; notCostedRevenue: string; data: string; createdAt: string;
};

export async function getCostingRecord(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AppError("Costing not found.", { code: "COSTING_NOT_FOUND", status: 404 });
  const [row] = await rows<RecordRow>(db.runtime(), db.raw.sql`
    select id::text as id, "recordNumber", source, "documentDate", coalesce("customerName", '') as "customerName", coalesce(reference, '') as reference,
      revenue::text as revenue, "materialCost"::text as "materialCost", profit::text as profit, "notCostedRevenue"::text as "notCostedRevenue", data, "createdAt"::text as "createdAt"
    from erp_costing_records where id = ${id}::uuid
  `.returnsRow({
    id: "pg/text@1", recordNumber: "pg/text@1", source: "pg/text@1", documentDate: "pg/text@1", customerName: "pg/text@1", reference: "pg/text@1",
    revenue: "pg/text@1", materialCost: "pg/text@1", profit: "pg/text@1", notCostedRevenue: "pg/text@1", data: "pg/text@1", createdAt: "pg/text@1",
  }).build());
  if (!row) throw new AppError("Costing not found.", { code: "COSTING_NOT_FOUND", status: 404 });
  return { ...row, data: JSON.parse(row.data) };
}

export const costingRecordEditSchema = z.object({
  customerName: z.string().trim().max(160),
  reference: z.string().trim().max(80).optional(),
});

/* Sets the customer (and, for a quick costing, the reference); the printout follows. */
export async function updateCostingRecord(id: string, input: unknown, actorId: string) {
  const record = await getCostingRecord(id);
  const parsed = costingRecordEditSchema.safeParse(input);
  if (!parsed.success) throw new AppError("Costing validation failed.", { code: "VALIDATION_FAILED", status: 400, details: parsed.error.issues });
  const customerName = parsed.data.customerName;
  const reference = record.source === "QUICK" && parsed.data.reference !== undefined ? parsed.data.reference : record.reference;
  const data = { ...record.data, order: { ...record.data.order, customerName: customerName || "—", orderNumber: reference || "—" } };
  await db.transaction(async (tx) => {
    await rows(tx, db.raw.sql`
      update erp_costing_records set "customerName" = nullif(${customerName}, ''), reference = nullif(${reference}, ''), data = ${JSON.stringify(data)}
      where id = ${id}::uuid returning id
    `.returnsRow({ id: "pg/uuid@1" }).build());
    await recordAuditEvent({ actorId, action: "COSTING_UPDATED", entityType: "CostingRecord", entityId: id, metadata: { recordNumber: record.recordNumber, customerName } }, tx);
  });
  return getCostingRecord(id);
}

/* Quick costings saved by mistake can go; invoice costings stay with their invoice. */
export async function deleteCostingRecord(id: string, actorId: string) {
  const record = await getCostingRecord(id);
  if (record.source !== "QUICK") throw new AppError("Only quick costings can be deleted.", { code: "COSTING_NOT_DELETABLE", status: 409 });
  await db.transaction(async (tx) => {
    await rows(tx, db.raw.sql`delete from erp_costing_records where id = ${id}::uuid returning id`.returnsRow({ id: "pg/uuid@1" }).build());
    await recordAuditEvent({ actorId, action: "COSTING_DELETED", entityType: "CostingRecord", entityId: id, metadata: { recordNumber: record.recordNumber } }, tx);
  });
  return { id };
}

/*
 * Invoice costing (D-060): one costing per invoice from its lines, revenue
 * the line amounts before sales tax. Lines that are not zippers or chain
 * (tape sold by kg, loose sliders, pins) are listed as not costed, their
 * value kept apart from the profit. Saving an invoice again replaces it.
 */
export const invoiceCostingSchema = z.object({
  invoices: z.array(z.object({
    number: z.string().trim().min(1).max(80),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    customerName: z.string().trim().max(160).default(""),
    kind: z.string().trim().max(60).default(""),
    usd: z.boolean().default(false),
    notes: z.array(z.string().max(300)).max(50).default([]),
    lines: z.array(z.object({
      productName: z.string().trim().min(1).max(200),
      size: z.string().trim().max(40).default(""),
      finish: z.string().trim().max(80).default(""),
      tapeColor: z.string().trim().max(60).default(""),
      unit: z.string().trim().max(20).default("Pcs"),
      quantity: z.number().finite().gt(0),
      amount: z.number().finite().min(0).nullable().default(null),
    })).max(300),
  })).min(1).max(500),
});

export function invoiceCosting(invoice: z.infer<typeof invoiceCostingSchema>["invoices"][number], rates: CostingRates & { configured?: boolean }) {
  const lines = invoice.lines.map((line, index) => ({
    lineNo: index + 1, productName: line.productName, size: line.size || null, finish: line.finish || null, quantity: line.quantity, unit: line.unit,
  }));
  const probe = costOrder(lines, rates, 0);
  const skipped = new Set(probe.skipped.map((row) => row.lineNo));
  const value = (keep: (lineNo: number) => boolean) => invoice.usd ? 0
    : invoice.lines.reduce((total, line, index) => total + (keep(index + 1) ? (line.amount ?? 0) : 0), 0);
  const revenue = value((lineNo) => !skipped.has(lineNo));
  const notCostedRevenue = value((lineNo) => skipped.has(lineNo));
  const result = costOrder(lines, rates, revenue);
  const notes = [...invoice.notes];
  if (invoice.usd) notes.push("Prices are in US dollars: value and profit are left out.");
  if (notCostedRevenue > 0) notes.push(`Not costed lines are worth ${money(notCostedRevenue)} (before sales tax), kept apart from the profit.`);
  return {
    data: {
      quick: false,
      invoice: true,
      notes,
      order: {
        id: null, orderNumber: invoice.number, orderDate: invoice.date, status: null, customerName: invoice.customerName || "—",
        lines: invoice.lines.map((line, index) => ({ id: String(index + 1), ...line })),
      },
      ratesConfigured: Boolean(rates.configured),
      rates,
      ...result,
    },
    totals: result.totals,
    notCostedRevenue,
  };
}

export async function importInvoiceCostings(input: unknown, actorId: string) {
  const parsed = invoiceCostingSchema.safeParse(input);
  if (!parsed.success) throw new AppError("Invoice costing validation failed.", { code: "VALIDATION_FAILED", status: 400, details: parsed.error.issues });
  const rates = await getCostingRates();
  return db.transaction(async (tx) => {
    const saved: Array<{ recordNumber: string; reference: string }> = [];
    for (const invoice of parsed.data.invoices) {
      const costing = invoiceCosting(invoice, rates);
      const row = await insertRecord(tx, {
        source: "INVOICE", date: invoice.date, customerName: invoice.customerName, reference: invoice.number,
        result: costing.data, totals: costing.totals, notCostedRevenue: costing.notCostedRevenue,
      }, actorId);
      saved.push({ recordNumber: row.recordNumber, reference: invoice.number });
    }
    await recordAuditEvent({ actorId, action: "INVOICE_COSTINGS_IMPORTED", entityType: "CostingRecord", entityId: null, metadata: { count: saved.length } }, tx);
    return { saved };
  });
}

/*
 * Recalculates saved invoice costings with the current costing rates
 * (D-061), from the invoice lines each costing keeps; numbers, dates and
 * customers stay. A batch at a time, so a slow database never times out.
 */
export async function recalculateInvoiceCostings(input: { offset?: number; limit?: number }, actorId: string) {
  const offset = Math.max(0, Math.floor(Number(input.offset ?? 0)));
  const limit = Math.min(50, Math.max(1, Math.floor(Number(input.limit ?? 20))));
  const rates = await getCostingRates();
  const [{ total }] = await rows<{ total: string }>(db.runtime(), db.raw.sql`
    select count(*)::text as total from erp_costing_records where source = 'INVOICE'
  `.returnsRow({ total: "pg/text@1" }).build());
  const batch = await rows<{ id: string; recordNumber: string; reference: string; documentDate: string; customerName: string; data: string }>(db.runtime(), db.raw.sql`
    select id::text as id, "recordNumber", coalesce(reference, '') as reference, "documentDate", coalesce("customerName", '') as "customerName", data
    from erp_costing_records where source = 'INVOICE' order by "recordNumber" limit ${limit} offset ${offset}
  `.returnsRow({ id: "pg/text@1", recordNumber: "pg/text@1", reference: "pg/text@1", documentDate: "pg/text@1", customerName: "pg/text@1", data: "pg/text@1" }).build());
  const generated = (note: string) => note.startsWith("Prices are in US dollars") || note.startsWith("Not costed lines are worth");
  await db.transaction(async (tx) => {
    for (const record of batch) {
      const saved = JSON.parse(record.data);
      const notes: string[] = saved.notes ?? [];
      const invoice = invoiceCostingSchema.shape.invoices.element.parse({
        number: record.reference || record.recordNumber,
        date: record.documentDate,
        customerName: record.customerName,
        usd: notes.some((note) => note.startsWith("Prices are in US dollars")),
        notes: notes.filter((note) => !generated(note)),
        lines: (saved.order?.lines ?? []).map((line: Record<string, unknown>) => ({
          productName: line.productName, size: line.size ?? "", finish: line.finish ?? "", tapeColor: line.tapeColor ?? "",
          unit: line.unit ?? "Pcs", quantity: line.quantity, amount: line.amount ?? null,
        })),
      });
      const costing = invoiceCosting(invoice, rates);
      const data = JSON.stringify({ ...costing.data, recordNumber: record.recordNumber, order: { ...costing.data.order, customerName: record.customerName || "—" } });
      await rows(tx, db.raw.sql`
        update erp_costing_records set pieces = ${String(costing.totals.pieces)}::numeric, revenue = ${money(costing.totals.revenue)}::numeric,
          "materialCost" = ${money(costing.totals.materialCost)}::numeric, profit = ${money(costing.totals.profit)}::numeric,
          "notCostedRevenue" = ${money(costing.notCostedRevenue)}::numeric, data = ${data}
        where id = ${record.id}::uuid returning id
      `.returnsRow({ id: "pg/uuid@1" }).build());
    }
    if (batch.length) {
      await recordAuditEvent({ actorId, action: "INVOICE_COSTINGS_RECALCULATED", entityType: "CostingRecord", entityId: null, metadata: { offset, count: batch.length } }, tx);
    }
  });
  const next = offset + batch.length;
  return { recalculated: batch.length, next, total: Number(total), done: next >= Number(total) || batch.length === 0 };
}
