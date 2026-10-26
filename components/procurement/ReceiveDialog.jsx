"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import LocationInput from "@/components/inventory/LocationInput";
import { newKey, today } from "@/components/procurement/procurementUi";
import { apiRequest } from "@/lib/api/client";
import useApiData from "@/lib/inventory/useApiData";

/*
 * Goods receipt against an approved PO. Quantities default to what is
 * still outstanding; the server refuses anything above it. Stock is
 * posted to the chosen location, optionally straight into QC hold.
 */
export default function ReceiveDialog({ order, onClose, onDone }) {
  const locations = useApiData("/api/inventory/locations?status=ACTIVE");
  const open = order.lines.filter((line) => Number(line.outstandingQuantity) > 0);
  const [place, setPlace] = useState({ locationId: "", locationText: undefined });
  const [values, setValues] = useState({ receivedDate: today(), deliveryNoteRef: "", qualityHold: false, notes: "" });
  const [quantities, setQuantities] = useState(() => Object.fromEntries(open.map((line) => [line.id, line.outstandingQuantity])));
  const [key] = useState(newKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lines = open.filter((line) => Number(quantities[line.id]) > 0).map((line) => ({ purchaseOrderLineId: line.id, quantity: Number(quantities[line.id]) }));
  const valid = lines.length > 0;

  async function submit(event) {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      onDone(await apiRequest("/api/procurement/receipts", {
        method: "POST",
        body: JSON.stringify({ ...values, ...(place.locationId ? { locationId: place.locationId } : place.locationText?.trim() ? { locationName: place.locationText.trim() } : {}), idempotencyKey: key, purchaseOrderId: order.id, lines }),
      }));
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title={`Receive goods on ${order.poNumber}`} description={`From ${order.supplierName}. Stock is posted to the location immediately; a PO line can never be received beyond its ordered quantity.`} size="large">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          <LocationInput label="Receive into" blankHint="General" locations={locations.data ?? []} locationId={place.locationId} text={place.locationText} onChange={setPlace} />
          <div className="inv-field"><label htmlFor="gr-date">Received on *</label><input id="gr-date" type="date" required value={values.receivedDate} onChange={(event) => setValues((current) => ({ ...current, receivedDate: event.target.value }))} /></div>
          <div className="inv-field"><label htmlFor="gr-dn">Supplier delivery note</label><input id="gr-dn" maxLength={80} value={values.deliveryNoteRef} onChange={(event) => setValues((current) => ({ ...current, deliveryNoteRef: event.target.value }))} /></div>
        </div>
        <label className="inv-check" htmlFor="gr-hold">
          <input id="gr-hold" type="checkbox" checked={values.qualityHold} onChange={(event) => setValues((current) => ({ ...current, qualityHold: event.target.checked }))} />
          {" "}Hold for incoming inspection (stock is not available until released by QC)
        </label>
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead><tr><th>Item</th><th className="inv-num">Ordered</th><th className="inv-num">Received</th><th>Receive now</th></tr></thead>
            <tbody>
              {open.map((line) => (
                <tr key={line.id}>
                  <td data-label="Item"><strong>{line.sku}</strong><small>{line.productName}</small></td>
                  <td data-label="Ordered" className="inv-num">{line.quantity} {line.unit}</td>
                  <td data-label="Received" className="inv-num">{line.receivedQuantity}</td>
                  <td data-label="Receive now"><input aria-label={`Receive ${line.sku}`} type="number" min="0" max={line.outstandingQuantity} step="any" value={quantities[line.id]} onChange={(event) => setQuantities((current) => ({ ...current, [line.id]: event.target.value }))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="inv-field"><label htmlFor="gr-notes">Notes</label><textarea id="gr-notes" rows={2} maxLength={500} value={values.notes} onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))} /></div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!valid}>Post goods receipt</Button>
        </div>
      </form>
    </Modal>
  );
}
