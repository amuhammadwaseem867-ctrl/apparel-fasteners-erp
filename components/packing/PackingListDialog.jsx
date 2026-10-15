"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import LocationSelect from "@/components/inventory/LocationSelect";
import { apiRequest } from "@/lib/api/client";
import useApiData from "@/lib/inventory/useApiData";

const PACKAGE_TYPES = ["Carton", "Polybag", "Bundle", "Box", "Bag", "Roll"];

function newKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emptyPackage(quantity = "") {
  return { key: newKey(), packageType: "Carton", quantity, netWeight: "", grossWeight: "", dimensions: "", marks: "" };
}

/*
 * Creates a DRAFT packing list for a production order. Confirming it later
 * records the packing stage and receives the packed quantity into the
 * chosen finished-goods location.
 */
export default function PackingListDialog({ initialOrderId = "", onClose, onCreated }) {
  const [orderId, setOrderId] = useState(initialOrderId);
  const [locationId, setLocationId] = useState("");
  const [packages, setPackages] = useState([emptyPackage()]);
  const [split, setSplit] = useState({ total: "", per: "" });
  const [notes, setNotes] = useState("");
  const [key] = useState(newKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const orders = useApiData("/api/production/orders?status=ACTIVE&pageSize=100");
  const order = useApiData(orderId ? `/api/production/orders/${orderId}` : null);
  const locations = useApiData("/api/inventory/locations?status=ACTIVE");
  const available = order.data?.stages?.find((stage) => stage.stageKey === "packing")?.available;
  const total = packages.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const ready = orderId && locationId && packages.length > 0 && packages.every((item) => Number(item.quantity) > 0);

  function update(keyValue, patch) {
    setPackages((current) => current.map((item) => (item.key === keyValue ? { ...item, ...patch } : item)));
    setError("");
  }

  /* Whole packages of `per`, plus one part package for the remainder. */
  function applySplit() {
    const totalUnits = Number(split.total);
    const per = Number(split.per);
    if (!(totalUnits > 0 && per > 0) || totalUnits / per > 500) return;
    const full = Math.floor(totalUnits / per);
    const rest = Number((totalUnits - full * per).toFixed(6));
    setPackages([...Array.from({ length: full }, () => emptyPackage(String(per))), ...(rest > 0 ? [emptyPackage(String(rest))] : [])]);
  }

  async function submit(event) {
    event.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError("");
    const optionalNumber = (value) => (value === "" ? undefined : Number(value));
    try {
      const created = await apiRequest("/api/packing/lists", {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: key,
          productionOrderId: orderId,
          locationId,
          notes,
          packages: packages.map((item) => ({
            packageType: item.packageType,
            quantity: Number(item.quantity),
            netWeight: optionalNumber(item.netWeight),
            grossWeight: optionalNumber(item.grossWeight),
            dimensions: item.dimensions,
            marks: item.marks,
          })),
        }),
      });
      onCreated(created);
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title="New packing list"
      description="Pack output that has passed Quality Check. Confirming the list later records the packing stage and receives the packed quantity into finished-goods stock."
      size="large">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          <div className="inv-field">
            <label htmlFor="pk-order">Production order *</label>
            <select id="pk-order" required value={orderId} onChange={(event) => setOrderId(event.target.value)}>
              <option value="">{orders.error ? "Orders unavailable" : "Select order"}</option>
              {(orders.data?.orders ?? []).map((row) => <option key={row.id} value={row.id}>{row.orderNumber} · {row.sku} · {row.quantity} {row.unit}</option>)}
            </select>
          </div>
          <LocationSelect label="Receive into (finished goods location)" required locations={locations.data ?? []} value={locationId} onChange={setLocationId} />
        </div>
        {available !== undefined && (
          <p className="inv-field__hint" role="status">{available} {order.data.unit} has passed Quality Check and is waiting to be packed for {order.data.orderNumber}.</p>
        )}

        <fieldset className="inv-dialog__line">
          <legend>Quick fill</legend>
          <div className="inv-dialog__grid">
            <div className="inv-field">
              <label htmlFor="pk-split-total">Total to pack</label>
              <input id="pk-split-total" type="number" step="any" min="0" value={split.total} onChange={(event) => setSplit((current) => ({ ...current, total: event.target.value }))} />
            </div>
            <div className="inv-field">
              <label htmlFor="pk-split-per">Per package</label>
              <input id="pk-split-per" type="number" step="any" min="0" value={split.per} onChange={(event) => setSplit((current) => ({ ...current, per: event.target.value }))} />
            </div>
          </div>
          <button type="button" className="inv-text-button" onClick={applySplit}>Create packages</button>
        </fieldset>

        {packages.map((item, index) => (
          <fieldset key={item.key} className="inv-dialog__line">
            <legend>Package {index + 1}</legend>
            <div className="inv-dialog__grid">
              <div className="inv-field">
                <label htmlFor={`pk-type-${item.key}`}>Type</label>
                <select id={`pk-type-${item.key}`} value={item.packageType} onChange={(event) => update(item.key, { packageType: event.target.value })}>
                  {PACKAGE_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
              </div>
              <div className="inv-field">
                <label htmlFor={`pk-qty-${item.key}`}>Quantity *</label>
                <input id={`pk-qty-${item.key}`} type="number" step="any" min="0" required value={item.quantity} onChange={(event) => update(item.key, { quantity: event.target.value })} />
              </div>
              <div className="inv-field">
                <label htmlFor={`pk-net-${item.key}`}>Net kg</label>
                <input id={`pk-net-${item.key}`} type="number" step="any" min="0" value={item.netWeight} onChange={(event) => update(item.key, { netWeight: event.target.value })} />
              </div>
              <div className="inv-field">
                <label htmlFor={`pk-gross-${item.key}`}>Gross kg</label>
                <input id={`pk-gross-${item.key}`} type="number" step="any" min="0" value={item.grossWeight} onChange={(event) => update(item.key, { grossWeight: event.target.value })} />
              </div>
              <div className="inv-field">
                <label htmlFor={`pk-dim-${item.key}`}>Dimensions</label>
                <input id={`pk-dim-${item.key}`} maxLength={60} placeholder="e.g. 40×30×20 cm" value={item.dimensions} onChange={(event) => update(item.key, { dimensions: event.target.value })} />
              </div>
              <div className="inv-field">
                <label htmlFor={`pk-marks-${item.key}`}>Marks</label>
                <input id={`pk-marks-${item.key}`} maxLength={200} value={item.marks} onChange={(event) => update(item.key, { marks: event.target.value })} />
              </div>
            </div>
            {packages.length > 1 && (
              <button type="button" className="inv-text-button" onClick={() => setPackages((current) => current.filter((row) => row.key !== item.key))}>Remove package</button>
            )}
          </fieldset>
        ))}
        <button type="button" className="inv-text-button" onClick={() => setPackages((current) => [...current, emptyPackage()])}>+ Add package</button>
        <p className="inv-field__hint" role="status">{packages.length} {packages.length === 1 ? "package" : "packages"} · {Number(total.toFixed(6))} total</p>

        <div className="inv-field">
          <label htmlFor="pk-notes">Notes</label>
          <textarea id="pk-notes" rows={2} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!ready}>Create packing list</Button>
        </div>
      </form>
    </Modal>
  );
}
