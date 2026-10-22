"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import InventoryPager from "@/components/inventory/InventoryPager";
import ItemPicker from "@/components/inventory/ItemPicker";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const TONE = { ACTIVE: "", ON_HOLD: "warning", RELEASED: "good", REJECTED: "danger", CONSUMED: "" };
const label = (value) => value.charAt(0) + value.slice(1).toLowerCase().replace("_", " ");
const todayIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function NewBatchDialog({ onClose, onSaved }) {
  const [item, setItem] = useState(null);
  const [values, setValues] = useState({ sourceType: "PRODUCTION", productionOrderId: "", purchaseReceiptId: "", supplierLotRef: "", quantity: "", madeOn: todayIso(), expiresOn: "", notes: "" });
  const orders = useApiData(values.sourceType === "PRODUCTION" && item ? `/api/production/orders${toQuery({ search: item.sku, pageSize: 100 })}` : null);
  const receipts = useApiData(values.sourceType === "PURCHASE" ? "/api/procurement/receipts?pageSize=100" : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));
  const orderRows = (orders.data?.orders ?? []).filter((row) => !item || row.productId === item.id);

  async function submit(event) {
    event.preventDefault();
    if (saving || !item) return;
    setSaving(true);
    setError("");
    try {
      onSaved(await apiRequest("/api/inventory/batches", {
        method: "POST",
        body: JSON.stringify({
          productId: item.id, sourceType: values.sourceType, quantity: Number(values.quantity), madeOn: values.madeOn, expiresOn: values.expiresOn, notes: values.notes, supplierLotRef: values.supplierLotRef,
          ...(values.sourceType === "PRODUCTION" ? { productionOrderId: values.productionOrderId } : {}),
          ...(values.sourceType === "PURCHASE" ? { purchaseReceiptId: values.purchaseReceiptId } : {}),
        }),
      }));
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title="Register a batch" description="A batch can never exceed what its production order made or its goods receipt brought in." size="large">
      <form className="inv-dialog" onSubmit={submit}>
        <ItemPicker label="Item" value={item} onChange={setItem} required />
        <div className="inv-dialog__grid">
          <div className="inv-field"><label htmlFor="bt-src">Source *</label><select id="bt-src" value={values.sourceType} onChange={set("sourceType")}><option value="PRODUCTION">Production order</option><option value="PURCHASE">Goods receipt</option><option value="OPENING">Opening stock</option></select></div>
          {values.sourceType === "PRODUCTION" && (
            <div className="inv-field">
              <label htmlFor="bt-order">Production order *</label>
              <select id="bt-order" required value={values.productionOrderId} onChange={set("productionOrderId")}>
                <option value="">{item ? "Select order" : "Choose the item first"}</option>
                {orderRows.map((row) => <option key={row.id} value={row.id}>{row.orderNumber} · {row.quantity} {row.unit} · {String(row.status).toLowerCase()}</option>)}
              </select>
            </div>
          )}
          {values.sourceType === "PURCHASE" && (
            <div className="inv-field">
              <label htmlFor="bt-rec">Goods receipt *</label>
              <select id="bt-rec" required value={values.purchaseReceiptId} onChange={set("purchaseReceiptId")}>
                <option value="">Select receipt</option>
                {(receipts.data?.receipts ?? []).map((row) => <option key={row.id} value={row.id}>{row.receiptNumber} · {row.poNumber} · {row.supplierName}</option>)}
              </select>
            </div>
          )}
          {values.sourceType === "PURCHASE" && <div className="inv-field"><label htmlFor="bt-lot">Supplier lot no.</label><input id="bt-lot" maxLength={60} value={values.supplierLotRef} onChange={set("supplierLotRef")} /></div>}
          <div className="inv-field"><label htmlFor="bt-qty">Quantity{item ? ` (${item.unit})` : ""} *</label><input id="bt-qty" type="number" min="0" step="any" required value={values.quantity} onChange={set("quantity")} /></div>
          <div className="inv-field"><label htmlFor="bt-made">Batch date *</label><input id="bt-made" type="date" required value={values.madeOn} onChange={set("madeOn")} /></div>
          <div className="inv-field"><label htmlFor="bt-exp">Expires</label><input id="bt-exp" type="date" min={values.madeOn} value={values.expiresOn} onChange={set("expiresOn")} /></div>
        </div>
        <div className="inv-field"><label htmlFor="bt-notes">Notes</label><input id="bt-notes" maxLength={500} value={values.notes} onChange={set("notes")} /></div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!item}>Register batch</Button>
        </div>
      </form>
    </Modal>
  );
}

