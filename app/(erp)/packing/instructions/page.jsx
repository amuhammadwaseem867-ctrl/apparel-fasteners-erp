"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ItemPicker from "@/components/inventory/ItemPicker";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

function InstructionDialog({ instruction, onClose, onSaved }) {
  const customers = useApiData(instruction ? null : "/api/customers?page=1&pageSize=100");
  const [item, setItem] = useState(null);
  const [values, setValues] = useState({
    customerId: "", packType: instruction?.packType ?? "Polybag", unitsPerPack: instruction?.unitsPerPack ?? "", packsPerCarton: String(instruction?.packsPerCarton ?? ""),
    cartonType: instruction?.cartonType ?? "", labelling: instruction?.labelling ?? "", instructions: instruction?.instructions ?? "", status: instruction?.status ?? "ACTIVE",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    const body = { packType: values.packType, unitsPerPack: Number(values.unitsPerPack), packsPerCarton: Number(values.packsPerCarton), cartonType: values.cartonType, labelling: values.labelling, instructions: values.instructions };
    try {
      await apiRequest(instruction ? `/api/packing/instructions/${instruction.id}` : "/api/packing/instructions", {
        method: instruction ? "PATCH" : "POST",
        body: JSON.stringify(instruction ? { ...body, status: values.status } : { ...body, productId: item?.id, customerId: values.customerId || undefined }),
      });
      onSaved();
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title={instruction ? `Packing for ${instruction.sku}${instruction.customerName ? ` · ${instruction.customerName}` : ""}` : "New packing instruction"} description="A customer-specific instruction overrides the item's default." size="large">
      <form className="inv-dialog" onSubmit={submit}>
        {!instruction && (
          <div className="inv-dialog__grid">
            <ItemPicker label="Item" value={item} onChange={setItem} required />
            <div className="inv-field">
              <label htmlFor="pi-cust">Customer</label>
              <select id="pi-cust" value={values.customerId} onChange={set("customerId")}>
                <option value="">All customers (default)</option>
                {(customers.data?.customers ?? []).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
            </div>
          </div>
        )}
        <div className="inv-dialog__grid">
          <div className="inv-field"><label htmlFor="pi-type">Pack type *</label><input id="pi-type" required minLength={2} maxLength={60} list="pi-types" value={values.packType} onChange={set("packType")} /><datalist id="pi-types"><option value="Polybag" /><option value="Box" /><option value="Bundle" /><option value="Card" /><option value="Roll" /></datalist></div>
          <div className="inv-field"><label htmlFor="pi-units">Units per pack *</label><input id="pi-units" type="number" min="0" step="any" required value={values.unitsPerPack} onChange={set("unitsPerPack")} /></div>
          <div className="inv-field"><label htmlFor="pi-packs">Packs per carton *</label><input id="pi-packs" type="number" min="1" step="1" required value={values.packsPerCarton} onChange={set("packsPerCarton")} /></div>
          <div className="inv-field"><label htmlFor="pi-carton">Carton</label><input id="pi-carton" maxLength={80} placeholder="e.g. 5-ply 40Ã—30Ã—30" value={values.cartonType} onChange={set("cartonType")} /></div>
          {instruction && <div className="inv-field"><label htmlFor="pi-status">Status</label><select id="pi-status" value={values.status} onChange={set("status")}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div>}
        </div>
        <div className="inv-field"><label htmlFor="pi-label">Labelling</label><input id="pi-label" maxLength={500} placeholder="Label content, barcode, language" value={values.labelling} onChange={set("labelling")} /></div>
        <div className="inv-field"><label htmlFor="pi-notes">Instructions</label><textarea id="pi-notes" rows={3} maxLength={2000} value={values.instructions} onChange={set("instructions")} /></div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!instruction && !item}>Save instruction</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function PackingInstructionsPage() {
  const { can } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [editing, setEditing] = useState(null);
  const result = useApiData(`/api/packing/instructions${toQuery({ search, status })}`);
  const rows = result.data?.instructions ?? [];

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/packing">Packing</Link></p>
          <h1>Packing instructions</h1>
          <p>How each item is packed: pack type, units per pack, packs per carton, carton and labelling, by default or for a specific customer. One active instruction per item and customer.</p>
        </div>
        <div className="inv-header__actions">{can("production:update") && <Button variant="primary" onClick={() => setEditing("new")}>New instruction</Button>}</div>
      </header>
      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field"><label htmlFor="pi-search">Item SKU</label><input id="pi-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <div className="inv-field"><label htmlFor="pi-statusf">Status</label><select id="pi-statusf" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="">All</option></select></div>
        </div>
        {result.error ? <p className="inv-state inv-state--error" role="alert">{result.error}</p> : !result.data ? <p className="inv-state" role="status">Loadingâ€¦</p> : rows.length === 0 ? <p className="inv-state">No packing instructions{search ? " match" : " yet"}.</p> : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Item</th><th>Customer</th><th>Packing</th><th className="inv-num">Per carton</th><th>Labelling</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Item"><strong>{row.sku}</strong><small>{row.productName}</small></td>
                    <td data-label="Customer">{row.customerName ?? "Default"}</td>
                    <td data-label="Packing">{row.unitsPerPack} {row.unit} per {row.packType.toLowerCase()} · {row.packsPerCarton} per carton{row.cartonType ? <small>{row.cartonType}</small> : null}</td>
                    <td data-label="Per carton" className="inv-num">{row.unitsPerCarton} {row.unit}</td>
                    <td data-label="Labelling">{row.labelling || "â€”"}{row.instructions ? <small>{row.instructions}</small> : null}</td>
                    <td data-label="Status">{row.status === "ACTIVE" ? <span className="inv-badge inv-badge--good">Active</span> : <span className="inv-badge inv-badge--danger">Inactive</span>}</td>
                    <td data-label="">{can("production:update") && <button type="button" className="inv-link-button" onClick={() => setEditing(row)}>Edit</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && <InstructionDialog instruction={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); result.reload(); }} />}
    </main>
  );
}

