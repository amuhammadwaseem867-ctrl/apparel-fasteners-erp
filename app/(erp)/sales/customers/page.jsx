"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import InventoryPager from "@/components/inventory/InventoryPager";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

/* Customer details, exactly as the requirements list them (1.2, section 7). */
const FIELDS = [
  ["name", "Customer name *", "text", 180],
  ["address", "Customer address", "text", 300],
  ["contactPerson", "Contact person name", "text", 120],
  ["phone", "Contact no", "tel", 60],
  ["email", "Email", "email", 254],
];

function CustomerDialog({ customer, onClose, onSaved }) {
  const [values, setValues] = useState(() => Object.fromEntries(
    [...FIELDS.map(([field]) => field), "ntn", "strn"].map((field) => [field, customer?.[field] ?? ""]),
  ));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest(customer ? `/api/customers/${customer.id}` : "/api/customers", {
        method: customer ? "PATCH" : "POST",
        body: JSON.stringify(values),
      });
      onSaved();
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title={customer ? `Edit ${customer.name}` : "New customer"} size="large">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          {FIELDS.map(([field, label, type, max]) => (
            <div className="inv-field" key={field}>
              <label htmlFor={`cu-${field}`}>{label}</label>
              <input id={`cu-${field}`} type={type} required={field === "name"} maxLength={max} value={values[field]} onChange={set(field)} />
            </div>
          ))}
        </div>
        <details className="inv-details">
          <summary>Tax details for the sales tax invoice (optional)</summary>
          <div className="inv-dialog__grid">
            <div className="inv-field"><label htmlFor="cu-ntn">NTN #</label><input id="cu-ntn" maxLength={40} value={values.ntn} onChange={set("ntn")} /></div>
            <div className="inv-field"><label htmlFor="cu-strn">STRN #</label><input id="cu-strn" maxLength={40} value={values.strn} onChange={set("strn")} /></div>
          </div>
        </details>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>{customer ? "Save customer" : "Add customer"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function CustomersPage() {
  const { can } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const customers = useApiData(`/api/customers${toQuery({ search, page, pageSize: 25 })}`);
  const rows = customers.data?.customers ?? [];

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">1. Orders</p>
          <h1>Customers</h1>
          <p>The people you make zippers for. Pick a customer when you place an order.</p>
        </div>
        <div className="inv-header__actions">
          {can("customers:create") && <Button variant="primary" onClick={() => setEditing("new")}>New customer</Button>}
        </div>
      </header>
      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field"><label htmlFor="cu-search">Search</label><input id="cu-search" type="search" placeholder="Name, code or email" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
        </div>
        {customers.error ? (
          <p className="inv-state inv-state--error" role="alert">{customers.error}</p>
        ) : !customers.data ? (
          <p className="inv-state" role="status">Loading customers…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">{search ? "No customers match this search." : "No customers yet. Add the first one."}</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Customer</th><th>Address</th><th>Contact person</th><th>Contact no</th><th>Email</th><th /></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Customer"><strong>{row.name}</strong><small>{row.code}</small></td>
                    <td data-label="Address">{row.address || "—"}</td>
                    <td data-label="Contact person">{row.contactPerson || "—"}</td>
                    <td data-label="Contact no">{row.phone || "—"}</td>
                    <td data-label="Email">{row.email || "—"}</td>
                    <td data-label="">{can("customers:update") && <button type="button" className="inv-link-button" onClick={() => setEditing(row)}>Edit</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={customers.data?.hasMore} onChange={setPage} disabled={customers.loading} />
      </section>
      {editing && <CustomerDialog customer={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); customers.reload(); }} />}
    </main>
  );
}
