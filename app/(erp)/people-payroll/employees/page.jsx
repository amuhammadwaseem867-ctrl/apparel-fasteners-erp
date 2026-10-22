"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import InventoryPager from "@/components/inventory/InventoryPager";
import { EMPLOYMENT_TYPES, PAY_BASIS } from "@/components/people/peopleUi";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import { formatAmount } from "@/lib/formatters/formatters";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

function EmployeeDialog({ employee, departments, onClose, onSaved }) {
  const editing = Boolean(employee);
  const [values, setValues] = useState({
    employeeCode: employee?.employeeCode ?? "",
    name: employee?.name ?? "",
    fatherName: employee?.fatherName ?? "",
    nationalId: employee?.nationalId ?? "",
    phone: employee?.phone ?? "",
    address: employee?.address ?? "",
    departmentId: employee?.departmentId ?? "",
    designation: employee?.designation ?? "",
    employmentType: employee?.employmentType ?? "PERMANENT",
    joinDate: employee?.joinDate ?? "",
    leftDate: employee?.leftDate ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const { employeeCode, leftDate, ...rest } = values;
      onSaved(editing
        ? await apiRequest(`/api/hr/employees/${employee.id}`, { method: "PUT", body: JSON.stringify({ ...rest, leftDate }) })
        : await apiRequest("/api/hr/employees", { method: "POST", body: JSON.stringify({ ...rest, employeeCode }) }));
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  const field = (id, label, key, props = {}) => (
    <div className="inv-field"><label htmlFor={id}>{label}</label><input id={id} value={values[key]} onChange={set(key)} {...props} /></div>
  );

  return (
    <Modal open onClose={saving ? undefined : onClose} title={editing ? `Edit ${employee.name}` : "New employee"} description="Personal and job details. Pay is set separately by payroll." size="large">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          {field("em-code", "Employee code *", "employeeCode", { required: true, minLength: 2, maxLength: 30, disabled: editing })}
          {field("em-name", "Name *", "name", { required: true, minLength: 2, maxLength: 120 })}
          {field("em-father", "Father's name", "fatherName", { maxLength: 120 })}
          {field("em-cnic", "National ID", "nationalId", { maxLength: 40 })}
          {field("em-phone", "Phone", "phone", { maxLength: 40 })}
          <div className="inv-field">
            <label htmlFor="em-dept">Department *</label>
            <select id="em-dept" required value={values.departmentId} onChange={set("departmentId")}>
              <option value="">Select department</option>
              {departments.filter((item) => item.status === "ACTIVE" || item.id === values.departmentId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          {field("em-designation", "Designation *", "designation", { required: true, minLength: 2, maxLength: 80 })}
          <div className="inv-field">
            <label htmlFor="em-type">Employment type *</label>
            <select id="em-type" value={values.employmentType} onChange={set("employmentType")}>
              {Object.entries(EMPLOYMENT_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          {field("em-join", "Joining date *", "joinDate", { type: "date", required: true })}
          {editing && field("em-left", "Leaving date", "leftDate", { type: "date", min: values.joinDate })}
        </div>
        {field("em-address", "Address", "address", { maxLength: 300 })}
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>{editing ? "Save" : "Add employee"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function PayDialog({ employee, onClose, onSaved }) {
  const [values, setValues] = useState({
    payBasis: employee.payBasis,
    basicSalary: employee.basicSalary,
    allowances: employee.allowances,
    overtimeRate: employee.overtimeRate,
    fixedDeduction: employee.fixedDeduction,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      onSaved(await apiRequest(`/api/hr/employees/${employee.id}/pay`, {
        method: "PUT",
        body: JSON.stringify({
          payBasis: values.payBasis,
          basicSalary: Number(values.basicSalary),
          allowances: Number(values.allowances),
          overtimeRate: Number(values.overtimeRate),
          fixedDeduction: Number(values.fixedDeduction),
        }),
      }));
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  const money = (id, label, key, hint) => (
    <div className="inv-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" min="0" step="0.01" required value={values[key]} onChange={set(key)} />
      {hint && <small className="inv-field__hint">{hint}</small>}
    </div>
  );

  return (
    <Modal open onClose={saving ? undefined : onClose} title={`Pay for ${employee.name}`} description="Applies to payroll runs calculated from now on. Every change is audited with the old and new values." size="medium">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-field">
          <label htmlFor="pay-basis">Pay basis</label>
          <select id="pay-basis" value={values.payBasis} onChange={set("payBasis")}>
            {Object.entries(PAY_BASIS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="inv-dialog__grid">
          {money("pay-basic", values.payBasis === "MONTHLY" ? "Monthly basic salary" : "Daily rate", "basicSalary")}
          {money("pay-allow", "Monthly allowances", "allowances", "Prorated by paid days.")}
          {money("pay-ot", "Overtime rate per hour", "overtimeRate")}
          {money("pay-ded", "Fixed monthly deduction", "fixedDeduction", "e.g. tax withheld as advised; no rates are built in.")}
        </div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>Save pay</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function EmployeesPage() {
  const { can } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState("");
  const employees = useApiData(`/api/hr/employees${toQuery({ search, departmentId, status, page, pageSize: 25 })}`);
  const departments = useApiData("/api/hr/departments");
  const departmentList = departments.data?.departments ?? [];
  const rows = employees.data?.employees ?? [];
  const showPay = can("payroll:view");

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">People &amp; Payroll</p>
          <h1>Employees</h1>
          <p>Employee records. Pay rates are visible only to payroll staff and changed only by them.</p>
        </div>
        <div className="inv-header__actions">
          {can("hr:manage") && <Button variant="primary" disabled={!departments.data} onClick={() => setDialog({ type: "edit", employee: null })}>New employee</Button>}
        </div>
      </header>
      {notice && <p className="inv-state" role="status">{notice}</p>}
      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field"><label htmlFor="em-search">Search</label><input id="em-search" type="search" placeholder="Name, code or designation" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
          <div className="inv-field">
            <label htmlFor="em-fdept">Department</label>
            <select id="em-fdept" value={departmentId} onChange={(event) => { setDepartmentId(event.target.value); setPage(1); }}>
              <option value="">All</option>
              {departmentList.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <div className="inv-field">
            <label htmlFor="em-status">Status</label>
            <select id="em-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="ACTIVE">Active</option><option value="LEFT">Left</option><option value="">All</option>
            </select>
          </div>
        </div>
        {employees.error ? (
          <p className="inv-state inv-state--error" role="alert">{employees.error}</p>
        ) : !employees.data ? (
          <p className="inv-state" role="status">Loading employeesâ€¦</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">{search || departmentId ? "No employees match these filters." : "No employees yet. Add departments first, then employees."}</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Employee</th><th>Department</th><th>Type</th><th>Joined</th>
                  {showPay && <><th>Pay basis</th><th className="inv-num">Basic / rate</th><th className="inv-num">Allowances</th></>}
                  <th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Employee"><strong>{row.name}</strong><small>{row.employeeCode} · {row.designation}</small></td>
                    <td data-label="Department">{row.departmentName}</td>
                    <td data-label="Type">{EMPLOYMENT_TYPES[row.employmentType]}</td>
                    <td data-label="Joined">{row.joinDate}{row.leftDate && <small>left {row.leftDate}</small>}</td>
                    {showPay && <>
                      <td data-label="Pay basis">{PAY_BASIS[row.payBasis]}</td>
                      <td data-label="Basic / rate" className={`inv-num ${Number(row.basicSalary) === 0 ? "inv-neg" : ""}`}>{Number(row.basicSalary) === 0 ? "Not set" : formatAmount(row.basicSalary)}</td>
                      <td data-label="Allowances" className="inv-num">{formatAmount(row.allowances)}</td>
                    </>}
                    <td data-label="Status"><span className={`inv-badge inv-badge--${row.status === "ACTIVE" ? "good" : "danger"}`}>{row.status === "ACTIVE" ? "Active" : "Left"}</span></td>
                    <td data-label="Actions">
                      {can("hr:manage") && <button type="button" className="inv-text-button" onClick={() => setDialog({ type: "edit", employee: row })}>Edit</button>}{" "}
                      {can("payroll:process") && showPay && <button type="button" className="inv-text-button" onClick={() => setDialog({ type: "pay", employee: row })}>Pay</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={employees.data?.hasMore} onChange={setPage} disabled={employees.loading} />
      </section>
      {dialog?.type === "edit" && (
        <EmployeeDialog employee={dialog.employee} departments={departmentList} onClose={() => setDialog(null)}
          onSaved={(saved) => { setDialog(null); setNotice(`${saved.name} saved.`); employees.reload(); }} />
      )}
      {dialog?.type === "pay" && (
        <PayDialog employee={dialog.employee} onClose={() => setDialog(null)}
          onSaved={(saved) => { setDialog(null); setNotice(`Pay for ${saved.name} saved.`); employees.reload(); }} />
      )}
    </main>
  );
}

