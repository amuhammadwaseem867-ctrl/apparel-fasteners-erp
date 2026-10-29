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
  return { ...parsed.data, configured: true };
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
