/*
 * Builds the printable sales order sheet from GET /api/sales/orders/[id].
 *
 * Amounts are the server-calculated values. Nothing is recomputed in the
 * browser, so the printed document always matches the stored order.
 */

const DOCUMENT_TITLES = {
  DRAFT: "Sales Order (Draft)",
  APPROVED: "Order Confirmation",
  CANCELLED: "Sales Order (Cancelled)",
};

export function formatAmount(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    : "—";
}

/*
 * Unit prices are stored as unscaled numeric, so sub-cent prices (common
 * for fastener components) must print with their stored precision.
 */
export function formatUnitPrice(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    })
    : "—";
}

export function formatQuantity(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number.toLocaleString("en-US", { maximumFractionDigits: 4 })
    : "—";
}

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
