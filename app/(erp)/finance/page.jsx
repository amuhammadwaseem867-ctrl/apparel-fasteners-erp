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
          <p>Invoicing, receivables, payables and the general ledger. Every invoice, receipt, bill, payment, payroll run and cash transaction posts a balanced journal entry.</p>
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
          <li><Link href="/finance/payables">Payables</Link>: supplier bills, payments and ageing.</li>
          <li><Link href="/finance/expenses">Expenses</Link> and <Link href="/finance/income">other income</Link>: cash and bank transactions.</li>
          <li><Link href="/finance/cash-bank">Cash &amp; bank</Link>: balances, statements and transfers.</li>
          <li><Link href="/finance/accounts">Chart of accounts</Link>, <Link href="/finance/transactions">journal</Link> and <Link href="/finance/reports">financial statements</Link> (profit and loss, balance sheet, trial balance).</li>
        </ul>
      </section>
    </main>
  );
}
