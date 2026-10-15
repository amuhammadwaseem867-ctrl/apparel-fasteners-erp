"use client";

import Link from "next/link";

import { formatAmount } from "@/components/procurement/procurementUi";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

export default function SupplierPerformancePage() {
  const result = useApiData("/api/procurement/performance");
  const rows = result.data?.suppliers ?? [];

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/procurement">Procurement</Link></p>
          <h1>Supplier performance</h1>
          <p>On-time: receipts on or before the PO&apos;s expected date, out of receipts on dated POs. Fill rate: received ÷ ordered on received or closed POs. Blank means there is not enough history yet.</p>
        </div>
      </header>
      <section className="inv-card">
        {result.error ? (
          <p className="inv-state inv-state--error" role="alert">{result.error}</p>
        ) : !result.data ? (
          <p className="inv-state" role="status">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">No suppliers yet.</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Supplier</th><th className="inv-num">Orders</th><th className="inv-num">Ordered value</th><th className="inv-num">Receipts</th><th className="inv-num">On time</th><th className="inv-num">Fill rate</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Supplier"><strong>{row.name}</strong><small>{row.code}</small></td>
                    <td data-label="Orders" className="inv-num">{row.orders}</td>
                    <td data-label="Ordered value" className="inv-num">{formatAmount(row.orderedValue)}</td>
                    <td data-label="Receipts" className="inv-num">{row.receipts}</td>
                    <td data-label="On time" className="inv-num">{row.onTimePercent === null ? "—" : `${row.onTimePercent}%`}</td>
                    <td data-label="Fill rate" className="inv-num">{row.fillRatePercent === null ? "—" : `${row.fillRatePercent}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
