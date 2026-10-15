"use client";

import Link from "next/link";
import { useState } from "react";

import InventoryPager from "@/components/inventory/InventoryPager";
import { RECEIPT_METHOD_LABELS, formatAmount } from "@/components/finance/financeUi";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

/* Customer receipts. Receipts are recorded and voided on the invoice. */
export default function PaymentsPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const receipts = useApiData(`/api/finance/receipts${toQuery({ status, search, page, pageSize: 25 })}`);
  const rows = receipts.data?.receipts ?? [];

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Finance</p>
          <h1>Customer Receipts</h1>
          <p>Money received against issued invoices. To record or void a receipt, open the invoice. Supplier payments arrive with procurement.</p>
        </div>
        <div className="inv-header__actions"><Link className="inv-link-button" href="/finance/invoices">Invoices</Link></div>
      </header>
      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field">
            <label htmlFor="rc-search">Search</label>
            <input id="rc-search" type="search" placeholder="Receipt, invoice, customer or reference" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          </div>
          <div className="inv-field">
            <label htmlFor="rc-status">Status</label>
            <select id="rc-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="POSTED">Posted</option>
              <option value="VOIDED">Voided</option>
            </select>
          </div>
        </div>
        {receipts.error ? (
          <p className="inv-state inv-state--error" role="alert">{receipts.error}</p>
        ) : !receipts.data ? (
          <p className="inv-state" role="status">Loading receipts…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">{search || status ? "No receipts match these filters." : "No receipts recorded yet."}</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Receipt</th><th>Date</th><th>Customer</th><th>Invoice</th><th>Method</th><th>Reference</th><th className="inv-num">Amount</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Receipt"><Link href={`/print/receipts/${row.id}`}><strong>{row.receiptNumber}</strong></Link></td>
                    <td data-label="Date">{row.receiptDate}</td>
                    <td data-label="Customer">{row.customerName}</td>
                    <td data-label="Invoice"><Link href={`/finance/invoices/${row.invoiceId}`}>{row.invoiceNumber}</Link></td>
                    <td data-label="Method">{RECEIPT_METHOD_LABELS[row.method]}</td>
                    <td data-label="Reference">{row.reference || "—"}</td>
                    <td data-label="Amount" className="inv-num">{formatAmount(row.amount)}</td>
                    <td data-label="Status">{row.status === "VOIDED" ? <span className="inv-badge inv-badge--danger">Voided</span> : <span className="inv-badge inv-badge--good">Posted</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={receipts.data?.hasMore} onChange={setPage} disabled={receipts.loading} />
      </section>
    </main>
  );
}
