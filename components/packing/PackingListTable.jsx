"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import Button from "@/components/ui/Button";
import InventoryPager from "@/components/inventory/InventoryPager";
import PackingListDialog from "@/components/packing/PackingListDialog";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const TONES = { CONFIRMED: "good", SHIPPED: "good", CANCELLED: "danger", DRAFT: "warning" };

export function PackingStatusBadge({ status }) {
  return <span className={`inv-badge inv-badge--${TONES[status] ?? ""}`}>{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}

/* Packing lists from GET /api/packing/lists with a status preset. */
export default function PackingListTable({ title, description, initialStatus = "", emptyText, openForOrderId = "", allowCreate = true }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(Boolean(openForOrderId));
  const lists = useApiData(`/api/packing/lists${toQuery({ status, search, page, pageSize: 25 })}`);
  const rows = lists.data?.packingLists ?? [];

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Packing</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {allowCreate && (
          <div className="inv-header__actions">
            <Button variant="primary" onClick={() => setCreating(true)}>New packing list</Button>
          </div>
        )}
      </header>

      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field">
            <label htmlFor="pk-search">Search</label>
            <input id="pk-search" type="search" placeholder="Packing number, SKU or item" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          </div>
          <div className="inv-field">
            <label htmlFor="pk-status">Status</label>
            <select id="pk-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="OPEN">Open (draft or confirmed)</option>
              <option value="DRAFT">Draft</option>
              <option value="CONFIRMED">Confirmed (ready to ship)</option>
              <option value="SHIPPED">Shipped</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
        {lists.error ? (
          <p className="inv-state inv-state--error" role="alert">{lists.error}</p>
        ) : !lists.data ? (
          <p className="inv-state" role="status">Loading packing lists…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">{search || status !== initialStatus ? "No packing lists match these filters." : emptyText}</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Packing list</th><th>Item</th><th>Production order</th><th>Sales order</th><th className="inv-num">Packages</th><th className="inv-num">Quantity</th><th>Location</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Packing list"><Link href={`/packing/orders/${row.id}`}><strong>{row.packingNumber}</strong></Link><small>{new Date(row.createdAt).toLocaleDateString("en-GB")}</small></td>
                    <td data-label="Item"><strong>{row.sku}</strong><small>{row.productName}</small></td>
                    <td data-label="Production order"><Link href={`/production/orders/${row.productionOrderId}`}>{row.orderNumber}</Link></td>
                    <td data-label="Sales order">{row.salesOrderNumber ?? "Stock"}</td>
                    <td data-label="Packages" className="inv-num">{row.packageCount}</td>
                    <td data-label="Quantity" className="inv-num">{row.totalQuantity} {row.unit}</td>
                    <td data-label="Location">{row.locationLabel}</td>
                    <td data-label="Status"><PackingStatusBadge status={row.status} />{row.shipmentNumber && <small>{row.shipmentNumber}</small>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={lists.data?.hasMore} onChange={setPage} disabled={lists.loading} />
      </section>

      {creating && (
        <PackingListDialog
          initialOrderId={openForOrderId}
          onClose={() => setCreating(false)}
          onCreated={(created) => router.push(`/packing/orders/${created.id}`)}
        />
      )}
    </main>
  );
}