function BatchDetail({ id, onClose, onChanged }) {
  const { can } = useCurrentUser();
  const result = useApiData(`/api/inventory/batches/${encodeURIComponent(id)}`);
  const [error, setError] = useState("");
  const data = result.data;

  async function setStatus(status) {
    const note = window.prompt(`Note for marking this batch ${label(status).toLowerCase()} (optional)`);
    if (note === null) return;
    setError("");
    try {
      await apiRequest(`/api/inventory/batches/${id}`, { method: "PATCH", body: JSON.stringify({ status, note }) });
      result.reload();
      onChanged();
    } catch (cause) {
      setError(cause.message);
    }
  }

  const next = { ACTIVE: ["ON_HOLD", "RELEASED", "REJECTED", "CONSUMED"], ON_HOLD: ["RELEASED", "REJECTED"], RELEASED: ["ON_HOLD", "CONSUMED"] }[data?.status] ?? [];
  return (
    <Modal open onClose={onClose} title={data ? `Batch ${data.batchNumber}` : "Batch"} size="large">
      {result.error ? <p className="inv-dialog__error" role="alert">{result.error}</p> : !data ? <p className="inv-state" role="status">Loadingâ€¦</p> : (
        <div className="inv-dialog">
          <p><span className={`inv-badge ${TONE[data.status] ? `inv-badge--${TONE[data.status]}` : ""}`}>{label(data.status)}</span> {data.expired && <span className="inv-badge inv-badge--danger">Expired</span>} · {data.sku} {data.productName} · {data.quantity} {data.unit} · dated {data.madeOn}{data.expiresOn ? ` · expires ${data.expiresOn}` : ""}</p>
          <h3>Traceability</h3>
          <ul>
            {data.trace.productionOrderNumber && <li>Made on production order <Link href={`/production/orders/${data.productionOrderId}`}>{data.trace.productionOrderNumber}</Link></li>}
            {data.trace.receiptNumber && <li>Received on {data.trace.receiptNumber} against <Link href={`/procurement/purchase-orders/${data.trace.purchaseOrderId}`}>{data.trace.poNumber}</Link> from {data.trace.supplierName}{data.supplierLotRef ? ` (supplier lot ${data.supplierLotRef})` : ""}</li>}
            {data.sourceType === "OPENING" && <li>Opening stock</li>}
            {data.trace.inspections.map((row) => <li key={row.id}>Inspection {row.inspectionNumber} ({row.inspectionType.toLowerCase()}, {row.status.toLowerCase()}): {row.passed} passed, {row.rejected} rejected</li>)}
            {data.trace.ncrs.map((row) => <li key={row.id}>NCR <Link href={`/quality/ncr?ncr=${row.id}`}>{row.ncrNumber}</Link>: {row.title} ({row.status.toLowerCase()})</li>)}
          </ul>
          {data.notes && <p style={{ whiteSpace: "pre-wrap" }}>{data.notes}</p>}
          {error && <p className="inv-dialog__error" role="alert">{error}</p>}
          <div className="inv-dialog__actions">
            {next.filter((status) => status === "CONSUMED" ? can("inventory:create") || can("quality:approve") : can("quality:approve")).map((status) => <Button key={status} variant="secondary" onClick={() => setStatus(status)}>{status === "ON_HOLD" ? "Put on hold" : status === "CONSUMED" ? "Mark consumed" : label(status)}</Button>)}
            <Button variant="primary" onClick={onClose}>Close</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function BatchesLotsPage() {
  const { can } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState("");
  const list = useApiData(`/api/inventory/batches${toQuery({ search, status, page, pageSize: 50 })}`);
  const rows = list.data?.batches ?? [];

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/inventory">Inventory</Link></p>
          <h1>Batches &amp; lots</h1>
          <p>A register of production and supplier batches with dates, status and traceability to inspections and NCRs. Stock balances are not split by batch, and shipments do not record batches.</p>
        </div>
        <div className="inv-header__actions">{(can("inventory:create") || can("quality:create")) && <Button variant="primary" onClick={() => setCreating(true)}>Register batch</Button>}</div>
      </header>
      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field"><label htmlFor="bt-search">Search</label><input id="bt-search" type="search" placeholder="Batch, SKU, supplier lot, order or receipt" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
          <div className="inv-field"><label htmlFor="bt-status">Status</label><select id="bt-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All</option><option value="ACTIVE">Active</option><option value="ON_HOLD">On hold</option><option value="RELEASED">Released</option><option value="REJECTED">Rejected</option><option value="CONSUMED">Consumed</option><option value="EXPIRED">Expired (not consumed)</option></select></div>
        </div>
        {list.error ? <p className="inv-state inv-state--error" role="alert">{list.error}</p> : !list.data ? <p className="inv-state" role="status">Loading batchesâ€¦</p> : rows.length === 0 ? <p className="inv-state">No batches{search || status ? " match" : " registered yet"}.</p> : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Batch</th><th>Item</th><th>Source</th><th className="inv-num">Quantity</th><th>Dates</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Batch"><button type="button" className="inv-link-button" onClick={() => setViewing(row.id)}><strong>{row.batchNumber}</strong></button>{row.supplierLotRef && <small>lot {row.supplierLotRef}</small>}</td>
                    <td data-label="Item">{row.sku}<small>{row.productName}</small></td>
                    <td data-label="Source">{label(row.sourceType)}<small>{row.source}</small></td>
                    <td data-label="Quantity" className="inv-num">{row.quantity} {row.unit}</td>
                    <td data-label="Dates">{row.madeOn}{row.expiresOn && <small className={row.expired ? "inv-neg" : ""}>expires {row.expiresOn}</small>}</td>
                    <td data-label="Status"><span className={`inv-badge ${TONE[row.status] ? `inv-badge--${TONE[row.status]}` : ""}`}>{label(row.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={list.data?.hasMore} onChange={setPage} disabled={list.loading} />
      </section>
      {creating && <NewBatchDialog onClose={() => setCreating(false)} onSaved={(batch) => { setCreating(false); list.reload(); setViewing(batch.id); }} />}
      {viewing && <BatchDetail key={viewing} id={viewing} onClose={() => setViewing("")} onChanged={() => list.reload()} />}
    </main>
  );
}

