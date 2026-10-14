"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import InventoryPager from "@/components/inventory/InventoryPager";
import ItemPicker from "@/components/inventory/ItemPicker";
import LocationSelect from "@/components/inventory/LocationSelect";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";
import { apiRequest } from "@/lib/api/client";

import "@/components/inventory/InventoryWorkspace.css";

function newKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function statusBadge(status) {
  const tone = status === "ACTIVE" ? "good" : status === "CONSUMED" ? "warning" : "";
  return <span className={`inv-badge ${tone ? `inv-badge--${tone}` : ""}`}>{status}</span>;
}

function ReservationForm({ locations, onClose, onSaved }) {
  const [item, setItem] = useState(null);
  const [locationId, setLocationId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [salesOrderId, setSalesOrderId] = useState("");
  const [notes, setNotes] = useState("");
  const [idempotencyKey] = useState(newKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const drafts = useApiData("/api/sales/orders?status=DRAFT&pageSize=100");
  const approved = useApiData("/api/sales/orders?status=APPROVED&pageSize=100");
  const orders = [...(approved.data?.orders ?? []), ...(drafts.data?.orders ?? [])];

  async function submit(event) {
    event.preventDefault();
    if (saving || !item) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest("/api/inventory/reservations", {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey,
          productId: item.id,
          locationId,
          quantity: Number(quantity),
          ...(salesOrderId ? { salesOrderId } : {}),
          notes,
        }),
      });
      onSaved();
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title="Reserve stock" description="Reserved stock stays on hand but is no longer available to other issues." size="large">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          <ItemPicker required value={item} onChange={setItem} />
          <LocationSelect required locations={locations} value={locationId} onChange={setLocationId} />
          <div className="inv-field">
            <label htmlFor="rsv-qty">Quantity *{item ? ` (${item.unit})` : ""}</label>
            <input id="rsv-qty" required type="number" step="any" min="0.000001" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </div>
          <div className="inv-field">
            <label htmlFor="rsv-order">Sales order</label>
            <select id="rsv-order" value={salesOrderId} onChange={(event) => setSalesOrderId(event.target.value)}>
              <option value="">Not linked to an order</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>{order.orderNumber} — {order.customerName} ({order.status})</option>
              ))}
            </select>
          </div>
        </div>
        <div className="inv-field">
          <label htmlFor="rsv-notes">Notes</label>
          <textarea id="rsv-notes" rows={2} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!item || !locationId || !quantity}>Reserve</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ReservationsPage() {
  const [status, setStatus] = useState("ACTIVE");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const locations = useApiData("/api/inventory/locations?status=ACTIVE");
  const reservations = useApiData(`/api/inventory/reservations${toQuery({ status, page, pageSize: 25 })}`);
  const rows = reservations.data?.reservations ?? [];

  async function release(reservation) {
    if (busy) return;
    if (!window.confirm(`Release the remaining ${reservation.openQuantity} ${reservation.unit} of ${reservation.sku}?`)) return;
    setBusy(reservation.id);
    setError("");
    try {
      await apiRequest(`/api/inventory/reservations/${reservation.id}`, {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: newKey() }),
      });
      reservations.reload();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Inventory</p>
          <h1>Stock Reservations</h1>
          <p>Stock reserved against orders. Issues and dispatches consume reservations; cancelling a sales order releases its reservations automatically.</p>
        </div>
        <div className="inv-header__actions">
          <Button variant="primary" onClick={() => setCreating(true)}>Reserve stock</Button>
        </div>
      </header>

      {error && <p className="inv-dialog__error" role="alert">{error}</p>}

      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field">
            <label htmlFor="rsv-status">Status</label>
            <select id="rsv-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="CONSUMED">Consumed</option>
              <option value="RELEASED">Released</option>
            </select>
          </div>
        </div>
        {reservations.error ? (
          <p className="inv-state inv-state--error" role="alert">{reservations.error}</p>
        ) : reservations.loading && !reservations.data ? (
          <p className="inv-state" role="status">Loading reservations…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">{status ? "No reservations with this status." : "No reservations yet."}</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Item</th><th>Location</th><th>Order</th>
                  <th className="inv-num">Reserved</th><th className="inv-num">Consumed</th>
                  <th className="inv-num">Released</th><th className="inv-num">Open</th>
                  <th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Item"><strong>{row.sku}</strong><small>{row.productName}</small></td>
                    <td data-label="Location">{row.warehouseCode}/{row.locationCode}</td>
                    <td data-label="Order">
                      {row.salesOrderId ? <Link href={`/sales/orders/${row.salesOrderId}`}>View order</Link> : "—"}
                    </td>
                    <td data-label="Reserved" className="inv-num">{row.quantity} {row.unit}</td>
                    <td data-label="Consumed" className="inv-num">{row.consumedQuantity}</td>
                    <td data-label="Released" className="inv-num">{row.releasedQuantity}</td>
                    <td data-label="Open" className="inv-num"><strong>{row.openQuantity}</strong></td>
                    <td data-label="Status">{statusBadge(row.status)}</td>
                    <td data-label="Actions">
                      {row.status === "ACTIVE" && (
                        <button type="button" className="inv-text-button" disabled={busy === row.id} onClick={() => release(row)}>
                          {busy === row.id ? "Releasing…" : "Release"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={reservations.data?.hasMore} onChange={setPage} disabled={reservations.loading} />
      </section>

      {creating && (
        <ReservationForm
          locations={locations.data ?? []}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); reservations.reload(); }}
        />
      )}
    </main>
  );
}
