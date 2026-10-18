"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";
import { apiRequest } from "@/lib/api/client";

import "@/components/inventory/InventoryWorkspace.css";

const TYPES = [
  ["GENERAL", "General"],
  ["RAW_MATERIAL", "Raw material"],
  ["WIP", "Work in progress"],
  ["FINISHED_GOODS", "Finished goods"],
  ["QUARANTINE", "Quarantine"],
  ["SCRAP", "Scrap"],
];
const TYPE_LABEL = Object.fromEntries(TYPES);

function statusBadge(status) {
  const tone = status === "ACTIVE" ? "good" : status === "ARCHIVED" ? "danger" : "warning";
  return <span className={`inv-badge inv-badge--${tone}`}>{status}</span>;
}

function WarehouseForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ code: "", name: "", warehouseType: "GENERAL", address: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest("/api/inventory/warehouses", { method: "POST", body: JSON.stringify(form) });
      onSaved();
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title="New warehouse" size="medium">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          <div className="inv-field">
            <label htmlFor="wh-code">Code *</label>
            <input id="wh-code" required maxLength={30} pattern="[A-Za-z0-9._\-]+" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
          </div>
          <div className="inv-field">
            <label htmlFor="wh-name">Name *</label>
            <input id="wh-name" required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </div>
          <div className="inv-field">
            <label htmlFor="wh-type">Type *</label>
            <select id="wh-type" value={form.warehouseType} onChange={(event) => setForm({ ...form, warehouseType: event.target.value })}>
              {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>
        <div className="inv-field">
          <label htmlFor="wh-address">Address</label>
          <textarea id="wh-address" rows={2} maxLength={500} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
        </div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>Create warehouse</Button>
        </div>
      </form>
    </Modal>
  );
}

/*
 * Locations are shelf / row / column places (requirements 1.2): code
 * S1-R2-C3, name "Shelf 1, Row 2, Column 3". A whole shelf can be laid out
 * at once; codes that already exist are skipped. Other places (receiving
 * area, tape room) keep a free code and name.
 */
const GRID_CODE = /^S([A-Za-z0-9]+)-R([A-Za-z0-9]+)-C([A-Za-z0-9]+)$/;
const gridCode = (shelf, row, column) => `S${shelf}-R${row}-C${column}`;
const gridName = (shelf, row, column) => `Shelf ${shelf}, Row ${row}, Column ${column}`;
const PART = "[A-Za-z0-9]{1,6}";

