"use client";

import Link from "next/link";

import { formatAmount } from "@/components/finance/financeUi";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

export default function FinanceOverviewPage() {
  const summary = useApiData("/api/finance/summary");
  const data = summary.data;

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Finance</p>
          <h1>Finance</h1>
          <p>Invoicing and receivables from dispatched shipments. This is not a general ledger: there are no accounts, journals or financial statements yet.</p>
        </div>
        <div className="inv-header__actions"><Link className="inv-link-button" href="/finance/invoices">Invoices</Link></div>
      </header>
      {summary.error ? (
        <p className="inv-dialog__error" role="alert">{summary.error}</p>
      ) : !data ? (
        <p className="inv-state" role="status">Loading finance summary…</p>
      ) : (
        <section className="inv-kpis" aria-label="Finance">
          <div className="inv-kpi"><span>Receivable</span><strong>{formatAmount(data.receivable)}</strong><small>{data.openInvoices} open invoices</small></div>
          <div className={`inv-kpi ${Number(data.overdue) > 0 ? "inv-kpi--danger" : ""}`}><span>Overdue</span><strong>{formatAmount(data.overdue)}</strong></div>
          <div className="inv-kpi"><span>Invoiced, last 30 days</span><strong>{formatAmount(data.invoicedLast30Days)}</strong><small>issued invoices</small></div>
          <div className="inv-kpi"><span>Received, last 30 days</span><strong>{formatAmount(data.receivedLast30Days)}</strong><small>posted receipts</small></div>
          <div className={`inv-kpi ${data.uninvoicedShipments ? "inv-kpi--warning" : ""}`}><span>Shipments to invoice</span><strong>{data.uninvoicedShipments}</strong></div>
          <div className="inv-kpi"><span>Draft invoices</span><strong>{data.draftInvoices}</strong></div>
        </section>
      )}
      <section className="inv-card">
        <div className="inv-card__header"><h2>Finance areas</h2></div>
        <ul style={{ margin: 0, padding: "12px 32px", fontSize: 13 }}>
          <li><Link href="/finance/invoices">Invoices</Link>: invoice dispatched shipments, issue, credit and record receipts.</li>
          <li><Link href="/finance/payments">Receipts</Link>: customer payments.</li>
          <li><Link href="/finance/receivables">Receivables</Link>: ageing by customer.</li>
          <li>Accounts, income, expenses, payables, cash &amp; bank, transactions and financial reports: not implemented yet.</li>
        </ul>
      </section>
    </main>
  );
}
