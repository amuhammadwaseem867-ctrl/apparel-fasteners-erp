"use client";

import { formatAmount } from "@/lib/formatters/formatters";

export { formatAmount };

export const INVOICE_TYPE_LABELS = {
  SALES_TAX: "Sales tax invoice (GST)",
  NON_TAX: "Non sales tax invoice",
};

export const RECEIPT_METHOD_LABELS = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
  CHEQUE: "Cheque",
  CARD: "Card",
  OTHER: "Other",
};

export function InvoiceStatusBadge({ status, paymentStatus }) {
  if (status === "DRAFT") return <span className="inv-badge inv-badge--warning">Draft</span>;
  if (status === "CANCELLED") return <span className="inv-badge inv-badge--danger">Cancelled</span>;
  const tone = paymentStatus === "PAID" ? "good" : paymentStatus === "PARTIALLY_PAID" ? "warning" : "";
  const label = paymentStatus === "PAID" ? "Paid" : paymentStatus === "PARTIALLY_PAID" ? "Part paid" : "Issued · unpaid";
  return <span className={`inv-badge ${tone ? `inv-badge--${tone}` : ""}`}>{label}</span>;
}

export function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function newKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