function Locations({ warehouse }) {
  const locations = useApiData(`/api/inventory/locations${toQuery({ warehouseId: warehouse.id })}`);
  const [mode, setMode] = useState("place");
  const [grid, setGrid] = useState({ shelf: "", row: "", column: "", rows: "", columns: "" });
  const [form, setForm] = useState({ code: "", name: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const setGridField = (field) => (event) => setGrid((current) => ({ ...current, [field]: event.target.value.trim() }));

  function planned() {
    if (mode === "other") return [form];
    if (mode === "place") return [{ code: gridCode(grid.shelf, grid.row, grid.column), name: gridName(grid.shelf, grid.row, grid.column) }];
    const out = [];
    for (let row = 1; row <= Number(grid.rows); row += 1) {
      for (let column = 1; column <= Number(grid.columns); column += 1) out.push({ code: gridCode(grid.shelf, row, column), name: gridName(grid.shelf, row, column) });
    }
    return out;
  }

  async function add(event) {
    event.preventDefault();
    if (saving) return;
    const existing = new Set((locations.data ?? []).map((location) => location.code.toUpperCase()));
    const todo = planned().filter((item) => !existing.has(item.code.toUpperCase()));
    if (todo.length === 0) {
      setError("Those locations already exist.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    let made = 0;
    try {
      for (const item of todo) {
        await apiRequest("/api/inventory/locations", { method: "POST", body: JSON.stringify({ warehouseId: warehouse.id, ...item }) });
        made += 1;
      }
      setForm({ code: "", name: "" });
      setGrid((current) => ({ ...current, row: "", column: "" }));
      setNotice(`${made} location${made === 1 ? "" : "s"} added.`);
    } catch (cause) {
      setError(made ? `${made} added, then: ${cause.message}` : cause.message);
    } finally {
      setSaving(false);
      locations.reload();
    }
  }

  async function setStatus(location, status) {
    if (status === "ARCHIVED" && !window.confirm(`Archive location ${location.code}? It must hold no stock.`)) return;
    setError("");
    try {
      await apiRequest(`/api/inventory/locations/${location.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      locations.reload();
    } catch (cause) {
      setError(cause.message);
    }
  }

  const bulkCount = Number(grid.rows) * Number(grid.columns) || 0;

  return (
    <div className="inv-locations">
      {locations.error && <p className="inv-state inv-state--error" role="alert">{locations.error}</p>}
      {(locations.data ?? []).length > 0 && (
        <table className="inv-table">
          <thead><tr><th>Location</th><th>Shelf</th><th>Row</th><th>Column</th><th>Name</th><th>Status</th><th /></tr></thead>
          <tbody>
            {locations.data.map((location) => {
              const [, shelf = "", row = "", column = ""] = location.code.match(GRID_CODE) ?? [];
              return (
                <tr key={location.id}>
                  <td data-label="Location"><strong>{warehouse.code}/{location.code}</strong></td>
                  <td data-label="Shelf">{shelf || "—"}</td>
                  <td data-label="Row">{row || "—"}</td>
                  <td data-label="Column">{column || "—"}</td>
                  <td data-label="Name">{location.name}</td>
                  <td data-label="Status">{statusBadge(location.status)}</td>
                  <td data-label="Actions">
                    {location.status === "ACTIVE" ? (
                      <button type="button" className="inv-text-button" onClick={() => setStatus(location, "ARCHIVED")}>Archive</button>
                    ) : (
                      <button type="button" className="inv-text-button" onClick={() => setStatus(location, "ACTIVE")}>Reactivate</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {warehouse.status === "ACTIVE" ? (
        <form className="inv-toolbar" onSubmit={add}>
          <div className="inv-field">
            <label htmlFor={`loc-mode-${warehouse.id}`}>Add</label>
            <select id={`loc-mode-${warehouse.id}`} value={mode} onChange={(event) => { setMode(event.target.value); setError(""); setNotice(""); }}>
              <option value="place">One shelf place</option>
              <option value="shelf">A whole shelf (all rows × columns)</option>
              <option value="other">Other place (e.g. receiving area)</option>
            </select>
          </div>
          {mode !== "other" && (
            <div className="inv-field">
              <label htmlFor={`loc-shelf-${warehouse.id}`}>Shelf *</label>
              <input id={`loc-shelf-${warehouse.id}`} required pattern={PART} maxLength={6} placeholder="1 or A" value={grid.shelf} onChange={setGridField("shelf")} />
            </div>
          )}
          {mode === "place" && (
            <>
              <div className="inv-field"><label htmlFor={`loc-row-${warehouse.id}`}>Row *</label><input id={`loc-row-${warehouse.id}`} required pattern={PART} maxLength={6} value={grid.row} onChange={setGridField("row")} /></div>
              <div className="inv-field"><label htmlFor={`loc-col-${warehouse.id}`}>Column *</label><input id={`loc-col-${warehouse.id}`} required pattern={PART} maxLength={6} value={grid.column} onChange={setGridField("column")} /></div>
            </>
          )}
          {mode === "shelf" && (
            <>
              <div className="inv-field"><label htmlFor={`loc-rows-${warehouse.id}`}>Rows *</label><input id={`loc-rows-${warehouse.id}`} required type="number" min="1" max="50" value={grid.rows} onChange={setGridField("rows")} /></div>
              <div className="inv-field"><label htmlFor={`loc-cols-${warehouse.id}`}>Columns *</label><input id={`loc-cols-${warehouse.id}`} required type="number" min="1" max="50" value={grid.columns} onChange={setGridField("columns")} /></div>
            </>
          )}
          {mode === "other" && (
            <>
              <div className="inv-field">
                <label htmlFor={`loc-code-${warehouse.id}`}>Code *</label>
                <input id={`loc-code-${warehouse.id}`} required maxLength={30} pattern="[A-Za-z0-9._\-]+" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
              </div>
              <div className="inv-field">
                <label htmlFor={`loc-name-${warehouse.id}`}>Name *</label>
                <input id={`loc-name-${warehouse.id}`} required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </div>
            </>
          )}
          <Button type="submit" variant="secondary" loading={saving} disabled={mode === "shelf" && (bulkCount < 1 || bulkCount > 500)}>
            {mode === "shelf" ? `Add ${bulkCount || ""} locations` : "Add location"}
          </Button>
        </form>
      ) : (
        <p className="inv-state">Reactivate the warehouse to add locations.</p>
      )}
      {notice && <p className="inv-field__hint" role="status">{notice}</p>}
      {error && <p className="inv-state inv-state--error" role="alert">{error}</p>}
    </div>
  );
}

export default function WarehousesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [error, setError] = useState("");
  const warehouses = useApiData(`/api/inventory/warehouses${toQuery({ search, status })}`);
  const rows = warehouses.data ?? [];

  async function changeStatus(warehouse, next) {
    if (next === "ARCHIVED" && !window.confirm(`Archive warehouse ${warehouse.code}? It must hold no stock.`)) return;
    setError("");
    try {
      await apiRequest(`/api/inventory/warehouses/${warehouse.id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      warehouses.reload();
    } catch (cause) {
      setError(cause.message);
    }
  }

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Inventory</p>
          <h1>Warehouses &amp; Locations</h1>
          <p>Raw material, work in process and finished goods warehouses, each laid out in shelves, rows and columns. A location holding stock cannot be archived; adjust the stock out first.</p>
        </div>
        <div className="inv-header__actions">
          <Button variant="primary" onClick={() => setCreating(true)}>New warehouse</Button>
        </div>
      </header>

      {error && <p className="inv-dialog__error" role="alert">{error}</p>}

      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field">
            <label htmlFor="wh-search">Search</label>
            <input id="wh-search" type="search" value={search} placeholder="Code or name" onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="inv-field">
            <label htmlFor="wh-status">Status</label>
            <select id="wh-status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Active and inactive</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>

        {warehouses.error ? (
          <p className="inv-state inv-state--error" role="alert">{warehouses.error}</p>
        ) : warehouses.loading && !warehouses.data ? (
          <p className="inv-state" role="status">Loading warehouses…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">{search || status ? "No warehouses match these filters." : "No warehouses yet. Create one to start receiving stock."}</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr><th>Code</th><th>Name</th><th>Type</th><th className="inv-num">Locations</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((warehouse) => [
                  <tr key={warehouse.id}>
                    <td data-label="Code"><strong>{warehouse.code}</strong></td>
                    <td data-label="Name">{warehouse.name}{warehouse.address && <small>{warehouse.address}</small>}</td>
                    <td data-label="Type">{TYPE_LABEL[warehouse.warehouseType] ?? warehouse.warehouseType}</td>
                    <td data-label="Locations" className="inv-num">{warehouse.locationCount}</td>
                    <td data-label="Status">{statusBadge(warehouse.status)}</td>
                    <td data-label="Actions">
                      <button
                        type="button"
                        className="inv-text-button"
                        aria-expanded={expanded === warehouse.id}
                        onClick={() => setExpanded(expanded === warehouse.id ? null : warehouse.id)}
                      >
                        {expanded === warehouse.id ? "Hide locations" : "Locations"}
                      </button>{" "}
                      {warehouse.status === "ACTIVE" && (
                        <button type="button" className="inv-text-button" onClick={() => changeStatus(warehouse, "INACTIVE")}>Deactivate</button>
                      )}
                      {warehouse.status === "INACTIVE" && (
                        <>
                          <button type="button" className="inv-text-button" onClick={() => changeStatus(warehouse, "ACTIVE")}>Activate</button>{" "}
                          <button type="button" className="inv-text-button" onClick={() => changeStatus(warehouse, "ARCHIVED")}>Archive</button>
                        </>
                      )}
                      {warehouse.status === "ARCHIVED" && (
                        <button type="button" className="inv-text-button" onClick={() => changeStatus(warehouse, "INACTIVE")}>Restore</button>
                      )}
                    </td>
                  </tr>,
                  expanded === warehouse.id && (
                    <tr key={`${warehouse.id}-locations`}>
                      <td colSpan={6}><Locations warehouse={warehouse} /></td>
                    </tr>
                  ),
                ])}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {creating && (
        <WarehouseForm
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); warehouses.reload(); }}
        />
      )}
    </main>
  );
}
