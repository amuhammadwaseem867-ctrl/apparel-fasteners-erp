"use client";

import Link from "next/link";

import { formatAmount } from "@/components/procurement/procurementUi";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const TILES = [
  { key: "buySuggestions", label: "MRP buy suggestions", hint: "Confirmed, not yet requisitioned", href: "/procurement/requisitions?new=mrp" },
  { key: "requisitionsToApprove", label: "Requisitions to approve", hint: "Submitted", href: "/procurement/requisitions?status=SUBMITTED" },
  { key: "requisitionsToOrder", label: "Approved requisitions", hint: "Ready for RFQ or PO", href: "/procurement/requisitions?status=APPROVED" },
  { key: "openRfqs", label: "Open RFQs", hint: "Collecting quotes", href: "/procurement/rfqs?status=OPEN" },
  { key: "draftOrders", label: "Draft purchase orders", hint: "Awaiting approval", href: "/procurement/purchase-orders?status=DRAFT" },
  { key: "openOrders", label: "Open purchase orders", hint: "Approved, not fully received", href: "/procurement/purchase-orders?status=OPEN" },
  { key: "lateOrders", label: "Late deliveries", hint: "Open past the expected date", href: "/procurement/purchase-orders?status=OPEN" },
  { key: "receipts30", label: "Goods receipts", hint: "Last 30 days", href: "/procurement/goods-receipts" },
  { key: "activeSuppliers", label: "Active suppliers", hint: "", href: "/procurement/suppliers" },
];

export default function ProcurementPage() {
  const summary = useApiData("/api/procurement/summary");
  const data = summary.data;

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Procurement</p>
          <h1>Procurement</h1>
          <p>Requisition → quotation → purchase order → goods receipt → supplier bill. Every figure below is counted from live records.</p>
        </div>
        <div className="inv-header__actions">
          <Link className="inv-link-button" href="/finance/payables">Payables</Link>
          <Link className="inv-link-button" href="/procurement/supplier-performance">Supplier performance</Link>
        </div>
      </header>
      {summary.error ? (
        <p className="inv-state inv-state--error" role="alert">{summary.error}</p>
      ) : !data ? (
        <p className="inv-state" role="status">Loading…</p>
      ) : (
        <>
          <section className="inv-card">
            <div className="inv-table-wrap">
              <table className="inv-table">
                <thead><tr><th>Stage</th><th className="inv-num">Count</th><th>Meaning</th></tr></thead>
                <tbody>
                  {TILES.map((tile) => (
                    <tr key={tile.key}>
                      <td data-label="Stage"><Link href={tile.href}><strong>{tile.label}</strong></Link></td>
                      <td data-label="Count" className={`inv-num ${tile.key === "lateOrders" && data[tile.key] > 0 ? "inv-neg" : ""}`}>{data[tile.key]}</td>
                      <td data-label="Meaning">{tile.hint}</td>
                    </tr>
                  ))}
                  <tr>
                    <td data-label="Stage"><strong>Open order value</strong></td>
                    <td data-label="Count" className="inv-num">{formatAmount(data.openOrderValue)}</td>
                    <td data-label="Meaning">Approved and partly received POs, including tax</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
