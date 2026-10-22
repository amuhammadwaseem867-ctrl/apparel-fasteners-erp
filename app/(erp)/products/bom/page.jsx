"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import InventoryPager from "@/components/inventory/InventoryPager";
import ItemPicker from "@/components/inventory/ItemPicker";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";
import { apiRequest } from "@/lib/api/client";

import "@/components/inventory/InventoryWorkspace.css";

function statusBadge(bom) {
  if (bom.isActive) return <span className="inv-badge inv-badge--good">ACTIVE</span>;
  const tone = bom.status === "APPROVED" ? "warning" : bom.status === "OBSOLETE" ? "danger" : "";
  return <span className={`inv-badge ${tone ? `inv-badge--${tone}` : ""}`}>{bom.status}</span>;
}

function newLine() {
  return { key: globalThis.crypto?.randomUUID?.() ?? String(Math.random()), item: null, quantity: "", scrapPercent: "0", notes: "" };
}

/* Creates a BOM (new item) or edits a DRAFT revision. */
function BomEditor({ bom, onClose, onSaved }) {
  const editing = Boolean(bom);
  const [parent, setParent] = useState(bom ? { id: bom.productId, sku: bom.sku, name: bom.productName, unit: bom.unit } : null);
  const [lines, setLines] = useState(() => bom
    ? bom.lines.map((line) => ({ key: line.id, item: { id: line.componentId, sku: line.sku, name: line.productName, unit: line.unit }, quantity: line.quantity, scrapPercent: line.scrapPercent, notes: line.notes ?? "" }))
    : [newLine()]);
  const [notes, setNotes] = useState(bom?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(key, patch) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
    setError("");
  }

  const ready = parent && lines.length > 0 && lines.every((line) => line.item && Number(line.quantity) > 0);

  async function submit(event) {
    event.preventDefault();
    if (saving || !ready) return;
    setSaving(true);
    setError("");
    const body = {
      notes,
      lines: lines.map((line) => ({
        componentId: line.item.id,
        quantity: Number(line.quantity),
        scrapPercent: Number(line.scrapPercent || 0),
        notes: line.notes,
      })),
    };
    try {
      const saved = editing
        ? await apiRequest(`/api/planning/boms/${bom.id}`, { method: "PUT", body: JSON.stringify(body) })
        : await apiRequest("/api/planning/boms", { method: "POST", body: JSON.stringify({ ...body, productId: parent.id }) });
      onSaved(saved);
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={saving ? undefined : onClose}
      title={editing ? `Edit ${bom.sku} revision ${bom.revision}` : "New bill of materials"}
      description="Quantities are per ONE unit of the parent item, in each component's unit. Scrap % is added once to that line's requirement."
      size="large"
    >
      <form className="inv-dialog" onSubmit={submit}>
        <ItemPicker label="Parent item (what is made)" required value={parent} onChange={setParent} disabled={editing} />
        {lines.map((line, index) => (
          <fieldset key={line.key} className="inv-dialog__line">
            <legend>Component {index + 1}</legend>
            <ItemPicker required value={line.item} onChange={(item) => update(line.key, { item })} label="Component" />
            <div className="inv-field">
              <label htmlFor={`q-${line.key}`}>Quantity per parent unit *{line.item ? ` (${line.item.unit})` : ""}</label>
              <input id={`q-${line.key}`} type="number" step="any" min="0.000001" required value={line.quantity} onChange={(event) => update(line.key, { quantity: event.target.value })} />
            </div>
            <div className="inv-field">
              <label htmlFor={`s-${line.key}`}>Scrap %</label>
              <input id={`s-${line.key}`} type="number" step="any" min="0" max="99.999" value={line.scrapPercent} onChange={(event) => update(line.key, { scrapPercent: event.target.value })} />
            </div>
            <div className="inv-field">
              <label htmlFor={`n-${line.key}`}>Notes</label>
              <input id={`n-${line.key}`} maxLength={500} value={line.notes} onChange={(event) => update(line.key, { notes: event.target.value })} />
            </div>
            {lines.length > 1 && (
              <button type="button" className="inv-text-button" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}>Remove component</button>
            )}
          </fieldset>
        ))}
        <button type="button" className="inv-text-button" onClick={() => setLines((current) => [...current, newLine()])}>+ Add component</button>
        <div className="inv-field">
          <label htmlFor="bom-notes">Notes</label>
          <textarea id="bom-notes" rows={2} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!ready}>{editing ? "Save draft" : "Create draft"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function BomDetail({ id, onChanged, onEdit }) {
  const bom = useApiData(`/api/planning/boms/${id}`);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function act(action) {
    if (busy) return;
    const confirmText = {
      approve: "Approve this revision? Approved BOMs can no longer be edited.",
      activate: "Make this the active BOM used by MRP? The current active revision will be deactivated.",
      obsolete: "Mark this revision obsolete? It will no longer be used.",
    }[action];
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(action);
    setError("");
    try {
      const result = await apiRequest(`/api/planning/boms/${id}`, { method: "PATCH", body: JSON.stringify({ action }) });
      onChanged(action === "revise" ? result.id : id);
      bom.reload();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy("");
    }
  }

  if (bom.error) return <p className="inv-dialog__error" role="alert">{bom.error}</p>;
  if (!bom.data) return <p className="inv-state" role="status">Loading BOMâ€¦</p>;
  const data = bom.data;

  return (
    <section className="inv-card">
      <div className="inv-card__header">
        <div>
          <h2>{data.sku} · revision {data.revision} {statusBadge(data)}</h2>
          <small>{data.productName}{data.notes ? ` · ${data.notes}` : ""}</small>
        </div>
        <div className="inv-header__actions">
          {data.status === "DRAFT" && <Button variant="secondary" onClick={() => onEdit(data)}>Edit</Button>}
          {data.status === "DRAFT" && <Button variant="primary" loading={busy === "approve"} onClick={() => act("approve")}>Approve</Button>}
          {data.status === "APPROVED" && !data.isActive && <Button variant="primary" loading={busy === "activate"} onClick={() => act("activate")}>Activate</Button>}
          {data.status !== "DRAFT" && <Button variant="secondary" loading={busy === "revise"} onClick={() => act("revise")}>New revision</Button>}
          {data.status === "APPROVED" && <Button variant="secondary" loading={busy === "obsolete"} onClick={() => act("obsolete")}>Make obsolete</Button>}
        </div>
      </div>
      {error && <p className="inv-state inv-state--error" role="alert">{error}</p>}
      <div className="inv-table-wrap">
        <table className="inv-table">
          <thead><tr><th className="inv-num">#</th><th>Component</th><th className="inv-num">Qty per unit</th><th className="inv-num">Scrap %</th><th>Notes</th></tr></thead>
          <tbody>
            {data.lines.map((line) => (
              <tr key={line.id}>
                <td data-label="#" className="inv-num">{line.lineNo}</td>
                <td data-label="Component"><strong>{line.sku}</strong><small>{line.productName}</small></td>
                <td data-label="Qty per unit" className="inv-num">{line.quantity} {line.unit}</td>
                <td data-label="Scrap %" className="inv-num">{line.scrapPercent}</td>
                <td data-label="Notes">{line.notes || "â€”"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function BomPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [editor, setEditor] = useState(null);
  const [version, setVersion] = useState(0);
  const boms = useApiData(`/api/planning/boms${toQuery({ status, page, pageSize: 25 })}`);
  const rows = boms.data?.boms ?? [];

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Products</p>
          <h1>Bills of Materials</h1>
          <p>Component structures with revisions and approval. Only drafts can be edited; MRP uses each item&apos;s single active revision. Cycles are refused.</p>
        </div>
        <div className="inv-header__actions">
          <Button variant="primary" onClick={() => setEditor({ bom: null })}>New BOM</Button>
        </div>
      </header>

      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field">
            <label htmlFor="bom-status">Status</label>
            <select id="bom-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="DRAFT">Draft</option>
              <option value="APPROVED">Approved</option>
              <option value="OBSOLETE">Obsolete</option>
            </select>
          </div>
        </div>
        {boms.error ? (
          <p className="inv-state inv-state--error" role="alert">{boms.error}</p>
        ) : !boms.data ? (
          <p className="inv-state" role="status">Loading BOMsâ€¦</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">{status ? "No BOMs with this status." : "No bills of materials yet."}</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Item</th><th className="inv-num">Revision</th><th className="inv-num">Components</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Item"><strong>{row.sku}</strong><small>{row.productName}</small></td>
                    <td data-label="Revision" className="inv-num">{row.revision}</td>
                    <td data-label="Components" className="inv-num">{row.lineCount}</td>
                    <td data-label="Status">{statusBadge(row)}</td>
                    <td data-label="Open"><button type="button" className="inv-text-button" onClick={() => setSelected(row.id)}>{selected === row.id ? "Showing" : "Open"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={boms.data?.hasMore} onChange={setPage} disabled={boms.loading} />
      </section>

      {selected && (
        <BomDetail
          key={`${selected}-${version}`}
          id={selected}
          onEdit={(bom) => setEditor({ bom })}
          onChanged={(id) => { setSelected(id); setVersion((current) => current + 1); boms.reload(); }}
        />
      )}

      {editor && (
        <BomEditor
          bom={editor.bom}
          onClose={() => setEditor(null)}
          onSaved={(saved) => { setEditor(null); setSelected(saved.id); setVersion((current) => current + 1); boms.reload(); }}
        />
      )}
    </main>
  );
}

