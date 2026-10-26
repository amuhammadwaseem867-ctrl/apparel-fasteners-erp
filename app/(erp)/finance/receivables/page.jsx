"use client";

import Link from "next/link";

import { formatAmount } from "@/components/finance/financeUi";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const LABELS = { current: "Not yet due", "1-30": "1–30 days", "31-60": "31–60 days", "61-90": "61–90 days", "90+": "Over 90 days" };

/* Outstanding issued invoices by customer, aged by days past the due date. */
export default function ReceivablesPage() {
  const report = useApiData("/api/finance/receivables");
  const data = report.data;

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Finance</p>
          <h1>Receivables</h1>
          <p>What customers owe on issued invoices (total − credit notes − posted receipts), aged by days past the due date{data ? ` as of ${data.asOf}` : ""}.</p>
        </div>
        <div className="inv-header__actions"><Link className="inv-link-button" href="/finance/invoices">Invoices</Link></div>
      </header>
      {report.error ? (
        <p className="inv-dialog__error" role="alert">{report.error}</p>
      ) : !data ? (
        <p className="inv-state" role="status">Loading receivables…</p>
      ) : (
        <>
          <section className="inv-kpis" aria-label="Ageing totals">
            <div className="inv-kpi"><span>Total receivable</span><strong>{formatAmount(data.totals.total)}</strong><small>{data.totals.invoices} open invoices</small></div>
            {data.buckets.map((bucket) => (
              <div key={bucket} className={`inv-kpi ${bucket !== "current" && Number(data.totals.buckets[bucket]) > 0 ? "inv-kpi--danger" : ""}`}><span>{LABELS[bucket]}</span><strong>{formatAmount(data.totals.buckets[bucket])}</strong></div>
            ))}
          </section>
          <section className="inv-card">
            <div className="inv-card__header"><h2>By customer</h2></div>
            {data.customers.length === 0 ? (
              <p className="inv-state">Nothing is outstanding.</p>
            ) : (
              <div className="inv-table-wrap">
                <table className="inv-table">
                  <thead><tr><th>Customer</th><th className="inv-num">Invoices</th>{data.buckets.map((bucket) => <th key={bucket} className="inv-num">{LABELS[bucket]}</th>)}<th className="inv-num">Total</th></tr></thead>
                  <tbody>
                    {data.customers.map((row) => (
                      <tr key={row.customerId}>
                        <td data-label="Customer"><Link href={`/sales/customers/${row.customerId}`}><strong>{row.customerName}</strong></Link></td>
                        <td data-label="Invoices" className="inv-num">{row.invoices}</td>
                        {data.buckets.map((bucket) => (
                          <td key={bucket} data-label={LABELS[bucket]} className={`inv-num ${bucket !== "current" && Number(row.buckets[bucket]) > 0 ? "inv-neg" : ""}`}>{formatAmount(row.buckets[bucket])}</td>
                        ))}
                        <td data-label="Total" className="inv-num"><strong>{formatAmount(row.total)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
