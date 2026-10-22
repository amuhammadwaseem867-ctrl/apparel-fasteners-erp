"use client";

import Link from "next/link";

import { OrderStatusBadge, PriorityBadge, ProgressBar } from "@/components/production/productionUi";
import { PRODUCTION_STAGES } from "@/config/production";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";
import "@/components/production/Production.css";

/* Active production orders (released, in progress, on hold) by their current stage. */
export default function StageBoardPage() {
  const orders = useApiData("/api/production/orders?status=ACTIVE&pageSize=100");
  const rows = orders.data?.orders ?? [];

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Production</p>
          <h1>Stage Board</h1>
          <p>Released, in-progress and on-hold orders in the stage they are currently at. Open an order to record output or complete its stage.</p>
        </div>
        <div className="inv-header__actions">
          <button type="button" className="inv-link-button" onClick={orders.reload} disabled={orders.loading}>Refresh</button>
          <Link className="inv-link-button" href="/production/orders">All orders</Link>
        </div>
      </header>

      {orders.error ? (
        <p className="inv-state inv-state--error" role="alert">{orders.error}</p>
      ) : !orders.data ? (
        <p className="inv-state" role="status">Loading stage boardâ€¦</p>
      ) : (
        <>
          {orders.data.hasMore && <p className="inv-state" role="status">Showing the 100 most recent active orders. Use the order list filters to see the rest.</p>}
          {rows.length === 0 && <p className="inv-state">No active production orders. Release a planned order to put it on the board.</p>}
          <div className="prd-board">
            {PRODUCTION_STAGES.map((stage) => {
              const atStage = rows.filter((row) => row.currentStage === stage.key);
              return (
                <section key={stage.key} className="prd-board__column" aria-labelledby={`board-${stage.key}`}>
                  <h2 id={`board-${stage.key}`}>{stage.sequence}. {stage.label} <span className="inv-badge">{atStage.length}</span></h2>
                  {atStage.map((row) => (
                    <Link key={row.id} className="prd-board__card" href={`/production/orders/${row.id}#stage-${stage.key}`}>
                      <strong>{row.orderNumber}</strong>
                      <span>{row.sku} · {row.quantity} {row.unit}</span>
                      <span><PriorityBadge priority={row.priority} /> {row.status !== "IN_PROGRESS" && <OrderStatusBadge status={row.status} />}</span>
                      {row.dueDate && <small>Due {row.dueDate}</small>}
                      <ProgressBar value={row.progress} label={`${row.orderNumber} stages completed`} />
                    </Link>
                  ))}
                </section>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}

