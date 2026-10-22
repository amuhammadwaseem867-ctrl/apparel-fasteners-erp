"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import { ATTENDANCE, today } from "@/components/people/peopleUi";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

/*
 * One day's attendance sheet. Unsaved edits live only in this form until
 * "Save attendance"; the server upserts one record per employee per day
 * and refuses once the month's payroll is approved.
 */
export default function AttendancePage() {
  const { can } = useCurrentUser();
  const [date, setDate] = useState(today);
  const [departmentId, setDepartmentId] = useState("");
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const departments = useApiData("/api/hr/departments");
  const employees = useApiData(`/api/hr/employees${toQuery({ status: "", departmentId, pageSize: 200 })}`);
  const attendance = useApiData(`/api/hr/attendance${toQuery({ date })}`);
  const saved = new Map((attendance.data?.records ?? []).map((record) => [record.employeeId, record]));
  const lockedBy = attendance.data?.lockedBy;
  const rows = (employees.data?.employees ?? []).filter((employee) => employee.joinDate <= date && (!employee.leftDate || employee.leftDate >= date));
  const editable = can("hr:manage") && !lockedBy;

  const current = (employee) => edits[employee.id] ?? {
    status: saved.get(employee.id)?.status ?? "",
    overtimeHours: saved.get(employee.id)?.overtimeHours ?? "0",
    remarks: saved.get(employee.id)?.remarks ?? "",
  };
  const change = (employee, patch) => {
    setEdits((all) => ({ ...all, [employee.id]: { ...current(employee), ...patch } }));
    setNotice("");
  };
  const pending = rows.filter((employee) => edits[employee.id]?.status);

  function changeDate(value) {
    setDate(value);
    setEdits({});
    setNotice("");
    setError("");
  }

  async function save() {
    if (saving || !pending.length) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest("/api/hr/attendance", {
        method: "POST",
        body: JSON.stringify({
          date,
          records: pending.map((employee) => ({ employeeId: employee.id, status: edits[employee.id].status, overtimeHours: Number(edits[employee.id].overtimeHours || 0), remarks: edits[employee.id].remarks ?? "" })),
        }),
      });
      setNotice(`Saved attendance for ${pending.length} ${pending.length === 1 ? "employee" : "employees"} on ${date}.`);
      setEdits({});
      attendance.reload();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSaving(false);
    }
  }

  const recorded = rows.filter((employee) => saved.has(employee.id)).length;

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">People &amp; Payroll</p>
          <h1>Attendance</h1>
          <p>Daily attendance and overtime. Monthly staff are paid for days without a record (shown on payroll as unrecorded); daily-wage workers only for recorded work.</p>
        </div>
        <div className="inv-header__actions">
          {editable && <Button variant="secondary" disabled={!rows.length} onClick={() => setEdits(Object.fromEntries(rows.map((employee) => [employee.id, { ...current(employee), status: current(employee).status || "PRESENT" }])))}>Mark unmarked present</Button>}
          {editable && <Button variant="primary" loading={saving} disabled={!pending.length} onClick={save}>Save attendance{pending.length ? ` (${pending.length})` : ""}</Button>}
        </div>
      </header>
      {lockedBy && <p className="inv-state inv-state--error" role="status">Attendance for {date.slice(0, 7)} is locked: payroll {lockedBy} has been approved.</p>}
      {error && <p className="inv-dialog__error" role="alert">{error}</p>}
      {notice && <p className="inv-state" role="status">{notice}</p>}
      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field"><label htmlFor="at-date">Date</label><input id="at-date" type="date" value={date} onChange={(event) => changeDate(event.target.value)} /></div>
          <div className="inv-field">
            <label htmlFor="at-dept">Department</label>
            <select id="at-dept" value={departmentId} onChange={(event) => { setDepartmentId(event.target.value); setEdits({}); }}>
              <option value="">All</option>
              {(departments.data?.departments ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <p className="inv-field__hint" role="status">{recorded} of {rows.length} recorded</p>
        </div>
        {employees.error || attendance.error ? (
          <p className="inv-state inv-state--error" role="alert">{employees.error || attendance.error}</p>
        ) : !employees.data || !attendance.data ? (
          <p className="inv-state" role="status">Loading attendanceâ€¦</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">No employees were employed on this date.</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Employee</th><th>Status</th><th className="inv-num">Overtime hours</th><th>Remarks</th></tr></thead>
              <tbody>
                {rows.map((employee) => {
                  const value = current(employee);
                  return (
                    <tr key={employee.id}>
                      <td data-label="Employee"><strong>{employee.name}</strong><small>{employee.employeeCode} · {employee.departmentName}</small></td>
                      <td data-label="Status">
                        <select aria-label={`Attendance for ${employee.name}`} disabled={!editable} value={value.status} onChange={(event) => change(employee, { status: event.target.value })}>
                          <option value="">Not recorded</option>
                          {Object.entries(ATTENDANCE).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        </select>
                      </td>
                      <td data-label="Overtime hours" className="inv-num">
                        <input aria-label={`Overtime hours for ${employee.name}`} type="number" min="0" max="24" step="0.25" style={{ width: 90 }} disabled={!editable} value={value.overtimeHours} onChange={(event) => change(employee, { overtimeHours: event.target.value })} />
                      </td>
                      <td data-label="Remarks"><input aria-label={`Remarks for ${employee.name}`} maxLength={200} disabled={!editable} value={value.remarks ?? ""} onChange={(event) => change(employee, { remarks: event.target.value })} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

