"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import LocationInput from "@/components/inventory/LocationInput";
import { apiRequest } from "@/lib/api/client";
import useApiData from "@/lib/inventory/useApiData";

function newKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/*
 * Creates a DRAFT shipment for one approved sales order: confirmed packing
 * lists and/or loose finished-goods stock. The server refuses any item
 * that would ship past its ordered quantity; dispatching (on the shipment)
 * posts the stock out.
 */
export default function ShipmentDialog({ initialSalesOrderId = "", onClose, onCreated }) {
  const [salesOrderId, setSalesOrderId] = useState(initialSalesOrderId);
  const [selected, setSelected] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [loose, setLoose] = useState({});
  const [chosen, setChosen] = useState({ locationId: "", locationText: undefined });
  const [transport, setTransport] = useState({ vehicleNumber: "", driverName: "", driverPhone: "", transporter: "", trackingReference: "", deliveryAddress: "", notes: "" });
  const [key] = useState(newKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const orders = useApiData("/api/sales/orders?status=APPROVED&pageSize=100");
  const fulfilment = useApiData(salesOrderId ? `/api/dispatch/sales-orders/${salesOrderId}` : null);
  const locations = useApiData("/api/inventory/locations?status=ACTIVE");
  const data = fulfilment.data;
  const firstList = data?.readyPackingLists.find((list) => selected.includes(list.id));
  // Packed goods sit at their packing location; default the ship-from there.
  const typed = chosen.locationText !== undefined;
  const locationId = typed ? chosen.locationId : firstList?.locationId || "";
  const locationName = typed && !chosen.locationId ? chosen.locationText.trim() : "";

  const readyLines = selected.map((packingListId) => {
    const list = data?.readyPackingLists.find((row) => row.id === packingListId);
    // Default: the list's still-unshipped quantity.
    const quantity = quantities[packingListId] ?? list?.outstandingQuantity ?? "";
    const outstanding = Number(list?.outstandingQuantity ?? 0);
    return { packingListId, quantity: Number(quantity), outstanding, valid: Number(quantity) > 0 && Number(quantity) <= outstanding };
  });
  const looseLines = Object.entries(loose).filter(([, quantity]) => Number(quantity) > 0);
  const ready = salesOrderId && (readyLines.some((line) => line.valid) || looseLines.length > 0);
  const setField = (field) => (event) => setTransport((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError("");
    try {
      const created = await apiRequest("/api/dispatch/shipments", {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: key,
          salesOrderId,
          ...(locationId ? { locationId } : locationName ? { locationName } : {}),
          ...transport,
          lines: [
            ...readyLines.filter((line) => line.valid).map((line) => ({ packingListId: line.packingListId, quantity: line.quantity })),
            ...looseLines.map(([productId, quantity]) => ({ productId, quantity: Number(quantity) })),
          ],
        }),
      });
      onCreated(created);
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title="New shipment"
      description="A draft shipment for one approved sales order. Nothing leaves stock until the shipment is dispatched."
      size="large">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-field">
          <label htmlFor="sh-order">Sales order *</label>
          <select id="sh-order" required value={salesOrderId} onChange={(event) => { setSalesOrderId(event.target.value); setSelected([]); setQuantities({}); setLoose({}); setError(""); }}>
            <option value="">{orders.error ? "Sales orders unavailable" : "Select approved order"}</option>
            {(orders.data?.orders ?? []).map((order) => <option key={order.id} value={order.id}>{order.orderNumber} · {order.customerName}</option>)}
          </select>
        </div>

        {fulfilment.error && <p className="inv-dialog__error" role="alert">{fulfilment.error}</p>}
        {data && (
          <>
            <div className="inv-table-wrap">
              <table className="inv-table">
                <thead><tr><th>Item</th><th className="inv-num">Ordered</th><th className="inv-num">Shipped</th><th className="inv-num">Remaining</th><th className="inv-num">Packed, ready</th><th className="inv-num">Loose stock to ship</th></tr></thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.productId}>
                      <td data-label="Item"><strong>{item.sku}</strong><small>{item.productName}</small></td>
                      <td data-label="Ordered" className="inv-num">{item.ordered} {item.unit}</td>
                      <td data-label="Shipped" className="inv-num">{item.shipped}</td>
                      <td data-label="Remaining" className="inv-num">{item.remaining}</td>
                      <td data-label="Packed, ready" className="inv-num">{item.packedReady}</td>
                      <td data-label="Loose stock to ship" className="inv-num">
                        <input aria-label={`Loose quantity of ${item.sku}`} type="number" step="any" min="0" style={{ width: 110 }}
                          value={loose[item.productId] ?? ""} onChange={(event) => setLoose((current) => ({ ...current, [item.productId]: event.target.value }))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.customLines > 0 && <p className="inv-field__hint">{data.customLines} custom line(s) on this order have no catalogue item and cannot be shipped here.</p>}

            <fieldset className="inv-dialog__line">
              <legend>Packed lists ready to ship</legend>
              {data.readyPackingLists.length === 0 ? (
                <p className="inv-field__hint">No confirmed packing lists for this order.</p>
              ) : data.readyPackingLists.map((list) => {
                const item = data.items.find((row) => row.productId === list.productId);
                const outstanding = Number(list.outstandingQuantity ?? list.totalQuantity);
                return (
                  <div key={list.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 6 }}>
                    <input type="checkbox" checked={selected.includes(list.id)}
                      onChange={(event) => setSelected((current) => (event.target.checked ? [...current, list.id] : current.filter((value) => value !== list.id)))} />
                    <span style={{ flex: 1 }}>
                      {list.packingNumber} · {item?.sku ?? "item"} · {list.totalQuantity} packed
                      {Number(list.allocatedQuantity) > 0 ? ` · ${list.allocatedQuantity} shipped` : ""} · {outstanding} left
                      {list.packageCount ? ` · ${list.packageCount} packages` : ""}
                    </span>
                    {selected.includes(list.id) && (
                      <input aria-label={`Quantity of ${list.packingNumber}`} type="number" step="any" min="0" max={outstanding} style={{ width: 110 }}
                        value={quantities[list.id] ?? outstanding}
                        onChange={(event) => setQuantities((current) => ({ ...current, [list.id]: event.target.value }))} />
                    )}
                  </div>
                );
              })}
            </fieldset>
          </>
        )}

        <LocationInput label="Ship from (loose items)" blankHint="packed lists ship from where they are kept" locations={locations.data ?? []} locationId={locationId} text={chosen.locationText} onChange={setChosen} />
        <div className="inv-dialog__grid">
          <div className="inv-field"><label htmlFor="sh-vehicle">Vehicle number</label><input id="sh-vehicle" maxLength={40} value={transport.vehicleNumber} onChange={setField("vehicleNumber")} /></div>
          <div className="inv-field"><label htmlFor="sh-driver">Driver</label><input id="sh-driver" maxLength={120} value={transport.driverName} onChange={setField("driverName")} /></div>
          <div className="inv-field"><label htmlFor="sh-phone">Driver phone</label><input id="sh-phone" maxLength={40} value={transport.driverPhone} onChange={setField("driverPhone")} /></div>
          <div className="inv-field"><label htmlFor="sh-transporter">Transporter</label><input id="sh-transporter" maxLength={120} value={transport.transporter} onChange={setField("transporter")} /></div>
          <div className="inv-field"><label htmlFor="sh-tracking">Tracking / bilty no.</label><input id="sh-tracking" maxLength={120} value={transport.trackingReference} onChange={setField("trackingReference")} /></div>
        </div>
        <div className="inv-field"><label htmlFor="sh-address">Delivery address</label><textarea id="sh-address" rows={2} maxLength={500} value={transport.deliveryAddress} onChange={setField("deliveryAddress")} /></div>
        <div className="inv-field"><label htmlFor="sh-notes">Notes</label><textarea id="sh-notes" rows={2} maxLength={1000} value={transport.notes} onChange={setField("notes")} /></div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!ready}>Create draft shipment</Button>
        </div>
      </form>
    </Modal>
  );
}
