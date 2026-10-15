"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

function CategoryDialog({ category, onClose, onSaved }) {
  const [values, setValues] = useState({ name: category?.name ?? "", description: category?.description ?? "", status: category?.status ?? "ACTIVE" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const editing = Boolean(category?.id);

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await apiRequest(editing ? `/api/products/categories/${category.id}` : "/api/products/categories", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(editing ? values : { name: values.name, description: values.description }),
      });
      onSaved(result);
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title={editing ? `Edit ${category.name}` : category ? `Register ${category.name}` : "New category"} description={editing ? "Renaming also renames the category on every item that uses it." : ""} size="medium">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-field"><label htmlFor="pc-name">Name *</label><input id="pc-name" required minLength={2} maxLength={80} value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} /></div>
        <div className="inv-field"><label htmlFor="pc-desc">Description</label><input id="pc-desc" maxLength={300} value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} /></div>
        {editing && <div className="inv-field"><label htmlFor="pc-status">Status</label><select id="pc-status" value={values.status} onChange={(event) => setValues({ ...values, status: event.target.value })}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div>}
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function CategoriesPage() {
  const { can } = useCurrentUser();
  const result = useApiData("/api/products/categories");
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState("");
  const rows = result.data?.categories ?? [];

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/products">Products</Link></p>
          <h1>Product categories</h1>
          <p>Every category used by an item, with item counts. Register a category to describe it, rename it everywhere, or mark it inactive.</p>
        </div>
        <div className="inv-header__actions">{can("products:update") && <Button variant="primary" onClick={() => setEditing({})}>New category</Button>}</div>
      </header>
      {notice && <p className="inv-field__hint" role="status">{notice}</p>}
      <section className="inv-card">
        {result.error ? <p className="inv-state inv-state--error" role="alert">{result.error}</p> : !result.data ? <p className="inv-state" role="status">Loading categories…</p> : rows.length === 0 ? <p className="inv-state">No categories yet.</p> : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Category</th><th className="inv-num">Items</th><th className="inv-num">Active items</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id || row.name}>
                    <td data-label="Category"><Link href={`/products?search=${encodeURIComponent(row.name)}`}><strong>{row.name}</strong></Link><small>{row.description || (row.registered ? "" : "Used by items, not registered")}</small></td>
                    <td data-label="Items" className="inv-num">{row.products}</td>
                    <td data-label="Active items" className="inv-num">{row.activeProducts}</td>
                    <td data-label="Status">{!row.registered ? <span className="inv-badge inv-badge--warning">Unregistered</span> : row.status === "ACTIVE" ? <span className="inv-badge inv-badge--good">Active</span> : <span className="inv-badge inv-badge--danger">Inactive</span>}</td>
                    <td data-label="">{can("products:update") && <button type="button" className="inv-link-button" onClick={() => setEditing(row)}>{row.registered ? "Edit" : "Register"}</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && <CategoryDialog category={editing.name ? editing : null} onClose={() => setEditing(null)} onSaved={(saved) => { setEditing(null); setNotice(saved?.productsRenamed ? `Renamed on ${saved.productsRenamed} items.` : ""); result.reload(); }} />}
    </main>
  );
}
