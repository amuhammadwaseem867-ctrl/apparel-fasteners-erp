"use client";

import Link from "next/link";

import { documentTypeLabel } from "@/components/inventory/DocumentsView";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const LINKS = [
  ["/inventory/stock", "Stock on hand", "Receive, issue, adjust"],
  ["/inventory/item-master", "Item master", "Items, specifications, catalogue coverage"],
  ["/inventory/warehouses", "Warehouses", "Warehouses, shelves, rows and columns"],
  ["/inventory/movements", "Movements", "The full stock ledger"],
  ["/inventory/stock-counts", "Stock counts", "Physical count reconciliation"],
];

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

/*
 * Inventory overview from GET /api/inventory/summary and the movement
 * ledger. Totals are shown per unit of measure; pieces and metres are
 * never added together.
 */
export default function InventoryOverviewPage() {
  const summary = useApiData("/api/inventory/summary");
  const movements = useApiData("/api/inventory/movements?pageSize=8");
  const data = summary.data;
  const showReserved = (data?.totalsByUnit ?? []).some((total) => Number(total.reserved) !== 0);

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Inventory</p>
          <h1>Inventory Overview</h1>
          <p>Live stock position from the stock ledger: raw material, work in process and finished goods. Available is what can be issued now (QC hold excluded).</p>
        </div>
        <div className="inv-header__actions">
          <Link className="inv-link-button" href="/inventory/stock">Post a transaction</Link>
        </div>
      </header>

      {summary.error ? (
        <p className="inv-dialog__error" role="alert">{summary.error}</p>
      ) : !data ? (
        <p className="inv-state" role="status">Loading stock position…</p>
      ) : (
        <>
          <section className="inv-kpis" aria-label="Stock indicators">
            <div className="inv-kpi"><span>Items in master</span><strong>{data.itemCount}</strong><small>excluding archived</small></div>
            <div className="inv-kpi"><span>Items with stock records</span><strong>{data.trackedItemCount}</strong><small>or a minimum level set</small></div>
            <div className="inv-kpi inv-kpi--warning"><span>Low stock</span><strong>{data.lowStockCount}</strong><small>available below minimum</small></div>
            <div className="inv-kpi inv-kpi--danger"><span>Out of stock</span><strong>{data.outOfStockCount}</strong><small>nothing available</small></div>
          </section>

          <section className="inv-card">
            <div className="inv-card__header"><h2>Totals by unit of measure</h2><small>Quantities in different units are never added together.</small></div>
            {data.totalsByUnit.length === 0 ? (
              <p className="inv-state">No stock has been posted yet.</p>
            ) : (
              <div className="inv-table-wrap">
                <table className="inv-table">
                  <thead><tr><th>Unit</th><th className="inv-num">Items</th><th className="inv-num">On hand</th>{showReserved && <th className="inv-num">Reserved</th>}<th className="inv-num">QC hold</th><th className="inv-num">Available</th></tr></thead>
                  <tbody>
                    {data.totalsByUnit.map((total) => (
                      <tr key={total.unit}>
                        <td data-label="Unit"><strong>{total.unit}</strong></td>
                        <td data-label="Items" className="inv-num">{total.items}</td>
                        <td data-label="On hand" className="inv-num">{total.onHand}</td>
                        {showReserved && <td data-label="Reserved" className="inv-num">{total.reserved}</td>}
                        <td data-label="QC hold" className="inv-num">{total.qualityHold}</td>
                        <td data-label="Available" className="inv-num"><strong>{total.available}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="inv-card">
            <div className="inv-card__header"><h2>Low and out-of-stock items</h2><small>Items below their minimum stock level.</small></div>
            {data.alerts.length === 0 ? (
              <p className="inv-state">No stock alerts. Set minimum stock levels on items to get alerts.</p>
            ) : (
              <div className="inv-table-wrap">
                <table className="inv-table">
                  <thead><tr><th>Item</th><th className="inv-num">Available</th><th className="inv-num">Minimum</th><th>Status</th></tr></thead>
                  <tbody>
                    {data.alerts.map((item) => (
                      <tr key={item.productId}>
                        <td data-label="Item"><Link href={`/inventory/item-master/${item.productId}`}>{item.sku}</Link><small>{item.name}</small></td>
                        <td data-label="Available" className="inv-num">{item.available} {item.unit}</td>
                        <td data-label="Minimum" className="inv-num">{item.minimumStock}</td>
                        <td data-label="Status">
                          <span className={`inv-badge inv-badge--${item.outOfStock ? "danger" : "warning"}`}>{item.outOfStock ? "Out of stock" : "Low"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <section className="inv-card">
        <div className="inv-card__header"><h2>Recent movements</h2><Link href="/inventory/movements">View ledger</Link></div>
        {movements.error ? (
          <p className="inv-state inv-state--error" role="alert">{movements.error}</p>
        ) : !movements.data ? (
          <p className="inv-state" role="status">Loading…</p>
        ) : movements.data.movements.length === 0 ? (
          <p className="inv-state">No stock movements yet.</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Date</th><th>Document</th><th>Item</th><th className="inv-num">Change</th></tr></thead>
              <tbody>
                {movements.data.movements.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Date">{formatDateTime(row.createdAt)}</td>
                    <td data-label="Document">{row.documentNumber}<small>{documentTypeLabel(row.movementType)}</small></td>
                    <td data-label="Item">{row.sku}<small>{row.warehouseCode}/{row.locationCode}</small></td>
                    <td data-label="Change" className={`inv-num ${row.quantityDelta.startsWith("-") ? "inv-neg" : "inv-pos"}`}>
                      {row.quantityDelta.startsWith("-") ? row.quantityDelta : `+${row.quantityDelta}`} {row.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <nav className="inv-kpis" aria-label="Inventory areas">
        {LINKS.map(([href, label, note]) => (
          <Link key={href} href={href} className="inv-kpi" style={{ textDecoration: "none" }}>
            <span>{label}</span>
            <small>{note}</small>
          </Link>
        ))}
      </nav>
    </main>
  );
}
