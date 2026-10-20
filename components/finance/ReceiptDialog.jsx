"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { RECEIPT_METHOD_LABELS, formatAmount, newKey, today } from "@/components/finance/financeUi";
import { apiRequest } from "@/lib/api/client";

/* Records a customer payment against an issued invoice (POST /api/finance/receipts). */
export default function ReceiptDialog({ invoice, onClose, onDone }) {
  const [values, setValues] = useState({ receiptDate: today(), method: "BANK_TRANSFER", reference: "", amount: invoice.outstanding, notes: "" });
  const [key] = useState(newKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest("/api/finance/receipts", {
        method: "POST",
        body: JSON.stringify({ ...values, idempotencyKey: key, invoiceId: invoice.id, amount: Number(values.amount) }),
      });
      onDone();
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title={`Record receipt for ${invoice.invoiceNumber}`}
      description={`Outstanding ${formatAmount(invoice.outstanding)}. A receipt cannot exceed the outstanding balance.`} size="medium">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          <div className="inv-field"><label htmlFor="rc-date">Date *</label><input id="rc-date" type="date" required value={values.receiptDate} onChange={set("receiptDate")} /></div>
          <div className="inv-field"><label htmlFor="rc-amount">Amount *</label><input id="rc-amount" type="number" step="0.01" min="0.01" max={invoice.outstanding} required value={values.amount} onChange={set("amount")} /></div>
          <div className="inv-field">
            <label htmlFor="rc-method">Method *</label>
            <select id="rc-method" value={values.method} onChange={set("method")}>
              {Object.entries(RECEIPT_METHOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="inv-field"><label htmlFor="rc-ref">Reference</label><input id="rc-ref" maxLength={120} placeholder="Cheque / transaction no." value={values.reference} onChange={set("reference")} /></div>
        </div>
        <div className="inv-field"><label htmlFor="rc-notes">Notes</label><textarea id="rc-notes" rows={2} maxLength={1000} value={values.notes} onChange={set("notes")} /></div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!(Number(values.amount) > 0)}>Record receipt</Button>
        </div>
      </form>
    </Modal>
  );
}
