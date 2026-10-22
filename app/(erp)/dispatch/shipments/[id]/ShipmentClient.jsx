"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { ShipmentStatusBadge } from "@/components/dispatch/ShipmentList";
import { apiRequest } from "@/lib/api/client";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

function when(value) {
  return value ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "";
}

export default function ShipmentClient({ id }) {
  const loaded = useApiData(`/api/dispatch/shipments/${id}`);
  const [override, setOverride] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [delivering, setDelivering] = useState(false);
  const [receipt, setReceipt] = useState({ receivedBy: "", deliveryNote: "" });
  const shipment = override ?? loaded.data;

  async function act(action, body = {}) {
    if (busy) return;
    setBusy(action);
    setError("");
    try {
      setOverride(await apiRequest(`/api/dispatch/shipments/${id}`, { method: "PATCH", body: JSON.stringify({ action, ...body }) }));
      setDelivering(false);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy("");
    }
  }

  if (loaded.error && !shipment) return <main className="inv-page"><p className="inv-dialog__error" role="alert">{loaded.error}</p></main>;
  if (!shipment) return <main className="inv-page"><p className="inv-state" role="status">Loading shipment…</p></main>;

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/dispatch/shipments">Shipments</Link></p>
          <h1>{shipment.shipmentNumber} <ShipmentStatusBadge status={shipment.status} /></h1>
          <p>
            {shipment.salesOrderNumber} · {shipment.customerName} · from {shipment.locationLabel}
            {shipment.vehicleNumber ? ` · vehicle ${shipment.vehicleNumber}` : ""}
            {shipment.driverName ? ` · ${shipment.driverName}` : ""}
          </p>
        </div>
        <div className="inv-header__actions">
          {shipment.status === "DRAFT" && (
            <>
              <Button variant="secondary" loading={busy === "cancel"} onClick={() => window.confirm("Cancel this draft shipment?") && act("cancel")}>Cancel</Button>
              <Button variant="primary" loading={busy === "dispatch"}
                onClick={() => window.confirm("Dispatch now? The goods are posted out of finished-goods stock. This cannot be undone.") && act("dispatch")}>
                Dispatch
              </Button>
            </>
          )}
          {shipment.status === "DISPATCHED" && <Button variant="primary" onClick={() => setDelivering(true)}>Confirm delivery</Button>}
          <Link className="inv-link-button" href={`/print/shipments/${shipment.id}`}>Print delivery challan</Link>
        </div>
      </header>

      {error && <p className="inv-dialog__error" role="alert">{error}</p>}

      <section className="inv-card">
        <div className="inv-card__header"><h2>Lines</h2></div>
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead><tr><th className="inv-num">#</th><th>Item</th><th>Packing list</th><th>Production order</th><th className="inv-num">Quantity</th></tr></thead>
            <tbody>
              {shipment.lines.map((line) => (
                <tr key={line.id}>
                  <td data-label="#" className="inv-num">{line.lineNo}</td>
                  <td data-label="Item"><strong>{line.sku}</strong><small>{line.productName}</small></td>
                  <td data-label="Packing list">{line.packingListId ? <Link href={`/packing/orders/${line.packingListId}`}>{line.packingNumber}</Link> : "Loose stock"}{line.packageCount ? <small>{line.packageCount} packages</small> : null}</td>
                  <td data-label="Production order">{line.productionOrderId ? <Link href={`/production/orders/${line.productionOrderId}`}>{line.productionOrderNumber}</Link> : "—"}</td>
                  <td data-label="Quantity" className="inv-num">{line.quantity} {line.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="inv-card">
        <div className="inv-card__header"><h2>Record</h2></div>
        <ul style={{ margin: 0, padding: "12px 32px", fontSize: 13 }}>
          <li>Created {when(shipment.createdAt)}{shipment.createdByName ? ` by ${shipment.createdByName}` : ""}</li>
          {shipment.transporter && <li>Transporter: {shipment.transporter}{shipment.trackingReference ? ` · ${shipment.trackingReference}` : ""}</li>}
          {shipment.deliveryAddress && <li>Deliver to: {shipment.deliveryAddress}</li>}
          {shipment.notes && <li>Notes: {shipment.notes}</li>}
          {shipment.dispatchedAt && <li>Dispatched {when(shipment.dispatchedAt)}{shipment.dispatchedByName ? ` by ${shipment.dispatchedByName}` : ""}</li>}
          {shipment.deliveredAt && <li>Delivered {when(shipment.deliveredAt)} · received by {shipment.receivedBy}{shipment.deliveryNote ? ` · ${shipment.deliveryNote}` : ""}</li>}
          {shipment.stockDocuments.map((document) => (
            <li key={document.id}>Stock document <Link href={`/print/stock-documents/${document.id}`}>{document.documentNumber}</Link></li>
          ))}
        </ul>
      </section>

      {delivering && (
        <Modal open onClose={busy ? undefined : () => setDelivering(false)} title="Confirm delivery" description="Records the delivery and the Delivered stage of each packed production order." size="medium">
          <form className="inv-dialog" onSubmit={(event) => { event.preventDefault(); act("deliver", receipt); }}>
            <div className="inv-field">
              <label htmlFor="dl-received">Received by *</label>
              <input id="dl-received" required maxLength={120} value={receipt.receivedBy} onChange={(event) => setReceipt((current) => ({ ...current, receivedBy: event.target.value }))} />
            </div>
            <div className="inv-field">
              <label htmlFor="dl-note">Delivery note</label>
              <textarea id="dl-note" rows={2} maxLength={500} value={receipt.deliveryNote} onChange={(event) => setReceipt((current) => ({ ...current, deliveryNote: event.target.value }))} />
            </div>
            {error && <p className="inv-dialog__error" role="alert">{error}</p>}
            <div className="inv-dialog__actions">
              <Button variant="secondary" onClick={() => setDelivering(false)} disabled={Boolean(busy)}>Cancel</Button>
              <Button type="submit" variant="primary" loading={busy === "deliver"} disabled={!receipt.receivedBy.trim()}>Confirm delivery</Button>
            </div>
          </form>
        </Modal>
      )}
    </main>
  );
}

