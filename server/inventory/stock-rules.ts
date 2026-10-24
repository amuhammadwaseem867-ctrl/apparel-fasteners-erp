/*
 * Inventory rules that do not need the database: document types, the
 * permission each requires, unit-of-measure precision, and the balance
 * operations each document line performs.
 *
 * Balance operations (applied by inventory.service in one transaction):
 *   increase-on-hand       onHand += q
 *   decrease-available     onHand -= q, only if onHand - reserved - hold >= q
 *   consume-reserved       onHand -= q and reserved -= q, only if reserved >= q
 *   increase-hold          qualityHold += q, only if available >= q
 *   decrease-hold          qualityHold -= q, only if qualityHold >= q
 *   scrap-held             qualityHold -= q and onHand -= q, only if hold >= q
 *   increase-reserved      reserved += q, only if available >= q
 *   decrease-reserved      reserved -= q, only if reserved >= q
 */

import { toScaledDecimal } from "../core/utils/decimal";

export type BalanceOperation =
  | "increase-on-hand"
  | "decrease-available"
  | "consume-reserved"
  | "increase-hold"
  | "decrease-hold"
  | "scrap-held"
  | "increase-reserved"
  | "decrease-reserved";

export type InventoryPermission =
  | "inventory:create"
  | "inventory:transfer"
  | "inventory:adjust";

interface DocumentTypeRule {
  label: string;
  prefix: string;
  permission: InventoryPermission;
  /** Operation at the line's location. */
  operation: BalanceOperation | "signed-adjustment" | "count";
  /** Transfers also add stock at the destination location. */
  destination?: BalanceOperation;
  requiresReason?: boolean;
  /** Lines may consume an existing reservation (issue / dispatch). */
  allowsReservation?: boolean;
}

export const STOCK_DOCUMENT_TYPES = {
  GOODS_RECEIPT: { label: "Goods Receipt", prefix: "GRN", permission: "inventory:create", operation: "increase-on-hand" },
  STOCK_IN: { label: "Stock In", prefix: "SIN", permission: "inventory:create", operation: "increase-on-hand", requiresReason: true },
  MATERIAL_RETURN: { label: "Material Return from Production", prefix: "MRT", permission: "inventory:create", operation: "increase-on-hand" },
  FG_RECEIPT: { label: "Finished Goods Receipt", prefix: "FGR", permission: "inventory:create", operation: "increase-on-hand" },
  STOCK_OUT: { label: "Stock Out", prefix: "SOUT", permission: "inventory:create", operation: "decrease-available", requiresReason: true },
  MATERIAL_ISSUE: { label: "Material Issue to Production", prefix: "MIS", permission: "inventory:create", operation: "decrease-available", allowsReservation: true },
  FG_DISPATCH: { label: "Finished Goods Dispatch", prefix: "FGD", permission: "inventory:create", operation: "decrease-available", allowsReservation: true },
  DAMAGE: { label: "Damaged / Rejected Stock", prefix: "DMG", permission: "inventory:adjust", operation: "decrease-available", requiresReason: true },
  TRANSFER: { label: "Warehouse Transfer", prefix: "TRF", permission: "inventory:transfer", operation: "decrease-available", destination: "increase-on-hand" },
  ADJUSTMENT: { label: "Stock Adjustment", prefix: "ADJ", permission: "inventory:adjust", operation: "signed-adjustment", requiresReason: true },
  COUNT: { label: "Physical Count Reconciliation", prefix: "CNT", permission: "inventory:adjust", operation: "count" },
  QC_HOLD: { label: "Quality Hold", prefix: "QCH", permission: "inventory:adjust", operation: "increase-hold", requiresReason: true },
  QC_RELEASE: { label: "Quality Hold Release", prefix: "QCR", permission: "inventory:adjust", operation: "decrease-hold" },
  QC_REJECT: { label: "Quality Rejection (scrap held stock)", prefix: "QCX", permission: "inventory:adjust", operation: "scrap-held", requiresReason: true },
} as const satisfies Record<string, DocumentTypeRule>;

export type StockDocumentType = keyof typeof STOCK_DOCUMENT_TYPES;

export const STOCK_DOCUMENT_TYPE_KEYS = Object.keys(STOCK_DOCUMENT_TYPES) as StockDocumentType[];

/* Reservation documents are posted by the reservation endpoints only. */
export const RESERVATION_DOCUMENT_TYPES = {
  RESERVATION: { label: "Reservation Against Order", prefix: "RSV" },
  RESERVATION_RELEASE: { label: "Reservation Release", prefix: "RRL" },
} as const;

export function documentTypeRule(type: string): DocumentTypeRule {
  const rule = (STOCK_DOCUMENT_TYPES as Record<string, DocumentTypeRule>)[type];

  if (!rule) {
    throw new RangeError(`Unknown stock document type: ${type}`);
  }

  return rule;
}

/*
 * Decimal places allowed per unit of measure. Countable units are whole
 * numbers; measured units allow three decimals. Unknown units allow three.
 */
const UNIT_DECIMALS: Record<string, number> = {
  pcs: 0,
  pieces: 0,
  sets: 0,
  boxes: 0,
  gross: 0,
  meters: 3,
  metres: 3,
  kgs: 3,
  kg: 3,
};

export function unitDecimals(unit: string): number {
  return UNIT_DECIMALS[unit.trim().toLowerCase()] ?? 3;
}

/* A typed location name as a location code: "Shelf 3 / Row 2" -> "SHELF-3-ROW-2". */
export function locationCodeFor(name: string) {
  return name.toUpperCase().replace(/[^A-Z0-9._]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "LOCATION";
}

export function quantityPrecisionError(quantity: number, unit: string): string | null {
  const allowed = unitDecimals(unit);
  const { scale } = toScaledDecimal(quantity);

  if (scale <= allowed) {
    return null;
  }

  return allowed === 0
    ? `Quantity for ${unit} must be a whole number.`
    : `Quantity for ${unit} can have at most ${allowed} decimal places.`;
}

export interface PlannedOperation {
  operation: BalanceOperation;
  productId: string;
  locationId: string;
  /** Positive magnitude, as an exact decimal string. */
  quantity: string;
  movementType: string;
  reservationId?: string;
}

/*
 * Applies operations in a fixed order (product, then location) so two
 * documents touching the same balances lock them in the same order and
 * cannot deadlock each other.
 */
export function orderForLocking<T extends { productId: string; locationId: string }>(
  operations: T[],
): T[] {
  return [...operations].sort((a, b) =>
    a.productId === b.productId
      ? a.locationId.localeCompare(b.locationId)
      : a.productId.localeCompare(b.productId),
  );
}

export function documentNumber(prefix: string, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(6, "0")}`;
}
