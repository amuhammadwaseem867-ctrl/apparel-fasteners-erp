"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import Button from "@/components/ui/Button";
import InventoryPager from "@/components/inventory/InventoryPager";
import ShipmentDialog from "@/components/dispatch/ShipmentDialog";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const TONES = { DRAFT: "warning", DISPATCHED: "warning", DELIVERED: "good", CANCELLED: "danger" };
const LABELS = { DRAFT: "Draft", DISPATCHED: "Dispatched", DELIVERED: "Delivered", CANCELLED: "Cancelled" };

export function ShipmentStatusBadge({ status }) {
  return <span className={`inv-badge inv-badge--${TONES[status]}`}>{LABELS[status] ?? status}</span>;
}

function when(value) {
  return value ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

/* Shipments from GET /api/dispatch/shipments with a status preset. */
export default function ShipmentList({ title, description, initialStatus = "", emptyText, allowCreate = true }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const shipments = useApiData(`/api/dispatch/shipments${toQuery({ status, search, page, pageSize: 25 })}`);
  const rows = shipments.data?.shipments ?? [];

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Dispatch</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {allowCreate && (
          <div className="inv-header__actions">
            <Button variant="primary" onClick={() => setCreating(true)}>New shipment</Button>
          </div>
        )}
      </header>

      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field">
            <label htmlFor="sh-search">Search</label>
            <input id="sh-search" type="search" placeholder="Shipment, sales order or customer" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          </div>
          <div className="inv-field">
            <label htmlFor="sh-status">Status</label>
            <select id="sh-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="OPEN">Open (draft or dispatched)</option>
              <option value="DRAFT">Draft</option>
              <option value="DISPATCHED">Dispatched (in transit)</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
        {shipments.error ? (
          <p className="inv-state inv-state--error" role="alert">{shipments.error}</p>
        ) : !shipments.data ? (
          <p className="inv-state" role="status">Loading shipments…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">{search || status !== initialStatus ? "No shipments match these filters." : emptyText}</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Shipment</th><th>Sales order</th><th>Customer</th><th className="inv-num">Lines</th><th>Vehicle</th><th>Dispatched</th><th>Delivered</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Shipment"><Link href={`/dispatch/shipments/${row.id}`}><strong>{row.shipmentNumber}</strong></Link></td>
                    <td data-label="Sales order">{row.salesOrderNumber}</td>
                    <td data-label="Customer">{row.customerName}</td>
                    <td data-label="Lines" className="inv-num">{row.lineCount}</td>
                    <td data-label="Vehicle">{row.vehicleNumber || "—"}</td>
                    <td data-label="Dispatched">{when(row.dispatchedAt)}</td>
                    <td data-label="Delivered">{when(row.deliveredAt)}</td>
                    <td data-label="Status"><ShipmentStatusBadge status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={shipments.data?.hasMore} onChange={setPage} disabled={shipments.loading} />
      </section>

      {creating && (
        <ShipmentDialog onClose={() => setCreating(false)} onCreated={(created) => router.push(`/dispatch/shipments/${created.id}`)} />
      )}
    </main>
  );
}
