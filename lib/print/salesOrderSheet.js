/*
 * Builds the printable sales order sheet from GET /api/sales/orders/[id].
 *
 * Amounts are the server-calculated values. Nothing is recomputed in the
 * browser, so the printed document always matches the stored order.
 */

import {
  formatAmount,
  formatQuantity,
  formatUnitPrice,
} from "../formatters/formatters.js";

const DOCUMENT_TITLES = {
  DRAFT: "Sales Order (Draft)",
  APPROVED: "Order Confirmation",
  CANCELLED: "Sales Order (Cancelled)",
};

export { formatAmount, formatQuantity, formatUnitPrice };

function text(value) {
  return value === null || value === undefined || value === ""
    ? null
    : String(value);
}

export function toSalesOrderSheet(order) {
  const status = String(order?.status ?? "");

  return {
    title: DOCUMENT_TITLES[status] ?? "Sales Order",
    status,
    isFinal: status === "APPROVED",
    orderNumber: order?.orderNumber ?? "—",
    orderDate: text(order?.orderDate) ?? "—",
    deliveryDate: text(order?.deliveryDate) ?? "Not set",
    notes: text(order?.notes),

    customer: {
      name: order?.customer?.name ?? "—",
      code: text(order?.customer?.code),
      phone: text(order?.customer?.phone),
      email: text(order?.customer?.email),
    },

    lines: (order?.lines ?? []).map((line, index) => ({
      key: line.id ?? String(index),
      number: index + 1,
      description: line.productName ?? "—",
      isCustom: Boolean(line.isCustom),
      customerReference: text(line.customerReference),
      lineNotes: text(line.notes),
      sku: text(line.skuReference) ?? "—",
      category: text(line.category) ?? "—",
      variant: text(line.variant) ?? "—",
      quantity: formatQuantity(line.quantity),
      unit: text(line.unit) ?? "—",
      unitPrice: formatUnitPrice(line.unitPrice),
      discount: `${formatQuantity(line.discountPercent ?? 0)}%`,
      tax: `${formatQuantity(line.taxPercent ?? 0)}%`,
      lineTotal: formatAmount(line.lineTotal),
    })),

    totals: {
      subtotal: formatAmount(order?.subtotal),
      discount: formatAmount(order?.discountTotal),
      tax: formatAmount(order?.taxTotal),
      total: formatAmount(order?.totalAmount),
    },
  };
}
