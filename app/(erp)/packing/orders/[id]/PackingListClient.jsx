"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import { PackingStatusBadge } from "@/components/packing/PackingListTable";
import { apiRequest } from "@/lib/api/client";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

export default function PackingListClient({ id }) {
  const loaded = useApiData(`/api/packing/lists/${id}`);
  const [override, setOverride] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const list = override ?? loaded.data;

  async function act(action) {
    if (busy) return;
    const text = action === "confirm"
      ? `Confirm ${list.packingNumber}? This records ${list.totalQuantity} ${list.unit} as packed for ${list.orderNumber} and receives it into ${list.locationLabel}. It cannot be undone.`
      : `Cancel ${list.packingNumber}?`;
    if (!window.confirm(text)) return;
    setBusy(action);
    setError("");
    try {
      setOverride(await apiRequest(`/api/packing/lists/${id}`, { method: "PATCH", body: JSON.stringify({ action }) }));
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy("");
    }
  }

  if (loaded.error && !list) return <main className="inv-page"><p className="inv-dialog__error" role="alert">{loaded.error}</p></main>;
  if (!list) return <main className="inv-page"><p className="inv-state" role="status">Loading packing list…</p></main>;

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/packing/orders">Packing lists</Link></p>
          <h1>{list.packingNumber} <PackingStatusBadge status={list.status} /></h1>
          <p>
            <strong>{list.sku}</strong> {list.productName} · {list.totalQuantity} {list.unit} in {list.packageCount} {list.packageCount === 1 ? "package" : "packages"} ·{" "}
            <Link href={`/production/orders/${list.productionOrderId}`}>{list.orderNumber}</Link>
            {list.salesOrderNumber ? ` · for ${list.salesOrderNumber}` : " · to stock"} · {list.locationLabel}
            {list.shipmentId && <> · shipped on <Link href={`/dispatch/shipments/${list.shipmentId}`}>{list.shipmentNumber}</Link></>}
          </p>
        </div>
        <div className="inv-header__actions">
          {list.status === "DRAFT" && <Button variant="secondary" loading={busy === "cancel"} onClick={() => act("cancel")}>Cancel</Button>}
          {list.status === "DRAFT" && <Button variant="primary" loading={busy === "confirm"} onClick={() => act("confirm")}>Confirm packing</Button>}
          <Link className="inv-link-button" href={`/print/packing-lists/${list.id}`}>Print packing list</Link>
        </div>
      </header>

      {error && <p className="inv-dialog__error" role="alert">{error}</p>}

      <section className="inv-card">
        <div className="inv-card__header"><h2>Packages</h2></div>
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead><tr><th className="inv-num">#</th><th>Type</th><th className="inv-num">Quantity</th><th className="inv-num">Net kg</th><th className="inv-num">Gross kg</th><th>Dimensions</th><th>Marks</th></tr></thead>
            <tbody>
              {list.packages.map((item) => (
                <tr key={item.id}>
                  <td data-label="#" className="inv-num">{item.packageNo}</td>
                  <td data-label="Type">{item.packageType}</td>
                  <td data-label="Quantity" className="inv-num">{item.quantity} {list.unit}</td>
                  <td data-label="Net kg" className="inv-num">{item.netWeight ?? "—"}</td>
                  <td data-label="Gross kg" className="inv-num">{item.grossWeight ?? "—"}</td>
                  <td data-label="Dimensions">{item.dimensions || "—"}</td>
                  <td data-label="Marks">{item.marks || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.notes && <p className="inv-state">Notes: {list.notes}</p>}
        {list.stockDocuments.length > 0 && (
          <p className="inv-state">
            Stock: {list.stockDocuments.map((document) => <Link key={document.id} href={`/print/stock-documents/${document.id}`}>{document.documentNumber}</Link>)}
          </p>
        )}
      </section>
    </main>
  );
}
