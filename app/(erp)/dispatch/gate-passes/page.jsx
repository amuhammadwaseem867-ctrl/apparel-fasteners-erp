"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import InventoryPager from "@/components/inventory/InventoryPager";
import { apiRequest } from "@/lib/api/client";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";
import { GatePassStatusBadge, PASS_TYPES } from "@/components/gate/gatePassUi";

import "@/components/inventory/InventoryWorkspace.css";

function newKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function NewGatePassDialog({ onClose, onCreated }) {
  const [values, setValues] = useState({ passType: "OUTWARD_RETURNABLE", partyName: "", purpose: "", vehicleNumber: "", driverName: "", expectedReturnDate: "", shipmentId: "", notes: "" });
  const [lines, setLines] = useState([{ key: newKey(), description: "", unit: "Pcs", quantity: "" }]);
  const [key] = useState(newKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const shipments = useApiData(values.passType === "INWARD" ? null : "/api/dispatch/shipments?status=DISPATCHED&pageSize=100");
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));
  const fromShipment = Boolean(values.shipmentId);
  const filledLines = lines.filter((line) => line.description.trim() && Number(line.quantity) > 0);
  const ready = values.partyName.trim().length >= 2 && values.purpose.trim().length >= 3 && (fromShipment || filledLines.length > 0)
    && (values.passType !== "OUTWARD_RETURNABLE" || values.expectedReturnDate);

  async function submit(event) {
    event.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError("");
    try {
      onCreated(await apiRequest("/api/gate-passes", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          idempotencyKey: key,
          shipmentId: values.shipmentId || undefined,
          lines: fromShipment ? [] : filledLines.map((line) => ({ description: line.description, unit: line.unit, quantity: Number(line.quantity) })),
        }),
      }));
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title="New gate pass" description="Authorises goods through the factory gate. It records the movement only; stock is posted by inventory and dispatch documents." size="large">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          <div className="inv-field">
            <label htmlFor="gp-type">Type *</label>
            <select id="gp-type" value={values.passType} onChange={(event) => setValues((current) => ({ ...current, passType: event.target.value, shipmentId: "" }))}>
              {Object.entries(PASS_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="inv-field"><label htmlFor="gp-party">Party *</label><input id="gp-party" required minLength={2} maxLength={160} placeholder="Supplier, job worker or customer" value={values.partyName} onChange={set("partyName")} /></div>
          <div className="inv-field"><label htmlFor="gp-vehicle">Vehicle</label><input id="gp-vehicle" maxLength={40} value={values.vehicleNumber} onChange={set("vehicleNumber")} /></div>
          <div className="inv-field"><label htmlFor="gp-driver">Driver / carrier</label><input id="gp-driver" maxLength={120} value={values.driverName} onChange={set("driverName")} /></div>
          {values.passType === "OUTWARD_RETURNABLE" && (
            <div className="inv-field"><label htmlFor="gp-return">Expected return *</label><input id="gp-return" type="date" required value={values.expectedReturnDate} onChange={set("expectedReturnDate")} /></div>
          )}
          {values.passType !== "INWARD" && (
            <div className="inv-field">
              <label htmlFor="gp-shipment">Dispatched shipment (optional)</label>
              <select id="gp-shipment" value={values.shipmentId} onChange={set("shipmentId")}>
                <option value="">None: enter lines</option>
                {(shipments.data?.shipments ?? []).map((row) => <option key={row.id} value={row.id}>{row.shipmentNumber} · {row.customerName}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="inv-field"><label htmlFor="gp-purpose">Purpose *</label><input id="gp-purpose" required minLength={3} maxLength={500} placeholder="e.g. Job work: nickel plating" value={values.purpose} onChange={set("purpose")} /></div>
        {fromShipment ? (
          <p className="inv-field__hint">Lines are copied from the shipment.</p>
        ) : lines.map((line, index) => (
          <div key={line.key} className="inv-dialog__grid">
            <div className="inv-field"><label htmlFor={`gp-desc-${line.key}`}>Item {index + 1}</label><input id={`gp-desc-${line.key}`} maxLength={300} value={line.description} onChange={(event) => setLines((current) => current.map((row) => (row.key === line.key ? { ...row, description: event.target.value } : row)))} /></div>
            <div className="inv-field"><label htmlFor={`gp-qty-${line.key}`}>Quantity</label><input id={`gp-qty-${line.key}`} type="number" step="any" min="0" value={line.quantity} onChange={(event) => setLines((current) => current.map((row) => (row.key === line.key ? { ...row, quantity: event.target.value } : row)))} /></div>
            <div className="inv-field"><label htmlFor={`gp-unit-${line.key}`}>Unit</label><input id={`gp-unit-${line.key}`} maxLength={20} value={line.unit} onChange={(event) => setLines((current) => current.map((row) => (row.key === line.key ? { ...row, unit: event.target.value } : row)))} /></div>
          </div>
        ))}
        {!fromShipment && <button type="button" className="inv-text-button" onClick={() => setLines((current) => [...current, { key: newKey(), description: "", unit: "Pcs", quantity: "" }])}>+ Add item</button>}
        <div className="inv-field"><label htmlFor="gp-notes">Notes</label><textarea id="gp-notes" rows={2} maxLength={1000} value={values.notes} onChange={set("notes")} /></div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!ready}>Create gate pass</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function GatePassesPage() {
  const router = useRouter();
  const [status, setStatus] = useState("OPEN");
  const [passType, setPassType] = useState("");
  const [overdue, setOverdue] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const passes = useApiData(`/api/gate-passes${toQuery({ status: overdue ? "" : status, passType, overdue: overdue ? "true" : "", search, page, pageSize: 25 })}`);
  const rows = passes.data?.gatePasses ?? [];

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Dispatch &amp; Logistics</p>
          <h1>Gate Passes</h1>
          <p>Authorisation for goods passing the factory gate: approve, record the movement at the gate, and track returnable items until they come back.</p>
        </div>
        <div className="inv-header__actions"><Button variant="primary" onClick={() => setCreating(true)}>New gate pass</Button></div>
      </header>
      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field"><label htmlFor="gp-search">Search</label><input id="gp-search" type="search" placeholder="Pass number, party, purpose or vehicle" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
          <div className="inv-field">
            <label htmlFor="gp-status">Status</label>
            <select id="gp-status" value={status} disabled={overdue} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="OPEN">Open</option><option value="">All</option><option value="DRAFT">Draft</option><option value="APPROVED">Approved</option>
              <option value="OUT">Out</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div className="inv-field">
            <label htmlFor="gp-ptype">Type</label>
            <select id="gp-ptype" value={passType} onChange={(event) => { setPassType(event.target.value); setPage(1); }}>
              <option value="">All types</option>
              {Object.entries(PASS_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}><input type="checkbox" checked={overdue} onChange={(event) => { setOverdue(event.target.checked); setPage(1); }} /> Overdue returns only</label>
        </div>
        {passes.error ? (
          <p className="inv-state inv-state--error" role="alert">{passes.error}</p>
        ) : !passes.data ? (
          <p className="inv-state" role="status">Loading gate passes…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">No gate passes match these filters.</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Pass</th><th>Type</th><th>Party</th><th>Purpose</th><th className="inv-num">Items</th><th>Vehicle</th><th>Return by</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Pass"><Link href={`/dispatch/gate-passes/${row.id}`}><strong>{row.passNumber}</strong></Link><small>{new Date(row.createdAt).toLocaleDateString("en-GB")}</small></td>
                    <td data-label="Type">{PASS_TYPES[row.passType]}</td>
                    <td data-label="Party">{row.partyName}</td>
                    <td data-label="Purpose">{row.purpose}</td>
                    <td data-label="Items" className="inv-num">{row.lineCount}</td>
                    <td data-label="Vehicle">{row.vehicleNumber || "—"}</td>
                    <td data-label="Return by">{row.expectedReturnDate ?? "—"}</td>
                    <td data-label="Status"><GatePassStatusBadge status={row.status} overdue={row.overdue} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={passes.data?.hasMore} onChange={setPage} disabled={passes.loading} />
      </section>
      {creating && <NewGatePassDialog onClose={() => setCreating(false)} onCreated={(created) => router.push(`/dispatch/gate-passes/${created.id}`)} />}
    </main>
  );
}
