"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { RECEIPT_METHOD_LABELS, formatAmount, newKey, today } from "@/components/finance/financeUi";
import { apiRequest } from "@/lib/api/client";

/*
 * A payment from a customer (D-052): an installment on account (against the
 * old balance or the account as a whole), or for one open invoice, where it
 * cannot exceed what that invoice still owes.
 */
export default function CustomerPaymentDialog({ customer, invoices, balance, onClose, onDone }) {
  const open = invoices.filter((invoice) => invoice.status === "ISSUED" && Number(invoice.outstanding) > 0);
  const [values, setValues] = useState({ invoiceId: "", receiptDate: today(), method: "BANK_TRANSFER", reference: "", amount: "", notes: "" });
  const [key] = useState(newKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));
  const invoice = open.find((row) => row.id === values.invoiceId);

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest("/api/finance/receipts", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          idempotencyKey: key,
          customerId: customer.id,
          invoiceId: values.invoiceId || undefined,
          amount: Number(values.amount),
        }),
      });
      onDone();
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title={`Receive payment from ${customer.name}`}
      description={`Balance due ${formatAmount(balance)}. Installments of any amount are fine.`} size="medium">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-field">
          <label htmlFor="cp-against">Against</label>
          <select id="cp-against" value={values.invoiceId} onChange={set("invoiceId")}>
            <option value="">On account (old balance / whole account)</option>
            {open.map((row) => <option key={row.id} value={row.id}>Invoice {row.invoiceNumber} · owes {formatAmount(row.outstanding)}</option>)}
          </select>
        </div>
        <div className="inv-dialog__grid">
          <div className="inv-field"><label htmlFor="cp-date">Date *</label><input id="cp-date" type="date" required value={values.receiptDate} onChange={set("receiptDate")} /></div>
          <div className="inv-field"><label htmlFor="cp-amount">Amount *</label><input id="cp-amount" type="number" step="0.01" min="0.01" max={invoice?.outstanding} required value={values.amount} onChange={set("amount")} /></div>
          <div className="inv-field">
            <label htmlFor="cp-method">Method *</label>
            <select id="cp-method" value={values.method} onChange={set("method")}>
              {Object.entries(RECEIPT_METHOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="inv-field"><label htmlFor="cp-ref">Reference</label><input id="cp-ref" maxLength={120} placeholder="Cheque / transaction no." value={values.reference} onChange={set("reference")} /></div>
        </div>
        <div className="inv-field"><label htmlFor="cp-notes">Notes</label><textarea id="cp-notes" rows={2} maxLength={1000} value={values.notes} onChange={set("notes")} /></div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!(Number(values.amount) > 0)}>Save payment</Button>
        </div>
      </form>
    </Modal>
  );
}
