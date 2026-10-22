"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import InventoryPager from "@/components/inventory/InventoryPager";
import { ProcStatusBadge } from "@/components/procurement/procurementUi";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const FIELDS = [
  ["name", "Name *", "text", 160],
  ["contactName", "Contact person", "text", 120],
  ["phone", "Phone", "tel", 40],
  ["email", "Email", "email", 200],
  ["taxRegistration", "Tax registration (NTN/STRN)", "text", 60],
];

function SupplierDialog({ supplier, onClose, onSaved }) {
  const [values, setValues] = useState(() => ({
    code: supplier?.code ?? "", name: supplier?.name ?? "", contactName: supplier?.contactName ?? "", phone: supplier?.phone ?? "",
    email: supplier?.email ?? "", address: supplier?.address ?? "", taxRegistration: supplier?.taxRegistration ?? "",
    paymentTermsDays: String(supplier?.paymentTermsDays ?? 30), notes: supplier?.notes ?? "", status: supplier?.status ?? "ACTIVE",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    const { code, status, ...rest } = values;
    const body = { ...rest, paymentTermsDays: Number(values.paymentTermsDays) };
    try {
      await apiRequest(supplier ? `/api/procurement/suppliers/${supplier.id}` : "/api/procurement/suppliers", {
        method: supplier ? "PATCH" : "POST",
        body: JSON.stringify(supplier ? { ...body, status } : { ...body, code: code.toUpperCase() }),
      });
      onSaved();
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title={supplier ? `Edit ${supplier.code}` : "New supplier"} size="large">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          {!supplier && (
            <div className="inv-field"><label htmlFor="su-code">Code *</label><input id="su-code" required pattern="[A-Za-z0-9\-]{2,20}" maxLength={20} value={values.code} onChange={set("code")} /></div>
          )}
          {FIELDS.map(([field, label, type, max]) => (
            <div className="inv-field" key={field}><label htmlFor={`su-${field}`}>{label}</label><input id={`su-${field}`} type={type} required={field === "name"} maxLength={max} value={values[field]} onChange={set(field)} /></div>
          ))}
          <div className="inv-field"><label htmlFor="su-terms">Payment terms (days) *</label><input id="su-terms" type="number" min="0" max="365" step="1" required value={values.paymentTermsDays} onChange={set("paymentTermsDays")} /></div>
          {supplier && (
            <div className="inv-field">
              <label htmlFor="su-status">Status</label>
              <select id="su-status" value={values.status} onChange={set("status")}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>
            </div>
          )}
        </div>
        <div className="inv-field"><label htmlFor="su-address">Address</label><textarea id="su-address" rows={2} maxLength={300} value={values.address} onChange={set("address")} /></div>
        <div className="inv-field"><label htmlFor="su-notes">Notes</label><textarea id="su-notes" rows={2} maxLength={1000} value={values.notes} onChange={set("notes")} /></div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>{supplier ? "Save supplier" : "Create supplier"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function SuppliersPage() {
  const { can } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const suppliers = useApiData(`/api/procurement/suppliers${toQuery({ search, status, page, pageSize: 25 })}`);
  const rows = suppliers.data?.suppliers ?? [];

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Procurement</p>
          <h1>Suppliers</h1>
          <p>Vendors you buy from. Payment terms set the default due date on their bills. Suppliers are deactivated, never deleted, once they have history.</p>
        </div>
        <div className="inv-header__actions">
          {can("purchasing:create") && <Button variant="primary" onClick={() => setEditing("new")}>New supplier</Button>}
        </div>
      </header>
      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field"><label htmlFor="su-search">Search</label><input id="su-search" type="search" placeholder="Code, name or contact" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
          <div className="inv-field">
            <label htmlFor="su-filter">Status</label>
            <select id="su-filter" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">All</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>
        {suppliers.error ? (
          <p className="inv-state inv-state--error" role="alert">{suppliers.error}</p>
        ) : !suppliers.data ? (
          <p className="inv-state" role="status">Loading suppliers…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">{search || status ? "No suppliers match these filters." : "No suppliers yet."}</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Supplier</th><th>Contact</th><th>Tax reg.</th><th className="inv-num">Terms</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Supplier"><strong>{row.name}</strong><small>{row.code}</small></td>
                    <td data-label="Contact">{row.contactName || "—"}<small>{[row.phone, row.email].filter(Boolean).join(" · ")}</small></td>
                    <td data-label="Tax reg.">{row.taxRegistration || "—"}</td>
                    <td data-label="Terms" className="inv-num">{row.paymentTermsDays} days</td>
                    <td data-label="Status"><ProcStatusBadge status={row.status} /></td>
                    <td data-label="">{can("purchasing:create") && <button type="button" className="inv-link-button" onClick={() => setEditing(row)}>Edit</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={suppliers.data?.hasMore} onChange={setPage} disabled={suppliers.loading} />
      </section>
      {editing && <SupplierDialog supplier={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); suppliers.reload(); }} />}
    </main>
  );
}

