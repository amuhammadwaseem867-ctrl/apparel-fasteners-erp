"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

export default function DepartmentsPage() {
  const { can } = useCurrentUser();
  const departments = useApiData("/api/hr/departments");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rows = departments.data?.departments ?? [];

  async function create(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest("/api/hr/departments", { method: "POST", body: JSON.stringify({ code, name }) });
      setCode("");
      setName("");
      departments.reload();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  async function update(row, patch) {
    setError("");
    try {
      await apiRequest(`/api/hr/departments/${row.id}`, { method: "PUT", body: JSON.stringify({ name: row.name, status: row.status, ...patch }) });
      departments.reload();
    } catch (cause) {
      setError(cause.message);
    }
  }

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">People &amp; Payroll</p>
          <h1>Departments</h1>
          <p>Departments group employees for attendance and payroll. Inactive departments cannot receive new employees.</p>
        </div>
      </header>
      {error && <p className="inv-dialog__error" role="alert">{error}</p>}
      {can("hr:manage") && (
        <section className="inv-card">
          <form className="inv-toolbar" onSubmit={create}>
            <div className="inv-field"><label htmlFor="dp-code">Code *</label><input id="dp-code" required pattern="[A-Z0-9\-]{2,20}" title="Capital letters, digits or dashes" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} /></div>
            <div className="inv-field"><label htmlFor="dp-name">Name *</label><input id="dp-name" required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></div>
            <Button type="submit" variant="primary" loading={busy}>Add department</Button>
          </form>
        </section>
      )}
      <section className="inv-card">
        {departments.error ? (
          <p className="inv-state inv-state--error" role="alert">{departments.error}</p>
        ) : !departments.data ? (
          <p className="inv-state" role="status">Loading departments…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">No departments yet.</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Code</th><th>Name</th><th className="inv-num">Active employees</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Code"><strong>{row.code}</strong></td>
                    <td data-label="Name">{row.name}</td>
                    <td data-label="Active employees" className="inv-num">{row.activeEmployees}</td>
                    <td data-label="Status"><span className={`inv-badge inv-badge--${row.status === "ACTIVE" ? "good" : "danger"}`}>{row.status === "ACTIVE" ? "Active" : "Inactive"}</span></td>
                    <td data-label="Actions">
                      {can("hr:manage") && (
                        <>
                          <button type="button" className="inv-text-button" onClick={() => { const next = window.prompt("Department name", row.name); if (next?.trim()) update(row, { name: next.trim() }); }}>Rename</button>{" "}
                          <button type="button" className="inv-text-button" onClick={() => update(row, { status: row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}>{row.status === "ACTIVE" ? "Deactivate" : "Activate"}</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
