"use client";

import Link from "next/link";
import { useState } from "react";

import InventoryPager from "@/components/inventory/InventoryPager";
import { OrderStatusBadge, PriorityBadge, ProgressBar } from "@/components/production/productionUi";
import { PRODUCTION_STAGES } from "@/config/production";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";
import "@/components/production/Production.css";

const STAGE_LABEL = Object.fromEntries(PRODUCTION_STAGES.map((stage) => [stage.key, stage.label]));

/*
 * Production orders from GET /api/production/orders. The orders, schedule
 * and completion pages are this list with different defaults.
 */
export default function ProductionOrderList({
  title = "Production Orders",
  description = "Each order runs through the nine stages in sequence. Open an order to record stage output, complete stages and issue material.",
  initialStatus = "",
  sort = "created",
  emptyText = "No production orders yet. Create one, or convert a confirmed MAKE order from an MRP run.",
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [stage, setStage] = useState("");
  const [page, setPage] = useState(1);
  const orders = useApiData(`/api/production/orders${toQuery({ search, status, stage, sort, page, pageSize: 25 })}`);
  const rows = orders.data?.orders ?? [];
  const filtered = Boolean(search || stage || status !== initialStatus);

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Production</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="inv-header__actions">
          <Link className="inv-link-button" href="/production/stage-board">Stage board</Link>
          <Link className="inv-link-button" href="/production/orders/new">New production order</Link>
        </div>
      </header>

      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field">
            <label htmlFor="prd-search">Search</label>
            <input id="prd-search" type="search" placeholder="Order number, SKU or item" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          </div>
          <div className="inv-field">
            <label htmlFor="prd-status">Status</label>
            <select id="prd-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="OPEN">Open (not completed or cancelled)</option>
              <option value="ACTIVE">Active (released, in progress, on hold)</option>
              <option value="PLANNED">Planned</option>
              <option value="RELEASED">Released</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="ON_HOLD">On hold</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div className="inv-field">
            <label htmlFor="prd-stage">Current stage</label>
            <select id="prd-stage" value={stage} onChange={(event) => { setStage(event.target.value); setPage(1); }}>
              <option value="">All stages</option>
              {PRODUCTION_STAGES.map((item) => <option key={item.key} value={item.key}>{item.sequence}. {item.label}</option>)}
            </select>
          </div>
        </div>

        {orders.error ? (
          <p className="inv-state inv-state--error" role="alert">{orders.error}</p>
        ) : !orders.data ? (
          <p className="inv-state" role="status">Loading production orders…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">{filtered ? "No production orders match these filters." : emptyText}</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Order</th><th>Item</th><th className="inv-num">Quantity</th><th>Priority</th><th>Due</th>
                  <th>Current stage</th><th>Progress</th><th className="inv-num">Delivered</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Order"><Link href={`/production/orders/${row.id}`}><strong>{row.orderNumber}</strong></Link></td>
                    <td data-label="Item"><strong>{row.sku}</strong><small>{row.productName}</small></td>
                    <td data-label="Quantity" className="inv-num">{row.quantity} {row.unit}</td>
                    <td data-label="Priority"><PriorityBadge priority={row.priority} /></td>
                    <td data-label="Due">{row.dueDate ?? "—"}</td>
                    <td data-label="Current stage">{row.status === "COMPLETED" ? "—" : STAGE_LABEL[row.currentStage] ?? "—"}</td>
                    <td data-label="Progress"><ProgressBar value={row.progress} label={`${row.orderNumber} stages completed`} /></td>
                    <td data-label="Delivered" className="inv-num">{row.deliveredQuantity}</td>
                    <td data-label="Status"><OrderStatusBadge status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={orders.data?.hasMore} onChange={setPage} disabled={orders.loading} />
      </section>
    </main>
  );
}
