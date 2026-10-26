/*
 * How far each order is delivered (D-051): ordered, shipped (dispatched or
 * delivered) and delivered quantity of its catalogue lines, and what is
 * still left. Part deliveries never block anything; the rest is simply
 * shown as left to deliver (the shortfall) until a later shipment takes it.
 */

import { db } from "../core/database/client";
import { normalizeDecimalString, subtractDecimalStrings, decimalSign } from "../core/utils/decimal";

export type DeliveryProgress = {
  ordered: string;
  shipped: string;
  delivered: string;
  left: string;
  deliveryStatus: "Delivered" | "Part delivered" | "Dispatched" | null;
};

const dec = (value: unknown) => normalizeDecimalString(String(value ?? "0"));

/* "Delivered" once the whole order is delivered; "Part delivered" before that. */
export function deliveryStatusFor(ordered: string, shipped: string, delivered: string): DeliveryProgress["deliveryStatus"] {
  if (decimalSign(dec(ordered)) <= 0) return null;
  const left = subtractDecimalStrings(dec(ordered), dec(delivered));
  if (decimalSign(dec(delivered)) > 0 && decimalSign(left) <= 0) return "Delivered";
  if (decimalSign(dec(delivered)) > 0) return "Part delivered";
  if (decimalSign(dec(shipped)) > 0) return "Dispatched";
  return null;
}

export async function deliveryProgress(orderIds: string[]): Promise<Map<string, DeliveryProgress>> {
  const result = new Map<string, DeliveryProgress>();
  if (!orderIds.length) return result;
  const rows = (await db.runtime().query(db.raw.sql`
    select o.id::text as id,
      coalesce((select sum(l.quantity) from erp_sales_order_lines l
        where l."salesOrderId" = o.id and l."productId" is not null and not l."isCustom"), 0)::text as ordered,
      coalesce((select sum(sl.quantity) from erp_shipment_lines sl join erp_shipments s on s.id = sl."shipmentId"
        where s."salesOrderId" = o.id and s.status in ('DISPATCHED', 'DELIVERED')), 0)::text as shipped,
      coalesce((select sum(sl.quantity) from erp_shipment_lines sl join erp_shipments s on s.id = sl."shipmentId"
        where s."salesOrderId" = o.id and s.status = 'DELIVERED'), 0)::text as delivered
    from erp_sales_orders o
    where o.id = any(string_to_array(${orderIds.join(",")}::text, ',')::uuid[])
  `.returnsRow({ id: "pg/text@1", ordered: "pg/text@1", shipped: "pg/text@1", delivered: "pg/text@1" }).build() as never)) as unknown as Array<{ id: string; ordered: string; shipped: string; delivered: string }>;
  for (const row of rows) {
    const leftRaw = subtractDecimalStrings(dec(row.ordered), dec(row.delivered));
    result.set(row.id, {
      ordered: dec(row.ordered),
      shipped: dec(row.shipped),
      delivered: dec(row.delivered),
      left: decimalSign(leftRaw) < 0 ? "0" : normalizeDecimalString(leftRaw),
      deliveryStatus: deliveryStatusFor(row.ordered, row.shipped, row.delivered),
    });
  }
  return result;
}
