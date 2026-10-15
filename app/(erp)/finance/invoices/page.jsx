"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import InventoryPager from "@/components/inventory/InventoryPager";
import { InvoiceStatusBadge, formatAmount, newKey, today } from "@/components/finance/financeUi";
import { apiRequest } from "@/lib/api/client";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

/* Creates a DRAFT invoice for one dispatched, uninvoiced shipment. */
function NewInvoiceDialog({ onClose, onCreated }) {
  const shipments = useApiData("/api/finance/uninvoiced-shipments");
  const [shipmentId, setShipmentId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [terms, setTerms] = useState("30");
  const [notes, setNotes] = useState("");
  const [key] = useState(newKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const rows = shipments.data?.shipments ?? [];

  async function submit(event) {
    event.preventDefault();
    if (!shipmentId || saving) return;
    setSaving(true);
    setError("");
    try {
      onCreated(await apiRequest("/api/finance/invoices", {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: key, shipmentId, invoiceDate, paymentTermsDays: Number(terms), notes }),
      }));
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title="Invoice a shipment"
      description="The invoice bills exactly what was dispatched, at the sales order's prices, discounts and tax. It is created as a draft for review before issuing."
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
            <select id="in-shipment" required value={shipmentId} onChange={(event) => setShipmentId(event.target.value)}>
              <option value="">Select shipment</option>
              {rows.map((row) => (
                <option key={row.id} value={row.id}>{row.shipmentNumber} · {row.salesOrderNumber} · {row.customerName} · {row.lineCount} lines</option>
              ))}
            </select>
          </div>
        )}
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

export default function InvoicesPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [balance, setBalance] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const invoices = useApiData(`/api/finance/invoices${toQuery({ status, balance, search, page, pageSize: 25 })}`);
  const rows = invoices.data?.invoices ?? [];

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Finance</p>
          <h1>Invoices</h1>
          <p>Customer invoices for dispatched shipments. Issued invoices are never edited or deleted; they are corrected with credit notes.</p>
        </div>
        <div className="inv-header__actions">
          <Button variant="primary" onClick={() => setCreating(true)}>Invoice a shipment</Button>
        </div>
      </header>

      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field">
            <label htmlFor="in-search">Search</label>
            <input id="in-search" type="search" placeholder="Invoice, customer, order or shipment" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          </div>
          <div className="inv-field">
            <label htmlFor="in-status">Status</label>
            <select id="in-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="DRAFT">Draft</option>
              <option value="ISSUED">Issued</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div className="inv-field">
            <label htmlFor="in-balance">Balance</label>
            <select id="in-balance" value={balance} onChange={(event) => { setBalance(event.target.value); setPage(1); }}>
              <option value="">Any</option>
              <option value="open">Outstanding</option>
              <option value="overdue">Overdue</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </div>
        {invoices.error ? (
          <p className="inv-state inv-state--error" role="alert">{invoices.error}</p>
        ) : !invoices.data ? (
          <p className="inv-state" role="status">Loading invoices…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">{search || status || balance ? "No invoices match these filters." : "No invoices yet. Dispatch a shipment, then invoice it."}</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Invoice</th><th>Customer</th><th>Order / shipment</th><th>Due</th><th className="inv-num">Total</th><th className="inv-num">Outstanding</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Invoice"><Link href={`/finance/invoices/${row.id}`}><strong>{row.invoiceNumber}</strong></Link><small>{row.invoiceDate}</small></td>
                    <td data-label="Customer">{row.customerName}</td>
                    <td data-label="Order / shipment">{row.salesOrderNumber}<small>{row.shipmentNumber}</small></td>
                    <td data-label="Due">{row.dueDate}{row.daysOverdue > 0 && <small className="inv-neg">{row.daysOverdue} days overdue</small>}</td>
                    <td data-label="Total" className="inv-num">{formatAmount(row.totalAmount)}</td>
                    <td data-label="Outstanding" className="inv-num">{row.status === "ISSUED" ? formatAmount(row.outstanding) : "—"}</td>
                    <td data-label="Status"><InvoiceStatusBadge status={row.status} paymentStatus={row.paymentStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={invoices.data?.hasMore} onChange={setPage} disabled={invoices.loading} />
      </section>

      {creating && <NewInvoiceDialog onClose={() => setCreating(false)} onCreated={(created) => router.push(`/finance/invoices/${created.id}`)} />}
    </main>
  );
}
