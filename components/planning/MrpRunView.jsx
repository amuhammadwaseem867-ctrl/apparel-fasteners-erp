"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import { apiRequest } from "@/lib/api/client";

import "@/components/inventory/InventoryWorkspace.css";

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function statusBadge(status) {
  const tone = status === "CONFIRMED" ? "good" : status === "CANCELLED" ? "danger" : "warning";
  return <span className={`inv-badge inv-badge--${tone}`}>{status}</span>;
}

/*
 * One stored MRP run: its assumptions, per-item requirements (gross,
 * allocated, available, net, planned) and suggested planned orders.
 * `show` limits the sections ("requirements", "shortages", "orders").
 */
export default function MrpRunView({ run, onChanged, show = ["requirements", "orders"] }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function setStatus(order, status) {
    if (busy) return;
    if (status === "CANCELLED" && !window.confirm(`Cancel the suggested ${order.orderType} order for ${order.sku}?`)) return;
    setBusy(order.id);
    setError("");
    try {
      await apiRequest(`/api/planning/planned-orders/${order.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      onChanged?.();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy("");
    }
  }

  const shortages = run.requirements.filter((row) => Number(row.netRequirement) > 0);
  const requirementRows = show.includes("shortages") ? shortages : run.requirements;

  return (
    <div className="inv-page">
      <section className="inv-card">
        <div className="inv-card__header">
          <div>
            <h2>{run.runNumber}</h2>
            <small>
              {formatDateTime(run.createdAt)} · {run.demandCount} demand lines · {run.plannedCount} planned orders
              {run.parameters?.horizonDate ? ` · horizon ${run.parameters.horizonDate}` : " · no horizon"}
            </small>
          </div>
        </div>
        <ul style={{ margin: 0, padding: "12px 32px", fontSize: 12.5, color: "var(--af-text-secondary)" }}>
          {(run.parameters?.assumptions ?? []).map((assumption) => <li key={assumption}>{assumption}</li>)}
        </ul>
      </section>

      {error && <p className="inv-dialog__error" role="alert">{error}</p>}

      {(show.includes("requirements") || show.includes("shortages")) && (
        <section className="inv-card">
          <div className="inv-card__header">
            <h2>{show.includes("shortages") ? "Shortages" : "Material requirements"}</h2>
            <small>Net = gross − allocated (reserved for this demand) − available. Planned = net rounded up to the unit.</small>
          </div>
          {requirementRows.length === 0 ? (
            <p className="inv-state">{show.includes("shortages") ? "No shortages: stock covers every requirement in this run." : "This run had no demand."}</p>
          ) : (
            <div className="inv-table-wrap">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>Item</th><th className="inv-num">Level</th><th>Supply</th>
                    <th className="inv-num">Gross</th><th className="inv-num">Allocated</th><th className="inv-num">Available</th>
                    <th className="inv-num">Net</th><th className="inv-num">Planned</th><th>BOM</th>
                  </tr>
                </thead>
                <tbody>
                  {requirementRows.map((row) => (
                    <tr key={row.id}>
                      <td data-label="Item"><Link href={`/inventory/item-master/${row.productId}`}>{row.sku}</Link><small>{row.productName}</small></td>
                      <td data-label="Level" className="inv-num">{row.lowLevelCode}</td>
                      <td data-label="Supply"><span className="inv-badge">{row.supplyType}</span></td>
                      <td data-label="Gross" className="inv-num">{row.grossRequirement}</td>
                      <td data-label="Allocated" className="inv-num">{row.allocatedStock}</td>
                      <td data-label="Available" className="inv-num">{row.availableStock}</td>
                      <td data-label="Net" className={`inv-num ${Number(row.netRequirement) > 0 ? "inv-neg" : ""}`}>{row.netRequirement}</td>
                      <td data-label="Planned" className="inv-num"><strong>{row.plannedQuantity}</strong> {row.unit}</td>
                      <td data-label="BOM">{row.bomRevision ? `Rev ${row.bomRevision}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {show.includes("orders") && (
        <section className="inv-card">
          <div className="inv-card__header">
            <h2>Planned orders</h2>
            <small>Suggestions only. Confirm a MAKE order, then convert it to a production order (once). Purchase orders arrive with procurement.</small>
          </div>
          {run.plannedOrders.length === 0 ? (
            <p className="inv-state">No planned orders were needed.</p>
          ) : (
            <div className="inv-table-wrap">
              <table className="inv-table">
                <thead><tr><th>Item</th><th>Type</th><th className="inv-num">Quantity</th><th>Due</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {run.plannedOrders.map((order) => (
                    <tr key={order.id}>
                      <td data-label="Item">{order.sku}<small>{order.productName}</small></td>
                      <td data-label="Type">{order.orderType === "MAKE" ? "Make (production)" : "Buy (purchase)"}</td>
                      <td data-label="Quantity" className="inv-num">{order.quantity} {order.unit}</td>
                      <td data-label="Due">{order.dueDate ?? "—"}</td>
                      <td data-label="Status">{statusBadge(order.status)}</td>
                      <td data-label="Actions">
                        {order.status === "CONFIRMED" && order.orderType === "MAKE" && (order.productionOrderId ? (
                          <Link href={`/production/orders/${order.productionOrderId}`}>{order.productionOrderNumber}</Link>
                        ) : (
                          <Link className="inv-link-button" href={`/production/orders/new?plannedOrderId=${order.id}&productId=${order.productId}&quantity=${order.quantity}${order.dueDate ? `&dueDate=${order.dueDate}` : ""}`}>Create production order</Link>
                        ))}
                        {order.status === "SUGGESTED" && (
                          <>
                            <Button size="small" variant="primary" disabled={busy === order.id} onClick={() => setStatus(order, "CONFIRMED")}>Confirm</Button>{" "}
                            <Button size="small" variant="secondary" disabled={busy === order.id} onClick={() => setStatus(order, "CANCELLED")}>Cancel</Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
