/*
 * Dispatch rules that need no database (D-022). Quantities are exact
 * decimal strings.
 */

import {
  addDecimalStrings,
  compareDecimalStrings,
  decimalSign,
  normalizeDecimalString,
  subtractDecimalStrings,
} from "../core/utils/decimal";

export function sumByProduct(lines: Array<{ productId: string; quantity: string }>) {
  const totals = new Map<string, string>();
  for (const line of lines) {
    totals.set(line.productId, addDecimalStrings(totals.get(line.productId) ?? "0", line.quantity));
  }
  return totals;
}

/*
 * A shipment may not take any item past what the sales order ordered:
 * already shipped (dispatched or delivered shipments) + this shipment <=
 * ordered. Returns the first violation, or null.
 */
export function overShipment(
  ordered: Map<string, string>,
  shipped: Map<string, string>,
  shipment: Map<string, string>,
): { productId: string; ordered: string; shipped: string; requested: string; remaining: string } | null {
  for (const [productId, requested] of shipment) {
    const orderedQuantity = ordered.get(productId) ?? "0";
    const shippedQuantity = shipped.get(productId) ?? "0";
    const remaining = subtractDecimalStrings(orderedQuantity, shippedQuantity);
    if (compareDecimalStrings(requested, remaining) > 0) {
      return {
        productId,
        ordered: normalizeDecimalString(orderedQuantity),
        shipped: normalizeDecimalString(shippedQuantity),
        requested: normalizeDecimalString(requested),
        remaining: normalizeDecimalString(decimalSign(remaining) < 0 ? "0" : remaining),
      };
    }
  }
  return null;
}

/*
 * Splits a dispatch quantity across the order's open reservations (oldest
 * first) so reserved stock is consumed before unreserved stock. The last
 * part has no reservation when the reservations do not cover it.
 */
export function allocateToReservations(
  quantity: string,
  reservations: Array<{ id: string; open: string }>,
): Array<{ reservationId: string | null; quantity: string }> {
  const parts: Array<{ reservationId: string | null; quantity: string }> = [];
  let left = normalizeDecimalString(quantity);

  for (const reservation of reservations) {
    if (decimalSign(left) <= 0) break;
    if (decimalSign(reservation.open) <= 0) continue;
    const take = compareDecimalStrings(reservation.open, left) < 0 ? normalizeDecimalString(reservation.open) : left;
    parts.push({ reservationId: reservation.id, quantity: take });
    left = subtractDecimalStrings(left, take);
  }

  if (decimalSign(left) > 0) {
    parts.push({ reservationId: null, quantity: normalizeDecimalString(left) });
  }

  return parts;
}

const TRANSITIONS: Record<string, Record<string, string>> = {
  dispatch: { DRAFT: "DISPATCHED" },
  deliver: { DISPATCHED: "DELIVERED" },
  cancel: { DRAFT: "CANCELLED" },
};

export function nextShipmentStatus(action: string, from: string): string | null {
  return TRANSITIONS[action]?.[from] ?? null;
}
