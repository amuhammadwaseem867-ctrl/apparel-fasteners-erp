"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const UNITS = ["Pcs", "Meters", "Kgs", "Yards", "Sets"];

function CenterDialog({ center, onClose, onSaved }) {
  const [values, setValues] = useState({ name: center.name, dailyCapacity: center.dailyCapacity ?? "", capacityUnit: center.capacityUnit ?? "Pcs", shiftsPerDay: String(center.shiftsPerDay ?? 1), notes: center.notes ?? "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/api/planning/work-centers/${center.stageKey}`, { method: "PUT", body: JSON.stringify({ ...values, dailyCapacity: Number(values.dailyCapacity), shiftsPerDay: Number(values.shiftsPerDay) }) });
      onSaved();
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title={`Capacity: ${center.label}`} description="What this stage can process in one shift, in one unit. Load in other units is shown but not compared." size="medium">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          <div className="inv-field"><label htmlFor="wc-name">Work centre name *</label><input id="wc-name" required minLength={2} maxLength={80} value={values.name} onChange={set("name")} /></div>
          <div className="inv-field"><label htmlFor="wc-cap">Capacity per shift *</label><input id="wc-cap" type="number" min="0" step="any" required value={values.dailyCapacity} onChange={set("dailyCapacity")} /></div>
          <div className="inv-field"><label htmlFor="wc-unit">Unit *</label><select id="wc-unit" value={values.capacityUnit} onChange={set("capacityUnit")}>{UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></div>
          <div className="inv-field"><label htmlFor="wc-shifts">Shifts per day *</label><select id="wc-shifts" value={values.shiftsPerDay} onChange={set("shiftsPerDay")}><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></div>
        </div>
        <div className="inv-field"><label htmlFor="wc-notes">Notes</label><input id="wc-notes" maxLength={300} value={values.notes} onChange={set("notes")} /></div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>Save capacity</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function CapacityPage() {
  const { can } = useCurrentUser();
  const [horizon, setHorizon] = useState(30);
  const [editing, setEditing] = useState(null);
  const result = useApiData(`/api/planning/capacity${toQuery({ horizon })}`);
  const data = result.data;

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/planning">Planning</Link></p>
          <h1>Capacity planning</h1>
          <p>Quantity still to pass each production stage on open orders, against that stage&apos;s capacity over the working days ahead (weekly off days and holidays from the planning calendar are excluded).</p>
        </div>
        <div className="inv-header__actions"><Link className="inv-link-button" href="/planning/calendar">Calendar</Link></div>
      </header>
      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field">
            <label htmlFor="cp-horizon">Horizon</label>
            <select id="cp-horizon" value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}><option value={7}>Next 7 days</option><option value={14}>Next 14 days</option><option value={30}>Next 30 days</option><option value={60}>Next 60 days</option><option value={90}>Next 90 days</option></select>
          </div>
          {data && <p className="inv-field__hint" style={{ alignSelf: "end" }}>{data.workingDays} working days from {data.asOf}.</p>}
        </div>
        {result.error ? <p className="inv-state inv-state--error" role="alert">{result.error}</p> : !data ? <p className="inv-state" role="status">Loading capacity…</p> : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Stage</th><th>Capacity</th><th>Open load</th><th className="inv-num">Days of work</th><th className="inv-num">Utilisation</th><th /></tr></thead>
              <tbody>
                {data.stages.map((stage) => (
                  <tr key={stage.stageKey}>
                    <td data-label="Stage"><strong>{stage.sequence}. {stage.label}</strong><small>{stage.configured ? stage.name : stage.department}</small></td>
                    <td data-label="Capacity">{stage.configured ? `${stage.dailyCapacity} ${stage.capacityUnit} × ${stage.shiftsPerDay} shift${stage.shiftsPerDay > 1 ? "s" : ""}` : <span className="inv-badge inv-badge--warning">Not set</span>}</td>
                    <td data-label="Open load">{stage.load.length === 0 ? "—" : stage.load.map((load) => <div key={load.unit}>{load.quantity} {load.unit} · {load.orders} order{load.orders === 1 ? "" : "s"}{load.overdueOrders ? <span className="inv-neg"> · {load.overdueOrders} overdue</span> : ""}</div>)}{stage.otherUnits.length > 0 && stage.configured && <small>{stage.otherUnits.join(", ")} not comparable with {stage.capacityUnit}</small>}</td>
                    <td data-label="Days of work" className="inv-num">{stage.loadDays ?? "—"}</td>
                    <td data-label="Utilisation" className={`inv-num ${stage.utilisationPercent > 100 ? "inv-neg" : ""}`}>{stage.utilisationPercent === null ? "—" : `${stage.utilisationPercent}%`}</td>
                    <td data-label="">{can("production:update") && <button type="button" className="inv-link-button" onClick={() => setEditing(stage)}>{stage.configured ? "Edit" : "Set capacity"}</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && <CenterDialog center={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); result.reload(); }} />}
    </main>
  );
}

