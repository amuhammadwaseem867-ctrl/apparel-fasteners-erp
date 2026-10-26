"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import LocationInput from "@/components/inventory/LocationInput";
import { apiRequest } from "@/lib/api/client";
import useApiData from "@/lib/inventory/useApiData";

import "./PackingListDialog.css";

const PACKAGE_TYPES = ["Carton", "Bag", "Polybag", "Bundle", "Box", "Roll"];

function newKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const sum = (rows, field) => rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
const round = (value) => Math.round(value * 1000) / 1000;

/*
 * The AF7 packing list as a form (D-047): Sr no, Description, Size,
 * Pcs / meters / rolls, No. of bags / cartons and Net / gross weight per
 * row, with totals. "Pass packing" saves the list and passes the packing
 * step in one go: the packing stage is recorded and the packed goods go
 * into finished-goods stock. "Save as draft" keeps it to pass later. The
 * list then shows under Packing lists, with its print and history.
 * `defaults` (order page) prefills the description, size, PO and order no.
 */
export default function PackingListDialog({ initialOrderId = "", defaults = {}, onClose, onCreated }) {
  const [orderId, setOrderId] = useState(initialOrderId);
  const [location, setLocation] = useState({ locationId: "", locationText: undefined });
  const blankRow = (quantity = "") => ({ key: newKey(), description: defaults.description ?? "", size: defaults.size ?? "", quantity, bags: "1", packageType: "Carton", netWeight: "", grossWeight: "" });
  const [rows, setRows] = useState(() => [blankRow()]);
  const [notes, setNotes] = useState("");
  const [key] = useState(newKey);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  const orders = useApiData(initialOrderId ? null : "/api/production/orders?status=WORKING&pageSize=100");
  const order = useApiData(orderId ? `/api/production/orders/${orderId}` : null);
  const locations = useApiData("/api/inventory/locations?status=");
  const locationList = locations.data ?? [];
  const data = order.data;
  const available = data?.stages?.find((stage) => stage.stageKey === "packing")?.available;
  const unit = data?.unit ?? "Pcs";
  const total = round(sum(rows, "quantity"));
  // The location is always required: the user types it or picks a suggestion;
  // the single location returned is not picked silently.
  const ready = orderId && rows.length > 0 && rows.every((row) => Number(row.quantity) > 0 && Number(row.bags) >= 1);

  function update(rowKey, patch) {
    setRows((current) => current.map((row) => (row.key === rowKey ? { ...row, ...patch } : row)));
    setError("");
  }

  async function save(confirm) {
    if (!ready || saving) return;
    setSaving(confirm ? "pass" : "draft");
    setError("");
    const optionalNumber = (value) => (value === "" ? undefined : Number(value));
    const chosen = location.locationId;
    try {
      const created = await apiRequest("/api/packing/lists", {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: `${key}-${confirm ? "pass" : "draft"}`,
          productionOrderId: orderId,
          ...(chosen ? { locationId: chosen } : location.locationText?.trim() ? { locationName: location.locationText.trim() } : {}),
          confirm,
          notes,
          packages: rows.map((row) => ({
            packageType: row.packageType,
            description: row.description,
            size: row.size,
            quantity: Number(row.quantity),
            bags: Number(row.bags),
            netWeight: optionalNumber(row.netWeight),
            grossWeight: optionalNumber(row.grossWeight),
          })),
        }),
      });
      onCreated(created);
    } catch (cause) {
      setError(cause.message);
      setSaving("");
    }
  }

  const description = defaults.description ?? data?.productName ?? "";

  return (
    <Modal open onClose={saving ? undefined : onClose} title="Packing list"
      description="Fill the packing details, then press Pass packing. The packed quantity goes into finished-goods stock and the list is kept under Packing lists to print."
      size="xlarge">
      <form className="inv-dialog pk-form" onSubmit={(event) => { event.preventDefault(); save(true); }}>
        <section className="pk-form__section">
          <h3>1. Document information</h3>
          <div className="pk-form__info">
            <div><span>Date</span><strong>{defaults.date ?? today()}</strong></div>
            <div><span>PO #</span><strong>{defaults.customerPo || "—"}</strong></div>
            <div><span>Order no.</span><strong>{defaults.orderNumber ?? data?.salesOrderNumber ?? "—"}</strong></div>
          </div>
          <div className="inv-dialog__grid">
            {!initialOrderId && (
              <div className="inv-field">
                <label htmlFor="pk-order">Production order *</label>
                <select id="pk-order" required value={orderId} onChange={(event) => setOrderId(event.target.value)}>
                  <option value="">{orders.error ? "Orders unavailable" : "Select order"}</option>
                  {(orders.data?.orders ?? []).map((row) => <option key={row.id} value={row.id}>{row.orderNumber} · {row.sku} · {row.quantity} {row.unit}</option>)}
                </select>
              </div>
            )}
            <LocationInput label="Kept at (finished goods)" blankHint="General" locations={locationList}
              locationId={location.locationId}
              text={location.locationText} onChange={setLocation} />
          </div>
          {available !== undefined && (
            <p className="inv-field__hint" role="status">{available} {unit} is left to pack for {data.orderNumber}.</p>
          )}
        </section>

        <section className="pk-form__section">
          <h3>2. Packing details</h3>
          <div className="inv-table-wrap">
            <table className="inv-table pk-form__table">
              <thead>
                <tr>
                  <th>Sr. no.</th><th>Description</th><th>Size (cm / inches)</th><th className="inv-num">Pcs / meters / rolls *</th>
                  <th className="inv-num">No. of bags / cartons *</th><th>Packed in</th><th className="inv-num">Net weight (kg)</th><th className="inv-num">Gross weight (kg)</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.key}>
                    <td data-label="Sr. no.">{index + 1}</td>
                    <td data-label="Description"><input aria-label={`Description ${index + 1}`} maxLength={200} placeholder={description} value={row.description} onChange={(event) => update(row.key, { description: event.target.value })} /></td>
                    <td data-label="Size"><input aria-label={`Size ${index + 1}`} maxLength={60} placeholder="24 Inch" value={row.size} onChange={(event) => update(row.key, { size: event.target.value })} /></td>
                    <td data-label="Pcs / meters / rolls" className="inv-num"><input aria-label={`Quantity ${index + 1}`} type="number" step="any" min="0" required value={row.quantity} onChange={(event) => update(row.key, { quantity: event.target.value })} /></td>
                    <td data-label="Bags / cartons" className="inv-num"><input aria-label={`Bags ${index + 1}`} type="number" step="1" min="1" required value={row.bags} onChange={(event) => update(row.key, { bags: event.target.value })} /></td>
                    <td data-label="Packed in">
                      <select aria-label={`Packed in ${index + 1}`} value={row.packageType} onChange={(event) => update(row.key, { packageType: event.target.value })}>
                        {PACKAGE_TYPES.map((type) => <option key={type}>{type}</option>)}
                      </select>
                    </td>
                    <td data-label="Net weight" className="inv-num"><input aria-label={`Net weight ${index + 1}`} type="number" step="any" min="0" value={row.netWeight} onChange={(event) => update(row.key, { netWeight: event.target.value })} /></td>
                    <td data-label="Gross weight" className="inv-num"><input aria-label={`Gross weight ${index + 1}`} type="number" step="any" min="0" value={row.grossWeight} onChange={(event) => update(row.key, { grossWeight: event.target.value })} /></td>
                    <td data-label="">
                      {rows.length > 1 && <button type="button" className="inv-text-button" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}>Remove</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Total</td>
                  <td className="inv-num">{total} {unit}</td>
                  <td className="inv-num">{sum(rows, "bags")}</td>
                  <td />
                  <td className="inv-num">{round(sum(rows, "netWeight")) || ""}</td>
                  <td className="inv-num">{round(sum(rows, "grossWeight")) || ""}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <button type="button" className="inv-text-button" onClick={() => setRows((current) => [...current, { ...blankRow(), description: current.at(-1)?.description ?? "", size: current.at(-1)?.size ?? "" }])}>+ Add row</button>
          {available !== undefined && total > Number(available) && (
            <p className="inv-dialog__error" role="alert">Total {total} is more than the {available} {unit} ready to pack.</p>
          )}
        </section>

        <div className="inv-field">
          <label htmlFor="pk-notes">Notes</label>
          <textarea id="pk-notes" rows={2} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={Boolean(saving)}>Cancel</Button>
          <Button variant="secondary" loading={saving === "draft"} disabled={!ready || Boolean(saving)} onClick={() => save(false)}>Save as draft</Button>
          <Button type="submit" variant="primary" loading={saving === "pass"} disabled={!ready || Boolean(saving)}>Pass packing</Button>
        </div>
      </form>
    </Modal>
  );
}

