"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { newKey, today } from "@/components/people/peopleUi";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import { formatAmount } from "@/lib/formatters/formatters";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

function AdvanceDialog({ onClose, onSaved }) {
  const employees = useApiData("/api/hr/employees?status=ACTIVE&pageSize=200");
  const [values, setValues] = useState({ employeeId: "", issueDate: today(), amount: "", installment: "", reason: "" });
  const [key] = useState(newKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      onSaved(await apiRequest("/api/payroll/advances", { method: "POST", body: JSON.stringify({ ...values, idempotencyKey: key, amount: Number(values.amount), installment: Number(values.installment) }) }));
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title="Issue salary advance" description="Recovered from each payroll by the instalment (or less, so net pay is never negative) until repaid." size="medium">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-field">
          <label htmlFor="ad-emp">Employee *</label>
          <select id="ad-emp" required value={values.employeeId} onChange={set("employeeId")}>
            <option value="">Select employee</option>
            {(employees.data?.employees ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.employeeCode}</option>)}
          </select>
        </div>
        <div className="inv-dialog__grid">
          <div className="inv-field"><label htmlFor="ad-date">Issue date *</label><input id="ad-date" type="date" required value={values.issueDate} onChange={set("issueDate")} /></div>
          <div className="inv-field"><label htmlFor="ad-amount">Amount *</label><input id="ad-amount" type="number" min="0.01" step="0.01" required value={values.amount} onChange={set("amount")} /></div>
          <div className="inv-field"><label htmlFor="ad-inst">Instalment per payroll *</label><input id="ad-inst" type="number" min="0.01" step="0.01" max={values.amount || undefined} required value={values.installment} onChange={set("installment")} /></div>
        </div>
        <div className="inv-field"><label htmlFor="ad-reason">Reason *</label><input id="ad-reason" required minLength={3} maxLength={300} value={values.reason} onChange={set("reason")} /></div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>Issue advance</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdvancesPage() {
  const { can } = useCurrentUser();
  const [status, setStatus] = useState("OPEN");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const advances = useApiData(`/api/payroll/advances${toQuery({ status })}`);
  const rows = advances.data?.advances ?? [];

  async function cancel(advance) {
    if (!window.confirm(`Cancel ${advance.advanceNumber}? Only possible before anything is recovered.`)) return;
    setError("");
    try {
      await apiRequest(`/api/payroll/advances/${advance.id}`, { method: "PATCH" });
      advances.reload();
    } catch (cause) {
      setError(cause.message);
    }
  }

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">People &amp; Payroll</p>
          <h1>Salary Advances</h1>
          <p>Advances are recovered automatically when a payroll run is approved, oldest first. Loans with interest are not supported.</p>
        </div>
        <div className="inv-header__actions">{can("payroll:process") && <Button variant="primary" onClick={() => setCreating(true)}>Issue advance</Button>}</div>
      </header>
      {error && <p className="inv-dialog__error" role="alert">{error}</p>}
      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field">
            <label htmlFor="ad-status">Status</label>
            <select id="ad-status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="OPEN">Open</option><option value="CLOSED">Repaid</option><option value="CANCELLED">Cancelled</option><option value="">All</option>
            </select>
          </div>
        </div>
        {advances.error ? (
          <p className="inv-state inv-state--error" role="alert">{advances.error}</p>
        ) : !advances.data ? (
          <p className="inv-state" role="status">Loading advances…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">No advances with this status.</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Advance</th><th>Employee</th><th>Issued</th><th className="inv-num">Amount</th><th className="inv-num">Instalment</th><th className="inv-num">Recovered</th><th className="inv-num">Remaining</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Advance"><strong>{row.advanceNumber}</strong><small>{row.reason}</small></td>
                    <td data-label="Employee">{row.employeeName}<small>{row.employeeCode}</small></td>
                    <td data-label="Issued">{row.issueDate}</td>
                    <td data-label="Amount" className="inv-num">{formatAmount(row.amount)}</td>
                    <td data-label="Instalment" className="inv-num">{formatAmount(row.installment)}</td>
                    <td data-label="Recovered" className="inv-num">{formatAmount(row.recovered)}</td>
                    <td data-label="Remaining" className="inv-num"><strong>{formatAmount(row.remaining)}</strong></td>
                    <td data-label="Status"><span className={`inv-badge inv-badge--${row.status === "CLOSED" ? "good" : row.status === "CANCELLED" ? "danger" : "warning"}`}>{{ OPEN: "Open", CLOSED: "Repaid", CANCELLED: "Cancelled" }[row.status]}</span></td>
                    <td data-label="Actions">{can("payroll:process") && row.status === "OPEN" && Number(row.recovered) === 0 && <button type="button" className="inv-text-button" onClick={() => cancel(row)}>Cancel</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {creating && <AdvanceDialog onClose={() => setCreating(false)} onSaved={() => { setCreating(false); setStatus("OPEN"); advances.reload(); }} />}
    </main>
  );
}
