"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ReceiptDialog from "@/components/finance/ReceiptDialog";
import { INVOICE_TYPE_LABELS, InvoiceStatusBadge, RECEIPT_METHOD_LABELS, formatAmount, newKey, today } from "@/components/finance/financeUi";
import { apiRequest } from "@/lib/api/client";
import useApiData from "@/lib/inventory/useApiData";
import { subtractDecimalStrings } from "@/server/core/utils/decimal";

import "@/components/inventory/InventoryWorkspace.css";

function CreditNoteDialog({ invoice, onClose, onDone }) {
  const [quantities, setQuantities] = useState({});
  const [reason, setReason] = useState("");
  const [creditDate, setCreditDate] = useState(today);
  const [key] = useState(newKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lines = Object.entries(quantities).filter(([, quantity]) => Number(quantity) > 0);
  const ready = lines.length > 0 && reason.trim().length >= 3;

  async function submit(event) {
    event.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest("/api/finance/credit-notes", {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: key, invoiceId: invoice.id, creditDate, reason, lines: lines.map(([invoiceLineId, quantity]) => ({ invoiceLineId, quantity: Number(quantity) })) }),
      });
      onDone();
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title={`Credit note for ${invoice.invoiceNumber}`}
      description="Credit quantities of invoiced lines (returns or corrections). Amounts are computed at the invoiced price, discount and tax; the credit cannot exceed what is outstanding. Returned goods are received into stock separately."
      size="large">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead><tr><th>Line</th><th className="inv-num">Invoiced</th><th className="inv-num">Credited</th><th className="inv-num">Credit now</th></tr></thead>
            <tbody>
              {invoice.lines.map((line) => {
                const left = subtractDecimalStrings(line.quantity, line.creditedQuantity);
                return (
                  <tr key={line.id}>
                    <td data-label="Line"><strong>{line.description}</strong><small>{line.sku} · {formatAmount(line.lineTotal)}</small></td>
                    <td data-label="Invoiced" className="inv-num">{line.quantity} {line.unit}</td>
                    <td data-label="Credited" className="inv-num">{line.creditedQuantity}</td>
                    <td data-label="Credit now" className="inv-num">
                      <input aria-label={`Quantity to credit for line ${line.lineNo}`} type="number" step="any" min="0" max={left} style={{ width: 110 }}
                        disabled={Number(left) <= 0} value={quantities[line.id] ?? ""} onChange={(event) => setQuantities((current) => ({ ...current, [line.id]: event.target.value }))} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="inv-dialog__grid">
          <div className="inv-field"><label htmlFor="cn-date">Credit date *</label><input id="cn-date" type="date" required value={creditDate} onChange={(event) => setCreditDate(event.target.value)} /></div>
          <div className="inv-field"><label htmlFor="cn-reason">Reason *</label><input id="cn-reason" required minLength={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></div>
        </div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!ready}>Issue credit note</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function InvoiceClient({ id }) {
  const invoice = useApiData(`/api/finance/invoices/${id}`);
  const [dialog, setDialog] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const data = invoice.data;

  async function act(action) {
    if (busy) return;
    let reason = "";
    if (action === "issue" && !window.confirm("Approve this invoice? The order goes to Orders, ready for production. An approved invoice cannot be edited; corrections need a credit note.")) return;
    if (action === "cancel") {
      reason = window.prompt("Reason for cancelling this draft") ?? "";
      if (!reason.trim()) return;
    }
    setBusy(action);
    setError("");
    try {
      await apiRequest(`/api/finance/invoices/${id}`, { method: "PATCH", body: JSON.stringify({ action, reason }) });
      invoice.reload();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy("");
    }
  }

  async function voidReceipt(receipt) {
    const reason = window.prompt(`Void ${receipt.receiptNumber}? Give the reason (e.g. bounced cheque).`) ?? "";
    if (reason.trim().length < 3) return;
    setError("");
    try {
      await apiRequest(`/api/finance/receipts/${receipt.id}`, { method: "PATCH", body: JSON.stringify({ reason }) });
      invoice.reload();
    } catch (cause) {
      setError(cause.message);
    }
  }

  if (invoice.error && !data) return <main className="inv-page"><p className="inv-dialog__error" role="alert">{invoice.error}</p></main>;
  if (!data) return <main className="inv-page"><p className="inv-state" role="status">Loading invoice…</p></main>;
  const open = data.status === "ISSUED" && Number(data.outstanding) > 0;

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/finance/invoices">Invoices</Link></p>
          <h1>{data.invoiceNumber} <InvoiceStatusBadge status={data.status} paymentStatus={data.paymentStatus} /></h1>
          <p>{INVOICE_TYPE_LABELS[data.invoiceType] ?? data.invoiceType} · {data.customerName} · <Link href={`/sales/orders/${data.salesOrderId}`}>order {data.salesOrderNumber}</Link>{data.shipmentId ? <> · <Link href={`/dispatch/shipments/${data.shipmentId}`}>{data.shipmentNumber}</Link></> : null} · dated {data.invoiceDate} · due {data.dueDate}{data.daysOverdue > 0 ? ` · ${data.daysOverdue} days overdue` : ""}</p>
        </div>
        <div className="inv-header__actions">
          {data.status === "DRAFT" && <Button variant="secondary" loading={busy === "cancel"} onClick={() => act("cancel")}>Cancel draft</Button>}
          {data.status === "DRAFT" && !data.shipmentId && <Link className="inv-link-button" href={`/finance/invoices/${data.id}/edit`}>Edit</Link>}
          {data.status === "DRAFT" && <Button variant="primary" loading={busy === "issue"} onClick={() => act("issue")}>Approve invoice</Button>}
          {open && <Button variant="secondary" onClick={() => setDialog("credit")}>Credit note</Button>}
          {open && <Button variant="primary" onClick={() => setDialog("receipt")}>Record receipt</Button>}
          <Link className="inv-link-button" href={`/print/invoices/${data.id}`}>Print invoice</Link>
          <Link className="inv-link-button" href={`/print/sales-orders/${data.salesOrderId}`}>Print order sheet (no rates)</Link>
        </div>
      </header>

      {error && <p className="inv-dialog__error" role="alert">{error}</p>}
      {data.status === "CANCELLED" && <p className="inv-state inv-state--error">Cancelled{data.cancelReason ? `: ${data.cancelReason}` : ""}.</p>}

      <section className="inv-kpis" aria-label="Balance">
        <div className="inv-kpi"><span>Invoice total</span><strong>{formatAmount(data.totalAmount)}</strong><small>{data.invoiceType === "NON_TAX" ? "no sales tax" : `incl. tax ${formatAmount(data.taxTotal)}`}</small></div>
        <div className="inv-kpi"><span>Credited</span><strong>{formatAmount(data.credited)}</strong></div>
        <div className="inv-kpi"><span>Received</span><strong>{formatAmount(data.received)}</strong></div>
        <div className={`inv-kpi ${data.daysOverdue > 0 ? "inv-kpi--danger" : ""}`}><span>Outstanding</span><strong>{data.status === "ISSUED" ? formatAmount(data.outstanding) : "—"}</strong></div>
      </section>

      <section className="inv-card">
        <div className="inv-card__header"><h2>Lines</h2><small>Gross = quantity × price, discount on gross, tax on gross − discount; each rounded half up to the cent.</small></div>
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead><tr><th className="inv-num">#</th><th>Item</th><th className="inv-num">Qty</th><th className="inv-num">Price</th><th className="inv-num">Gross</th><th className="inv-num">Disc.</th><th className="inv-num">Tax</th><th className="inv-num">Total</th></tr></thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={line.id}>
                  <td data-label="#" className="inv-num">{line.lineNo}</td>
                  <td data-label="Item"><strong>{line.description}</strong><small>{line.sku}{Number(line.creditedQuantity) > 0 ? ` · ${line.creditedQuantity} credited` : ""}</small></td>
                  <td data-label="Qty" className="inv-num">{line.quantity} {line.unit}</td>
                  <td data-label="Price" className="inv-num">{line.unitPrice}</td>
                  <td data-label="Gross" className="inv-num">{formatAmount(line.grossAmount)}</td>
                  <td data-label="Disc." className="inv-num">{formatAmount(line.discountAmount)}<small>{line.discountPercent}%</small></td>
                  <td data-label="Tax" className="inv-num">{formatAmount(line.taxAmount)}<small>{line.taxPercent}%</small></td>
                  <td data-label="Total" className="inv-num"><strong>{formatAmount(line.lineTotal)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="inv-card">
        <div className="inv-card__header"><h2>Receipts</h2></div>
        {data.receipts.length === 0 ? <p className="inv-state">No receipts recorded.</p> : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Receipt</th><th>Date</th><th>Method</th><th>Reference</th><th className="inv-num">Amount</th><th>Status</th><th /></tr></thead>
              <tbody>
                {data.receipts.map((receipt) => (
                  <tr key={receipt.id}>
                    <td data-label="Receipt"><Link href={`/print/receipts/${receipt.id}`}>{receipt.receiptNumber}</Link></td>
                    <td data-label="Date">{receipt.receiptDate}</td>
                    <td data-label="Method">{RECEIPT_METHOD_LABELS[receipt.method]}</td>
                    <td data-label="Reference">{receipt.reference || "—"}</td>
                    <td data-label="Amount" className={`inv-num ${receipt.status === "VOIDED" ? "inv-neg" : ""}`}>{formatAmount(receipt.amount)}</td>
                    <td data-label="Status">{receipt.status === "VOIDED" ? <span className="inv-badge inv-badge--danger" title={receipt.voidReason ?? ""}>Voided</span> : <span className="inv-badge inv-badge--good">Posted</span>}</td>
                    <td data-label="Actions">{receipt.status === "POSTED" && <button type="button" className="inv-text-button" onClick={() => voidReceipt(receipt)}>Void</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="inv-card">
        <div className="inv-card__header"><h2>Credit notes</h2></div>
        {data.creditNotes.length === 0 ? <p className="inv-state">No credit notes.</p> : (
          <ul style={{ margin: 0, padding: "12px 32px", fontSize: 13 }}>
            {data.creditNotes.map((note) => (
              <li key={note.id}><Link href={`/print/credit-notes/${note.id}`}>{note.creditNumber}</Link> · {note.creditDate} · {formatAmount(note.totalAmount)} · {note.reason}</li>
            ))}
          </ul>
        )}
      </section>

      {dialog === "receipt" && <ReceiptDialog invoice={data} onClose={() => setDialog("")} onDone={() => { setDialog(""); invoice.reload(); }} />}
      {dialog === "credit" && <CreditNoteDialog invoice={data} onClose={() => setDialog("")} onDone={() => { setDialog(""); invoice.reload(); }} />}
    </main>
  );
}
