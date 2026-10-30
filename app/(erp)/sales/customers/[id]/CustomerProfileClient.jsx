"use client";

/*
 * One customer's page (D-052): their orders with delivery, invoices,
 * payments (installments on account or per invoice), the old balance from
 * before the ERP and the ledger (khata) with a running balance and print.
 */

import Link from "next/link";
import { useState } from "react";
import { Printer } from "lucide-react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import CustomerPaymentDialog from "@/components/finance/CustomerPaymentDialog";
import { InvoiceStatusBadge, RECEIPT_METHOD_LABELS, formatAmount, today } from "@/components/finance/financeUi";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const day = (value) => (value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const amount = (value) => (Number(value) ? formatAmount(value) : "");
const balance = (value) => `${formatAmount(String(Math.abs(Number(value))))} ${Number(value) < 0 ? "Cr" : "Dr"}`;

function OpeningBalanceDialog({ customer, onClose, onDone }) {
  const [values, setValues] = useState({ amount: customer.openingBalance, date: customer.openingBalanceDate || today(), notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/api/customers/${customer.id}/opening-balance`, { method: "PUT", body: JSON.stringify({ ...values, amount: Number(values.amount) }) });
      onDone();
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={saving ? undefined : onClose} title="Old balance (before the ERP)"
      description="What the customer owed on the date you started using the ERP. Payments against it are recorded as payments on account." size="medium">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          <div className="inv-field"><label htmlFor="ob-amount">Amount owed *</label><input id="ob-amount" type="number" step="0.01" min="0" required value={values.amount} onChange={set("amount")} /></div>
          <div className="inv-field"><label htmlFor="ob-date">As on date *</label><input id="ob-date" type="date" required value={values.date} onChange={set("date")} /></div>
        </div>
        <div className="inv-field"><label htmlFor="ob-notes">Notes</label><input id="ob-notes" maxLength={500} value={values.notes} onChange={set("notes")} placeholder="e.g. from the old khata book" /></div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>Save old balance</Button>
        </div>
      </form>
    </Modal>
  );
}

function Ledger({ customerId, version }) {
  const [period, setPeriod] = useState({ from: "", to: "" });
  const ledger = useApiData(`/api/customers/${customerId}/ledger${toQuery({ ...period, v: version })}`);
  const data = ledger.data;
  return (
    <section className="inv-card" id="ledger">
      <div className="inv-card__header">
        <h2>Ledger</h2>
        <Link className="inv-link-button" href={`/print/customers/${customerId}/ledger${toQuery(period)}`}><Printer size={14} /> Print ledger</Link>
      </div>
      <div className="inv-toolbar">
        <div className="inv-field"><label htmlFor="lg-from">From</label><input id="lg-from" type="date" value={period.from} onChange={(event) => setPeriod((current) => ({ ...current, from: event.target.value }))} /></div>
        <div className="inv-field"><label htmlFor="lg-to">To</label><input id="lg-to" type="date" value={period.to} onChange={(event) => setPeriod((current) => ({ ...current, to: event.target.value }))} /></div>
      </div>
      {ledger.error ? <p className="inv-state inv-state--error" role="alert">{ledger.error}</p> : !data ? <p className="inv-state" role="status">Loading ledger…</p> : data.rows.length === 0 ? <p className="inv-state">No entries yet.</p> : (
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead><tr><th>Date</th><th>Ref. no.</th><th>Particulars</th><th className="inv-num">Debit</th><th className="inv-num">Credit</th><th className="inv-num">Balance</th></tr></thead>
            <tbody>
              {data.rows.map((row, index) => (
                <tr key={`${row.kind}-${row.sourceId ?? index}`}>
                  <td data-label="Date">{day(row.date)}</td>
                  <td data-label="Ref. no.">{row.kind === "INVOICE" ? <Link href={`/finance/invoices/${row.sourceId}`}>{row.reference}</Link> : row.kind === "RECEIPT" ? <Link href={`/print/receipts/${row.sourceId}`}>{row.reference}</Link> : row.reference || "—"}</td>
                  <td data-label="Particulars">{row.particulars}</td>
                  <td data-label="Debit" className="inv-num">{amount(row.debit)}</td>
                  <td data-label="Credit" className="inv-num">{amount(row.credit)}</td>
                  <td data-label="Balance" className="inv-num">{balance(row.balance)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3}><strong>Total</strong></td>
                <td className="inv-num"><strong>{formatAmount(data.totalDebit)}</strong></td>
                <td className="inv-num"><strong>{formatAmount(data.totalCredit)}</strong></td>
                <td className="inv-num"><strong>{balance(data.balance)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function CustomerProfileClient({ id }) {
  const { can } = useCurrentUser();
  const account = useApiData(`/api/customers/${encodeURIComponent(id)}/account`);
  const [dialog, setDialog] = useState(null);
  const [version, setVersion] = useState(0);
  const reload = () => { setDialog(null); account.reload(); setVersion((value) => value + 1); };

  if (account.error) return <main className="inv-page"><p className="inv-state inv-state--error" role="alert">{account.error}</p><Link href="/sales/customers">Back to customers</Link></main>;
  if (!account.data) return <main className="inv-page"><p className="inv-state" role="status">Loading customer…</p></main>;
  const { customer, summary, orders, invoices, receipts } = account.data;

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/sales/customers">Customers</Link></p>
          <h1>{customer.name}</h1>
          <p>{[customer.code, customer.contactPerson, customer.phone, customer.address].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="inv-header__actions">
          {can("finance:create") && <Button variant="secondary" onClick={() => setDialog("opening")}>Old balance</Button>}
          {can("finance:create") && <Button variant="primary" onClick={() => setDialog("payment")}>Receive payment</Button>}
          {can("finance:create") && <Link className="inv-link-button inv-link-button--primary" href="/finance/invoices/new">New invoice</Link>}
        </div>
      </header>

      <section className="inv-kpis" aria-label="Account">
        <div className="inv-kpi"><span>Old balance</span><strong>{formatAmount(summary.oldBalance)}</strong><small>{summary.oldLines > 0 ? `old khata, ${summary.oldLines} lines` : customer.openingBalanceDate ? `as on ${day(customer.openingBalanceDate)}` : "before the ERP"}</small></div>
        <div className="inv-kpi"><span>Invoiced</span><strong>{formatAmount(summary.invoiced)}</strong><small>{invoices.filter((row) => row.status === "ISSUED").length} approved invoices</small></div>
        <div className="inv-kpi"><span>Received</span><strong>{formatAmount(summary.received)}</strong><small>{Number(summary.onAccount) > 0 ? `${formatAmount(summary.onAccount)} on account` : "all payments"}</small></div>
        <div className={`inv-kpi ${Number(summary.balance) > 0 ? "inv-kpi--warning" : ""}`}><span>Balance due</span><strong>{balance(summary.balance)}</strong><small>from the ledger</small></div>
      </section>

      <section className="inv-card">
        <div className="inv-card__header"><h2>Orders</h2></div>
        {orders.length === 0 ? <p className="inv-state">No orders yet.</p> : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Delivery</th><th className="inv-num">Amount</th></tr></thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td data-label="Order"><Link href={`/sales/orders/${order.id}`}>{order.orderNumber}</Link></td>
                    <td data-label="Date">{day(order.orderDate)}</td>
                    <td data-label="Status">{order.status.toLowerCase()}</td>
                    <td data-label="Delivery">{order.delivery?.deliveryStatus ? `${order.delivery.deliveryStatus}${order.delivery.deliveryStatus !== "Delivered" && Number(order.delivery.left) > 0 ? ` · ${order.delivery.left} left` : ""}` : "—"}</td>
                    <td data-label="Amount" className="inv-num">{formatAmount(String(order.totalAmount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {account.data.ordersHasMore && <p className="inv-state">Showing the latest 100 orders. <Link href="/sales/orders">All orders</Link></p>}
      </section>

      <section className="inv-card">
        <div className="inv-card__header"><h2>Invoices</h2></div>
        {invoices.length === 0 ? <p className="inv-state">No invoices yet.</p> : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Invoice</th><th>Date</th><th>Due</th><th className="inv-num">Total</th><th className="inv-num">Received</th><th className="inv-num">Owes</th><th>Status</th></tr></thead>
              <tbody>
                {invoices.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Invoice"><Link href={`/finance/invoices/${row.id}`}>{row.invoiceNumber}</Link></td>
                    <td data-label="Date">{day(row.invoiceDate)}</td>
                    <td data-label="Due">{day(row.dueDate)}</td>
                    <td data-label="Total" className="inv-num">{formatAmount(row.total)}</td>
                    <td data-label="Received" className="inv-num">{formatAmount(row.received)}</td>
                    <td data-label="Owes" className="inv-num">{row.status === "ISSUED" ? formatAmount(row.outstanding) : "—"}</td>
                    <td data-label="Status"><InvoiceStatusBadge status={row.status} paymentStatus={row.paymentStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="inv-card">
        <div className="inv-card__header"><h2>Payments</h2></div>
        {receipts.length === 0 ? <p className="inv-state">No payments yet.</p> : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Receipt</th><th>Date</th><th>Against</th><th>Method</th><th>Reference</th><th className="inv-num">Amount</th><th>Status</th></tr></thead>
              <tbody>
                {receipts.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Receipt"><Link href={`/print/receipts/${row.id}`}>{row.receiptNumber}</Link></td>
                    <td data-label="Date">{day(row.receiptDate)}</td>
                    <td data-label="Against">{row.invoiceId ? <Link href={`/finance/invoices/${row.invoiceId}`}>{row.invoiceNumber}</Link> : "On account"}</td>
                    <td data-label="Method">{RECEIPT_METHOD_LABELS[row.method] ?? row.method}</td>
                    <td data-label="Reference">{row.reference || "—"}</td>
                    <td data-label="Amount" className="inv-num">{formatAmount(row.amount)}</td>
                    <td data-label="Status">{row.status === "VOIDED" ? <span className="inv-badge inv-badge--danger">Voided</span> : <span className="inv-badge inv-badge--good">Posted</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Ledger customerId={customer.id} version={version} />

      {dialog === "payment" && <CustomerPaymentDialog customer={customer} invoices={invoices} balance={summary.balance} onClose={() => setDialog(null)} onDone={reload} />}
      {dialog === "opening" && <OpeningBalanceDialog customer={customer} onClose={() => setDialog(null)} onDone={reload} />}
    </main>
  );
}
