"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import InventoryPager from "@/components/inventory/InventoryPager";
import { newKey, today } from "@/components/people/peopleUi";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const TONE = { PENDING: "warning", APPROVED: "good", REJECTED: "danger", CANCELLED: "danger" };

function RequestDialog({ types, onClose, onSaved }) {
  const employees = useApiData("/api/hr/employees?status=ACTIVE&pageSize=200");
  const [values, setValues] = useState({ employeeId: "", leaveTypeId: "", fromDate: today(), toDate: today(), reason: "" });
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
      await apiRequest("/api/hr/leave-requests", { method: "POST", body: JSON.stringify({ ...values, idempotencyKey: key }) });
      onSaved();
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title="New leave request" description="Company holidays in the range (Planning → Calendar) are not counted. Approval records the leave on attendance for payroll." size="medium">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          <div className="inv-field">
            <label htmlFor="lv-emp">Employee *</label>
            <select id="lv-emp" required value={values.employeeId} onChange={set("employeeId")}>
              <option value="">Select employee</option>
              {(employees.data?.employees ?? []).map((row) => <option key={row.id} value={row.id}>{row.employeeCode} · {row.name}</option>)}
            </select>
          </div>
          <div className="inv-field">
            <label htmlFor="lv-type">Leave type *</label>
            <select id="lv-type" required value={values.leaveTypeId} onChange={set("leaveTypeId")}>
              <option value="">Select type</option>
              {types.filter((type) => type.status === "ACTIVE").map((type) => <option key={type.id} value={type.id}>{type.name} ({type.paid ? "paid" : "unpaid"})</option>)}
            </select>
          </div>
          <div className="inv-field"><label htmlFor="lv-from">From *</label><input id="lv-from" type="date" required value={values.fromDate} onChange={set("fromDate")} /></div>
          <div className="inv-field"><label htmlFor="lv-to">To *</label><input id="lv-to" type="date" required min={values.fromDate} value={values.toDate} onChange={set("toDate")} /></div>
        </div>
        <div className="inv-field"><label htmlFor="lv-reason">Reason *</label><input id="lv-reason" required minLength={3} maxLength={500} value={values.reason} onChange={set("reason")} /></div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>Submit request</Button>
        </div>
      </form>
    </Modal>
  );
}

