"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { INVOICE_TYPE_LABELS, newKey, today } from "@/components/finance/financeUi";
import { apiRequest } from "@/lib/api/client";
import useApiData from "@/lib/inventory/useApiData";

/* Makes a draft invoice from a dispatched shipment (POST /api/finance/invoices). */
export default function NewInvoiceDialog({ salesOrderId = "", onClose, onCreated }) {
  const shipments = useApiData("/api/finance/uninvoiced-shipments");
  const [picked, setPicked] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [terms, setTerms] = useState("30");
  const [invoiceType, setInvoiceType] = useState("SALES_TAX");
  const [notes, setNotes] = useState("");
  const [key] = useState(newKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // From an order's page, only that order's shipments; the only one is chosen.
  const rows = (shipments.data?.shipments ?? []).filter((row) => !salesOrderId || row.salesOrderId === salesOrderId);
  const shipmentId = picked || (salesOrderId && rows.length === 1 ? rows[0].id : "");

  async function submit(event) {
    event.preventDefault();
    if (!shipmentId || saving) return;
    setSaving(true);
    setError("");
    try {
      onCreated(await apiRequest("/api/finance/invoices", {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: key, shipmentId, invoiceType, invoiceDate, paymentTermsDays: Number(terms), notes }),
      }));
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title="Invoice a shipment"
      description="The invoice bills exactly what was dispatched, at the sales order's prices and discounts, with or without sales tax. It is created as a draft for review before issuing."
      size="large">
      <form className="inv-dialog" onSubmit={submit}>
        {shipments.error ? (
          <p className="inv-dialog__error" role="alert">{shipments.error}</p>
        ) : !shipments.data ? (
          <p className="inv-state" role="status">Loading shipments…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">Every dispatched shipment has an invoice.</p>
        ) : (
          <div className="inv-field">
            <label htmlFor="in-shipment">Dispatched shipment *</label>
            <select id="in-shipment" required value={shipmentId} onChange={(event) => setPicked(event.target.value)}>
              <option value="">Select shipment</option>
              {rows.map((row) => (
                <option key={row.id} value={row.id}>{row.shipmentNumber} · {row.salesOrderNumber} · {row.customerName} · {row.lineCount} lines</option>
              ))}
            </select>
          </div>
        )}
        <div className="inv-field">
          <label htmlFor="in-type">Invoice type *</label>
          <select id="in-type" required value={invoiceType} onChange={(event) => setInvoiceType(event.target.value)}>
            {Object.entries(INVOICE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <small>{invoiceType === "NON_TAX" ? "No sales tax is charged. Prints in AF7's invoice layout without GST." : "GST at the sales order's tax rates. Prints as the sales tax invoice."}</small>
        </div>
        <div className="inv-dialog__grid">
          <div className="inv-field">
            <label htmlFor="in-date">Invoice date *</label>
            <input id="in-date" type="date" required value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />
          </div>
          <div className="inv-field">
            <label htmlFor="in-terms">Payment terms (days) *</label>
            <input id="in-terms" type="number" min="0" max="365" step="1" required value={terms} onChange={(event) => setTerms(event.target.value)} />
          </div>
        </div>
        <div className="inv-field">
          <label htmlFor="in-notes">Notes</label>
          <textarea id="in-notes" rows={2} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!shipmentId}>Create draft invoice</Button>
        </div>
      </form>
    </Modal>
  );
}
