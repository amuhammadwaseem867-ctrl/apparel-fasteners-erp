"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import Button from "@/components/ui/Button";
import ShipmentDialog from "@/components/dispatch/ShipmentDialog";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

/* Confirmed (packed, unshipped) packing lists grouped by sales order. */
export default function ReadyForDeliveryPage() {
  const router = useRouter();
  const lists = useApiData("/api/packing/lists?status=CONFIRMED&pageSize=100");
  const [shipFor, setShipFor] = useState(null);
  const rows = lists.data?.packingLists ?? [];
  const groups = new Map();
  for (const row of rows) {
    const key = row.salesOrderId ?? "";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Dispatch</p>
          <h1>Ready for Delivery</h1>
          <p>Packed goods in finished-goods stock that have not been shipped, by sales order.</p>
        </div>
      </header>
      {lists.error ? (
        <p className="inv-dialog__error" role="alert">{lists.error}</p>
      ) : !lists.data ? (
        <p className="inv-state" role="status">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="inv-state">Nothing is packed and waiting. Confirm packing lists under Packing first.</p>
      ) : (
        [...groups.entries()].map(([salesOrderId, items]) => (
          <section key={salesOrderId || "stock"} className="inv-card">
            <div className="inv-card__header">
              <div>
                <h2>{items[0].salesOrderNumber ?? "Made to stock"}</h2>
                <small>{items.length} packing {items.length === 1 ? "list" : "lists"}</small>
              </div>
              {salesOrderId ? (
                <Button variant="primary" onClick={() => setShipFor(salesOrderId)}>Create shipment</Button>
              ) : (
                <small>Ship stock items from a sales order&apos;s shipment as loose stock.</small>
              )}
            </div>
            <div className="inv-table-wrap">
              <table className="inv-table">
                <thead><tr><th>Packing list</th><th>Item</th><th>Production order</th><th className="inv-num">Packages</th><th className="inv-num">Quantity</th><th>Location</th></tr></thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id}>
                      <td data-label="Packing list"><Link href={`/packing/orders/${row.id}`}>{row.packingNumber}</Link></td>
                      <td data-label="Item"><strong>{row.sku}</strong><small>{row.productName}</small></td>
                      <td data-label="Production order">{row.orderNumber}</td>
                      <td data-label="Packages" className="inv-num">{row.packageCount}</td>
                      <td data-label="Quantity" className="inv-num">{row.totalQuantity} {row.unit}</td>
                      <td data-label="Location">{row.locationLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
      {lists.data?.hasMore && <p className="inv-state">Showing the 100 most recent packed lists.</p>}
      {shipFor && (
        <ShipmentDialog initialSalesOrderId={shipFor} onClose={() => setShipFor(null)} onCreated={(created) => router.push(`/dispatch/shipments/${created.id}`)} />
      )}
    </main>
  );
}