function TypeDialog({ type, onClose, onSaved }) {
  const [values, setValues] = useState({ code: "", name: type?.name ?? "", paid: type?.paid ?? true, annualDays: type?.annualDays ?? "0", status: type?.status ?? "ACTIVE" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest(type ? `/api/hr/leave-types/${type.id}` : "/api/hr/leave-types", {
        method: type ? "PATCH" : "POST",
        body: JSON.stringify(type ? { name: values.name, annualDays: Number(values.annualDays), status: values.status } : { code: values.code.toUpperCase(), name: values.name, paid: values.paid, annualDays: Number(values.annualDays) }),
      });
      onSaved();
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title={type ? `Edit ${type.code}` : "New leave type"} description="Annual days 0 means the type is not limited (balances are not tracked)." size="medium">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          {!type && <div className="inv-field"><label htmlFor="lt-code">Code *</label><input id="lt-code" required maxLength={12} value={values.code} onChange={(event) => setValues({ ...values, code: event.target.value })} /></div>}
          <div className="inv-field"><label htmlFor="lt-name">Name *</label><input id="lt-name" required minLength={2} maxLength={80} value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} /></div>
          <div className="inv-field"><label htmlFor="lt-days">Days per year</label><input id="lt-days" type="number" min="0" max="366" step="0.5" value={values.annualDays} onChange={(event) => setValues({ ...values, annualDays: event.target.value })} /></div>
          {!type && <div className="inv-field"><label htmlFor="lt-paid">Pay</label><select id="lt-paid" value={values.paid ? "yes" : "no"} onChange={(event) => setValues({ ...values, paid: event.target.value === "yes" })}><option value="yes">Paid</option><option value="no">Unpaid</option></select></div>}
          {type && <div className="inv-field"><label htmlFor="lt-status">Status</label><select id="lt-status" value={values.status} onChange={(event) => setValues({ ...values, status: event.target.value })}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div>}
        </div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function LeavePage() {
  const { can } = useCurrentUser();
  const manage = can("hr:manage");
  const [status, setStatus] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [year, setYear] = useState(() => Number(today().slice(0, 4)));
  const [dialog, setDialog] = useState(null);
  const [error, setError] = useState("");
  const types = useApiData("/api/hr/leave-types");
  const requests = useApiData(`/api/hr/leave-requests${toQuery({ status, page, pageSize: 50 })}`);
  const balances = useApiData(`/api/hr/leave-balances${toQuery({ year })}`);
  const rows = requests.data?.requests ?? [];

  async function act(row, action) {
    const note = window.prompt(action === "approve" ? "Note (optional)" : `Reason to ${action}?`);
    if (note === null || (action !== "approve" && !note)) return;
    setError("");
    try {
      await apiRequest(`/api/hr/leave-requests/${row.id}`, { method: "PATCH", body: JSON.stringify({ action, note }) });
      requests.reload();
      balances.reload();
    } catch (cause) {
      setError(cause.message);
    }
  }

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/people-payroll">People &amp; Payroll</Link></p>
          <h1>Leave</h1>
          <p>Requests, approvals and balances. Approved leave is written to attendance (paid or unpaid leave) and flows into payroll; once a month&apos;s payroll is approved its leave cannot change.</p>
        </div>
        <div className="inv-header__actions">
          {manage && <Button variant="primary" disabled={!types.data} onClick={() => setDialog({ kind: "request" })}>New request</Button>}
          {manage && <Button variant="secondary" onClick={() => setDialog({ kind: "type" })}>New leave type</Button>}
        </div>
      </header>
      {error && <p className="inv-dialog__error" role="alert">{error}</p>}
      <section className="inv-card">
        <div className="inv-card__header"><h2>Requests</h2></div>
        <div className="inv-toolbar">
          <div className="inv-field">
            <label htmlFor="lv-status">Status</label>
            <select id="lv-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="CANCELLED">Cancelled</option><option value="">All</option>
            </select>
          </div>
        </div>
        {requests.error ? <p className="inv-state inv-state--error" role="alert">{requests.error}</p> : !requests.data ? <p className="inv-state" role="status">Loading…</p> : rows.length === 0 ? <p className="inv-state">No requests.</p> : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Request</th><th>Employee</th><th>Type</th><th>Dates</th><th className="inv-num">Days</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Request"><strong>{row.requestNumber}</strong><small>{row.reason}</small></td>
                    <td data-label="Employee">{row.employeeName}<small>{row.employeeCode}</small></td>
                    <td data-label="Type">{row.leaveTypeName}<small>{row.paid ? "paid" : "unpaid"}</small></td>
                    <td data-label="Dates">{row.fromDate}{row.toDate !== row.fromDate ? ` → ${row.toDate}` : ""}</td>
                    <td data-label="Days" className="inv-num">{row.days}</td>
                    <td data-label="Status"><span className={`inv-badge inv-badge--${TONE[row.status]}`}>{row.status.charAt(0) + row.status.slice(1).toLowerCase()}</span>{row.decisionNote && <small>{row.decisionNote}</small>}</td>
                    <td data-label="">
                      {manage && row.status === "PENDING" && <><button type="button" className="inv-link-button" onClick={() => act(row, "approve")}>Approve</button> <button type="button" className="inv-link-button" onClick={() => act(row, "reject")}>Reject</button> </>}
                      {manage && ["PENDING", "APPROVED"].includes(row.status) && <button type="button" className="inv-link-button" onClick={() => act(row, "cancel")}>Cancel</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={requests.data?.hasMore} onChange={setPage} disabled={requests.loading} />
      </section>
      <section className="inv-card">
        <div className="inv-card__header"><h2>Balances</h2></div>
        <div className="inv-toolbar"><div className="inv-field"><label htmlFor="lv-year">Year</label><input id="lv-year" type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(Number(event.target.value) || year)} /></div></div>
        {balances.error ? <p className="inv-state inv-state--error" role="alert">{balances.error}</p> : !balances.data ? <p className="inv-state" role="status">Loading…</p> : balances.data.types.length === 0 ? <p className="inv-state">No leave type has an annual entitlement, so there are no balances to show.</p> : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Employee</th>{balances.data.types.map((type) => <th key={type.id} className="inv-num">{type.name} ({type.annualDays})</th>)}</tr></thead>
              <tbody>
                {balances.data.employees.map((employee) => (
                  <tr key={employee.id}>
                    <td data-label="Employee">{employee.name}<small>{employee.employeeCode}</small></td>
                    {employee.balances.map((balance, index) => (
                      <td key={balance.leaveTypeId} data-label={balances.data.types[index].name} className={`inv-num ${Number(balance.remaining) < 0 ? "inv-neg" : ""}`}>
                        {balance.remaining} left<small>{balance.used} used{Number(balance.pending) ? ` · ${balance.pending} pending` : ""}</small>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="inv-card">
        <div className="inv-card__header"><h2>Leave types</h2></div>
        {!types.data ? <p className="inv-state" role="status">Loading…</p> : types.data.leaveTypes.length === 0 ? <p className="inv-state">No leave types yet. Add the types your company uses (for example annual, sick, casual, unpaid).</p> : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Type</th><th>Pay</th><th className="inv-num">Days per year</th><th>Status</th><th /></tr></thead>
              <tbody>
                {types.data.leaveTypes.map((type) => (
                  <tr key={type.id}>
                    <td data-label="Type"><strong>{type.code}</strong> {type.name}</td>
                    <td data-label="Pay">{type.paid ? "Paid" : "Unpaid"}</td>
                    <td data-label="Days per year" className="inv-num">{Number(type.annualDays) ? type.annualDays : "Not limited"}</td>
                    <td data-label="Status">{type.status === "ACTIVE" ? "Active" : "Inactive"}</td>
                    <td data-label="">{manage && <button type="button" className="inv-link-button" onClick={() => setDialog({ kind: "type", type })}>Edit</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {dialog?.kind === "request" && <RequestDialog types={types.data?.leaveTypes ?? []} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); requests.reload(); balances.reload(); }} />}
      {dialog?.kind === "type" && <TypeDialog type={dialog.type} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); types.reload(); balances.reload(); }} />}
    </main>
  );
}
