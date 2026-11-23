"use client";

/*
 * Costing history (D-060): every saved costing, quick or from an invoice,
 * with its value, material cost and profit, each printable again exactly
 * as it was calculated. No order or invoice is ever made from here.
 */

import Link from "next/link";
import { useState } from "react";

import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const n = (value, digits = 2) => Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const day = (value) => (value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "");
const margin = (row) => (Number(row.revenue) > 0 ? `${n((Number(row.profit) / Number(row.revenue)) * 100, 1)}%` : "—");

export default function CostingHistoryPage() {
  const { can } = useCurrentUser();
  const [filters, setFilters] = useState({ search: "", source: "", from: "", to: "", page: 1 });
  const [message, setMessage] = useState("");
  const [recalculating, setRecalculating] = useState(false);
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== "" && value !== null).map(([key, value]) => [key, String(value)]));
  const list = useApiData(`/api/costing/records?${query}`);
  const set = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value, page: 1 }));

  async function remove(row) {
    if (!window.confirm(`Delete ${row.recordNumber}? Only this saved quick costing goes.`)) return;
    try {
      await apiRequest(`/api/costing/records/${row.id}`, { method: "DELETE" });
      setMessage(`${row.recordNumber} deleted.`);
      list.reload();
    } catch (cause) {
      setMessage(cause.message);
    }
  }

  /* Re-costs every saved invoice costing with the current Costing rates, a batch at a time. */
  async function recalculate() {
    if (!window.confirm("Recalculate every invoice costing with the current Costing rates? Numbers, dates and customers stay; costs and profit are updated.")) return;
    setRecalculating(true);
    try {
      let offset = 0;
      for (;;) {
        const response = await apiRequest("/api/costing/records/recalculate", { method: "POST", body: JSON.stringify({ offset, limit: 15 }) });
        const step = response.data ?? response;
        offset = step.next;
        setMessage(`Recalculating… ${Math.min(offset, step.total)} of ${step.total}`);
        if (step.done) break;
      }
      setMessage("All invoice costings recalculated with the current rates.");
      list.reload();
    } catch (cause) {
      setMessage(`Stopped: ${cause.message}. Press Recalculate again to finish; it is safe to repeat.`);
    } finally {
      setRecalculating(false);
    }
  }

  async function editCustomer(row) {
    const name = window.prompt(`Customer for ${row.recordNumber} (${row.reference || "no reference"}):`, row.customerName);
    if (name === null) return;
    try {
      await apiRequest(`/api/costing/records/${row.id}`, { method: "PATCH", body: JSON.stringify({ customerName: name }) });
      setMessage(`${row.recordNumber}: customer set to ${name.trim() || "(none)"}.`);
      list.reload();
    } catch (cause) {
      setMessage(cause.message);
    }
  }

  const data = list.data;
  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/sales/orders">2. Orders</Link></p>
          <h1>Costing history</h1>
          <p>Every saved costing, from quick costing or an invoice. Print any of them again; no order or invoice is made.</p>
        </div>
        <div className="inv-header__actions">
          {can("sales:update") && <button type="button" className="inv-link-button" disabled={recalculating} onClick={recalculate}>{recalculating ? "Recalculating…" : "Recalculate with current rates"}</button>}
          <Link className="inv-link-button" href="/sales/costing-rates">Costing rates</Link>
          <Link className="inv-link-button inv-link-button--primary" href="/sales/quick-costing">New quick costing</Link>
        </div>
      </header>

      {data && (
        <section className="inv-kpis" aria-label="Totals">
          <div className="inv-kpi"><span>Costings</span><strong>{n(data.totals.count, 0)}</strong><small>in this list</small></div>
          <div className="inv-kpi"><span>Value (before GST)</span><strong>{n(data.totals.revenue)}</strong><small>costed lines</small></div>
          <div className="inv-kpi"><span>Material cost</span><strong>{n(data.totals.materialCost)}</strong><small>{Number(data.totals.noValue) > 0 ? `of priced costings; ${data.totals.noValue} without prices left out` : "after scrap recovered"}</small></div>
          <div className={`inv-kpi ${Number(data.totals.profit) < 0 ? "inv-kpi--warning" : ""}`}><span>Profit</span><strong>{n(data.totals.profit)}</strong><small>{Number(data.totals.revenue) > 0 ? `${n((Number(data.totals.profit) / Number(data.totals.revenue)) * 100, 1)}% margin` : ""}</small></div>
        </section>
      )}

      <section className="inv-card">
        <div className="inv-dialog__grid" style={{ padding: 16 }}>
          <div className="inv-field"><label htmlFor="ch-search">Search</label><input id="ch-search" placeholder="Customer, invoice or costing no." value={filters.search} onChange={set("search")} /></div>
          <div className="inv-field"><label htmlFor="ch-source">Type</label>
            <select id="ch-source" value={filters.source} onChange={set("source")}><option value="">All</option><option value="INVOICE">From invoices</option><option value="QUICK">Quick costing</option></select>
          </div>
          <div className="inv-field"><label htmlFor="ch-from">From</label><input id="ch-from" type="date" value={filters.from} onChange={set("from")} /></div>
          <div className="inv-field"><label htmlFor="ch-to">To</label><input id="ch-to" type="date" value={filters.to} onChange={set("to")} /></div>
        </div>
        {message && <p className="inv-state" role="status">{message}</p>}
        {list.error ? <p className="inv-state inv-state--error" role="alert">{list.error}</p>
          : !data ? <p className="inv-state" role="status">Loading costings…</p>
            : data.records.length === 0 ? <p className="inv-state">No costings yet. Save one from Quick costing.</p>
              : (
                <div className="inv-table-wrap">
                  <table className="inv-table">
                    <thead><tr><th>Costing no.</th><th>Date</th><th>Type</th><th>Invoice / reference</th><th>Customer</th><th className="inv-num">Pieces</th><th className="inv-num">Value</th><th className="inv-num">Material cost</th><th className="inv-num">Profit</th><th className="inv-num">Margin</th><th /></tr></thead>
                    <tbody>
                      {data.records.map((row) => (
                        <tr key={row.id}>
                          <td data-label="Costing no."><Link href={`/print/costing/records/${row.id}`}>{row.recordNumber}</Link></td>
                          <td data-label="Date">{day(row.documentDate)}</td>
                          <td data-label="Type">{row.source === "INVOICE" ? "Invoice" : "Quick"}</td>
                          <td data-label="Reference">{row.reference || "—"}</td>
                          <td data-label="Customer">{row.customerName || <span title="No customer name on the invoice">—</span>}{can("sales:update") && <> <button type="button" className="inv-link-button" onClick={() => editCustomer(row)}>{row.customerName ? "Edit" : "Add"}</button></>}</td>
                          <td data-label="Pieces" className="inv-num">{n(row.pieces, 0)}</td>
                          <td data-label="Value" className="inv-num">{n(row.revenue)}{Number(row.notCostedRevenue) > 0 ? <small title="Lines not costed (tape, sliders…)"> +{n(row.notCostedRevenue)}</small> : null}</td>
                          <td data-label="Material cost" className="inv-num">{n(row.materialCost)}</td>
                          <td data-label="Profit" className="inv-num">{Number(row.revenue) > 0 ? <span style={Number(row.profit) < 0 ? { color: "#b42318" } : undefined}>{n(row.profit)}</span> : <small title="Order sheet or prices in dollars: no PKR value">no prices</small>}</td>
                          <td data-label="Margin" className="inv-num">{margin(row)}</td>
                          <td>
                            <Link className="inv-link-button" href={`/print/costing/records/${row.id}`}>Print</Link>
                            {row.source === "QUICK" && can("sales:update") && <button type="button" className="inv-link-button" onClick={() => remove(row)}>Delete</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
        {data && (data.page > 1 || data.hasMore) && (
          <div className="inv-dialog__actions" style={{ padding: 12 }}>
            {data.page > 1 && <button type="button" className="inv-link-button" onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</button>}
            {data.hasMore && <button type="button" className="inv-link-button" onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</button>}
          </div>
        )}
      </section>
    </main>
  );
}
