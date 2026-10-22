"use client";

import Link from "next/link";
import { useState } from "react";

import InventoryPager from "@/components/inventory/InventoryPager";
import { INVOICE_TYPE_LABELS, InvoiceStatusBadge, formatAmount } from "@/components/finance/financeUi";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

export default function InvoicesPage() {
  const [status, setStatus] = useState("");
  const [balance, setBalance] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
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
          <Link className="inv-link-button inv-link-button--primary" href="/finance/invoices/new">New invoice</Link>
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
          <p className="inv-state" role="status">Loading invoicesâ€¦</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">{search || status || balance ? "No invoices match these filters." : "No invoices yet. Dispatch a shipment, then invoice it."}</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Invoice</th><th>Customer</th><th>Order / shipment</th><th>Due</th><th className="inv-num">Total</th><th className="inv-num">Outstanding</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Invoice"><Link href={`/finance/invoices/${row.id}`}><strong>{row.invoiceNumber}</strong></Link><small>{row.invoiceDate} · {INVOICE_TYPE_LABELS[row.invoiceType] ?? row.invoiceType}</small></td>
                    <td data-label="Customer">{row.customerName}</td>
                    <td data-label="Order / shipment">{row.salesOrderNumber}<small>{row.shipmentNumber}</small></td>
                    <td data-label="Due">{row.dueDate}{row.daysOverdue > 0 && <small className="inv-neg">{row.daysOverdue} days overdue</small>}</td>
                    <td data-label="Total" className="inv-num">{formatAmount(row.totalAmount)}</td>
                    <td data-label="Outstanding" className="inv-num">{row.status === "ISSUED" ? formatAmount(row.outstanding) : "â€”"}</td>
                    <td data-label="Status"><InvoiceStatusBadge status={row.status} paymentStatus={row.paymentStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={invoices.data?.hasMore} onChange={setPage} disabled={invoices.loading} />
      </section>

    </main>
  );
}

