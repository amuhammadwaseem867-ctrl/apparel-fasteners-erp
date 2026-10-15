"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const hours = (minutes) => `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`;

function ShiftDialog({ shift, onClose, onSaved }) {
  const [values, setValues] = useState({ code: "", name: shift?.name ?? "", startTime: shift?.startTime ?? "08:00", endTime: shift?.endTime ?? "17:00", breakMinutes: String(shift?.breakMinutes ?? 60), status: shift?.status ?? "ACTIVE" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    const body = { name: values.name, startTime: values.startTime, endTime: values.endTime, breakMinutes: Number(values.breakMinutes) };
    try {
      await apiRequest(shift ? `/api/hr/shifts/${shift.id}` : "/api/hr/shifts", { method: shift ? "PATCH" : "POST", body: JSON.stringify(shift ? { ...body, status: values.status } : { ...body, code: values.code.toUpperCase() }) });
      onSaved();
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title={shift ? `Edit shift ${shift.code}` : "New shift"} description="An end time earlier than the start is an overnight shift." size="medium">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          {!shift && <div className="inv-field"><label htmlFor="sh-code">Code *</label><input id="sh-code" required maxLength={12} value={values.code} onChange={set("code")} /></div>}
          <div className="inv-field"><label htmlFor="sh-name">Name *</label><input id="sh-name" required minLength={2} maxLength={80} value={values.name} onChange={set("name")} /></div>
          <div className="inv-field"><label htmlFor="sh-start">Starts *</label><input id="sh-start" type="time" required value={values.startTime} onChange={set("startTime")} /></div>
          <div className="inv-field"><label htmlFor="sh-end">Ends *</label><input id="sh-end" type="time" required value={values.endTime} onChange={set("endTime")} /></div>
          <div className="inv-field"><label htmlFor="sh-break">Break (minutes)</label><input id="sh-break" type="number" min="0" max="240" step="5" value={values.breakMinutes} onChange={set("breakMinutes")} /></div>
          {shift && <div className="inv-field"><label htmlFor="sh-status">Status</label><select id="sh-status" value={values.status} onChange={set("status")}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div>}
        </div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>{shift ? "Save shift" : "Create shift"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ShiftsPage() {
  const { can } = useCurrentUser();
  const result = useApiData("/api/hr/shifts");
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState([]);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shifts = result.data?.shifts ?? [];
  const roster = result.data?.roster ?? [];
  const manage = can("hr:manage");

  async function assign() {
    setBusy(true);
    setError("");
    try {
      await apiRequest("/api/hr/shifts/assign", { method: "POST", body: JSON.stringify({ employeeIds: selected, shiftId: target === "none" ? null : target }) });
      setSelected([]);
      result.reload();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/people-payroll">People &amp; Payroll</Link></p>
          <h1>Shifts</h1>
          <p>Working hours and which employees work them. Attendance and overtime are still recorded per day on the Attendance page.</p>
        </div>
        <div className="inv-header__actions">{manage && <Button variant="primary" onClick={() => setEditing("new")}>New shift</Button>}</div>
      </header>
      {result.error && <p className="inv-state inv-state--error" role="alert">{result.error}</p>}
      <section className="inv-card">
        {!result.data ? <p className="inv-state" role="status">Loading shifts…</p> : shifts.length === 0 ? <p className="inv-state">No shifts defined yet.</p> : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Shift</th><th>Hours</th><th className="inv-num">Paid time</th><th className="inv-num">Employees</th><th>Status</th><th /></tr></thead>
              <tbody>
                {shifts.map((shift) => (
                  <tr key={shift.id}>
                    <td data-label="Shift"><strong>{shift.code}</strong> {shift.name}</td>
                    <td data-label="Hours">{shift.startTime}–{shift.endTime}{shift.overnight ? " (overnight)" : ""}<small>{shift.breakMinutes} min break</small></td>
                    <td data-label="Paid time" className="inv-num">{hours(shift.paidMinutes)}</td>
                    <td data-label="Employees" className="inv-num">{shift.employees}</td>
                    <td data-label="Status">{shift.status === "ACTIVE" ? <span className="inv-badge inv-badge--good">Active</span> : <span className="inv-badge inv-badge--danger">Inactive</span>}</td>
                    <td data-label="">{manage && <button type="button" className="inv-link-button" onClick={() => setEditing(shift)}>Edit</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="inv-card">
        <div className="inv-card__header"><h2>Roster</h2></div>
        {manage && (
          <div className="inv-toolbar">
            <div className="inv-field">
              <label htmlFor="sh-target">Assign {selected.length} selected to</label>
              <select id="sh-target" value={target} onChange={(event) => setTarget(event.target.value)}>
                <option value="">Choose shift</option>
                {shifts.filter((shift) => shift.status === "ACTIVE").map((shift) => <option key={shift.id} value={shift.id}>{shift.code} {shift.name}</option>)}
                <option value="none">No shift</option>
              </select>
            </div>
            <div className="inv-field"><Button variant="primary" loading={busy} disabled={!selected.length || !target} onClick={assign}>Assign</Button></div>
          </div>
        )}
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        {roster.length === 0 ? <p className="inv-state">No active employees.</p> : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr>{manage && <th><input type="checkbox" aria-label="Select all" checked={selected.length === roster.length} onChange={(event) => setSelected(event.target.checked ? roster.map((row) => row.id) : [])} /></th>}<th>Employee</th><th>Department</th><th>Shift</th></tr></thead>
              <tbody>
                {roster.map((row) => (
                  <tr key={row.id}>
                    {manage && <td><input type="checkbox" aria-label={`Select ${row.name}`} checked={selected.includes(row.id)} onChange={(event) => setSelected((current) => (event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id)))} /></td>}
                    <td data-label="Employee"><strong>{row.name}</strong><small>{row.employeeCode}</small></td>
                    <td data-label="Department">{row.department}</td>
                    <td data-label="Shift">{row.shiftCode || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && <ShiftDialog shift={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); result.reload(); }} />}
    </main>
  );
}
