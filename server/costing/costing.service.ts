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
  }));
  return {
    quick: true,
    order: {
      id: null,
      orderNumber: reference || "—",
      orderDate: date,
      status: null,
      customerName: customerName || "—",
      lines: lines.map((line, index) => ({ id: String(index + 1), ...line, unit: "Pcs" })),
    },
    ratesConfigured: rates.configured,
    rates,
    ...costOrder(costLines, rates, revenue),
  };
}
