"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { RECEIPT_METHOD_LABELS } from "@/components/finance/financeUi";
import { ProcStatusBadge, formatAmount, newKey, today } from "@/components/procurement/procurementUi";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

function PaymentDialog({ bill, onClose, onDone }) {
  const [values, setValues] = useState({ paymentDate: today(), method: "BANK_TRANSFER", reference: "", amount: bill.outstandingAmount, notes: "" });
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
      await apiRequest("/api/procurement/payments", { method: "POST", body: JSON.stringify({ ...values, idempotencyKey: key, billId: bill.id, amount: Number(values.amount) }) });
      onDone();
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title={`Pay ${bill.billNumber}`} description={`Outstanding ${formatAmount(bill.outstandingAmount)}. A payment cannot exceed the outstanding balance.`} size="medium">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          <div className="inv-field"><label htmlFor="sp-date">Date *</label><input id="sp-date" type="date" required value={values.paymentDate} onChange={set("paymentDate")} /></div>
          <div className="inv-field"><label htmlFor="sp-amount">Amount *</label><input id="sp-amount" type="number" step="0.01" min="0.01" max={bill.outstandingAmount} required value={values.amount} onChange={set("amount")} /></div>
          <div className="inv-field">
            <label htmlFor="sp-method">Method *</label>
            <select id="sp-method" value={values.method} onChange={set("method")}>{Object.entries(RECEIPT_METHOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </div>
          <div className="inv-field"><label htmlFor="sp-ref">Reference</label><input id="sp-ref" maxLength={120} placeholder="Cheque / transaction no." value={values.reference} onChange={set("reference")} /></div>
        </div>
        <div className="inv-field"><label htmlFor="sp-notes">Notes</label><textarea id="sp-notes" rows={2} maxLength={500} value={values.notes} onChange={set("notes")} /></div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!(Number(values.amount) > 0)}>Record payment</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function BillClient({ id }) {
  const { can } = useCurrentUser();
  const result = useApiData(`/api/procurement/bills/${encodeURIComponent(id)}`);
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const data = result.data;

  async function act(action) {
    const reason = action === "cancel" ? window.prompt("Reason for cancelling this bill?") : "";
    if (reason === null || (action === "cancel" && !reason)) return;
    setBusy(action);
    setError("");
    try {
      await apiRequest(`/api/procurement/bills/${id}`, { method: "PATCH", body: JSON.stringify({ action, reason }) });
      result.reload();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy("");
    }
  }

  async function voidPayment(payment) {
    const reason = window.prompt(`Reason for voiding ${payment.paymentNumber}?`);
    if (!reason) return;
    setBusy(payment.id);
    setError("");
    try {
      await apiRequest(`/api/procurement/payments/${payment.id}`, { method: "PATCH", body: JSON.stringify({ reason }) });
      result.reload();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy("");
    }
  }

  if (result.error) return <main className="inv-page"><p className="inv-state inv-state--error" role="alert">{result.error}</p><Link href="/finance/payables">Back to payables</Link></main>;
  if (!data) return <main className="inv-page"><p className="inv-state" role="status">Loading bill…</p></main>;

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/finance/payables">Payables</Link></p>
          <h1>{data.billNumber} <ProcStatusBadge status={data.status} />{data.paymentStatus && <> <span className={`inv-badge ${data.paymentStatus === "PAID" ? "inv-badge--good" : "inv-badge--warning"}`}>{data.paymentStatus === "PAID" ? "Paid" : data.paymentStatus === "PARTIALLY_PAID" ? "Part paid" : "Unpaid"}</span></>}</h1>
          <p>
            {data.supplierName} · supplier invoice {data.supplierInvoiceNumber} · dated {data.billDate} · due {data.dueDate}
            {data.daysOverdue > 0 ? ` (${data.daysOverdue} days overdue)` : ""}
            {data.poNumber && <> · <Link href={`/procurement/purchase-orders/${data.purchaseOrderId}`}>{data.poNumber}</Link></>}
            {data.cancelReason ? ` · Cancelled: ${data.cancelReason}` : ""}
          </p>
        </div>
        <div className="inv-header__actions">
          {data.status === "DRAFT" && can("finance:approve") && <Button variant="primary" loading={busy === "approve"} onClick={() => act("approve")}>Approve bill</Button>}
          {data.status === "APPROVED" && Number(data.outstandingAmount) > 0 && can("finance:create") && <Button variant="primary" onClick={() => setPaying(true)}>Record payment</Button>}
          {data.status !== "CANCELLED" && can("finance:approve") && <Button variant="secondary" loading={busy === "cancel"} onClick={() => act("cancel")}>Cancel bill</Button>}
        </div>
      </header>
      {error && <p className="inv-dialog__error" role="alert">{error}</p>}
      <section className="inv-card">
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead><tr><th>#</th><th>Description</th><th className="inv-num">Qty</th><th className="inv-num">Price</th><th className="inv-num">Tax</th><th className="inv-num">Amount</th><th>Match (ordered / received / billed · PO price)</th></tr></thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={line.id}>
                  <td data-label="#">{line.lineNo}</td>
                  <td data-label="Description">{line.description}</td>
                  <td data-label="Qty" className="inv-num">{line.quantity}</td>
                  <td data-label="Price" className="inv-num">{line.unitPrice}</td>
                  <td data-label="Tax" className="inv-num">{formatAmount(line.taxAmount)}</td>
                  <td data-label="Amount" className="inv-num">{formatAmount(line.lineTotal)}</td>
                  <td data-label="Match">
                    {line.match ? (
                      <>
                        {line.match.ordered} / {line.match.received} / {line.match.billed} · {line.match.poUnitPrice}{" "}
                        {line.match.priceOk ? <span className="inv-badge inv-badge--good">Price OK</span> : <span className="inv-badge inv-badge--danger">Above PO price</span>}
                      </>
                    ) : "Not against a PO"}
                  </td>
                </tr>
              ))}
              <tr><td colSpan={5}>Subtotal · discount · tax</td><td className="inv-num" colSpan={2}>{formatAmount(data.subtotal)} · {formatAmount(data.discountTotal)} · {formatAmount(data.taxTotal)}</td></tr>
              <tr><td colSpan={5}><strong>Total</strong></td><td className="inv-num"><strong>{formatAmount(data.totalAmount)}</strong></td><td>Paid {formatAmount(data.paidAmount)} · outstanding {formatAmount(data.outstandingAmount)}</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="inv-card">
        <h2 style={{ padding: "12px 18px 0" }}>Payments</h2>
        {data.payments.length === 0 ? <p className="inv-state">No payments recorded.</p> : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Payment</th><th>Date</th><th>Method</th><th>Reference</th><th className="inv-num">Amount</th><th>Status</th><th /></tr></thead>
              <tbody>
                {data.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td data-label="Payment">{payment.paymentNumber}</td>
                    <td data-label="Date">{payment.paymentDate}</td>
                    <td data-label="Method">{RECEIPT_METHOD_LABELS[payment.method]}</td>
                    <td data-label="Reference">{payment.reference || "—"}</td>
                    <td data-label="Amount" className="inv-num">{formatAmount(payment.amount)}</td>
                    <td data-label="Status"><ProcStatusBadge status={payment.status} />{payment.voidReason && <small>{payment.voidReason}</small>}</td>
                    <td>{payment.status === "POSTED" && can("finance:approve") && <Button variant="secondary" loading={busy === payment.id} onClick={() => voidPayment(payment)}>Void</Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {paying && <PaymentDialog bill={data} onClose={() => setPaying(false)} onDone={() => { setPaying(false); result.reload(); }} />}
    </main>
  );
}
