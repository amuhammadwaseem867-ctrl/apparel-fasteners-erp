"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import InventoryPager from "@/components/inventory/InventoryPager";
import { LinesEditor, ProcStatusBadge, emptyLine, linesPayload, linesValid, newKey } from "@/components/procurement/procurementUi";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

function NewRequisitionDialog({ fromMrp, onClose, onCreated }) {
  const [mode, setMode] = useState(fromMrp ? "mrp" : "manual");
  const [lines, setLines] = useState(() => [emptyLine(false)]);
  const [picked, setPicked] = useState([]);
  const [neededBy, setNeededBy] = useState("");
  const [notes, setNotes] = useState("");
  const [key] = useState(newKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const suggestions = useApiData(mode === "mrp" ? "/api/procurement/buy-suggestions" : null);
  const rows = suggestions.data?.suggestions ?? [];
  const valid = mode === "mrp" ? picked.length > 0 : linesValid(lines);

  async function submit(event) {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      onCreated(await apiRequest("/api/procurement/requisitions", {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: key, neededBy, notes, lines: mode === "manual" ? linesPayload(lines) : [], plannedOrderIds: mode === "mrp" ? picked : [] }),
      }));
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title="New purchase requisition" description="A request to buy, approved before any quotation or order is raised." size="large">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-field">
          <label htmlFor="pr-mode">Source</label>
          <select id="pr-mode" value={mode} onChange={(event) => setMode(event.target.value)}>
            <option value="manual">Enter items</option>
            <option value="mrp">Confirmed MRP buy suggestions</option>
          </select>
        </div>
        {mode === "manual" ? (
          <LinesEditor lines={lines} onChange={setLines} idPrefix="pr" />
        ) : suggestions.error ? (
          <p className="inv-dialog__error" role="alert">{suggestions.error}</p>
        ) : !suggestions.data ? (
          <p className="inv-state" role="status">Loading suggestions…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">No confirmed MRP buy suggestions are waiting. Confirm BUY planned orders on the MRP page first.</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th /><th>Item</th><th className="inv-num">Quantity</th><th>Due</th><th>MRP run</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td><input type="checkbox" aria-label={`Include ${row.sku}`} checked={picked.includes(row.id)} onChange={(event) => setPicked((current) => (event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id)))} /></td>
                    <td data-label="Item"><strong>{row.sku}</strong><small>{row.productName}</small></td>
                    <td data-label="Quantity" className="inv-num">{row.quantity} {row.unit}</td>
                    <td data-label="Due">{row.dueDate ?? "—"}</td>
                    <td data-label="MRP run">{row.runNumber}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="inv-dialog__grid">
          <div className="inv-field"><label htmlFor="pr-needed">Needed by</label><input id="pr-needed" type="date" value={neededBy} onChange={(event) => setNeededBy(event.target.value)} /></div>
        </div>
        <div className="inv-field"><label htmlFor="pr-notes">Notes</label><textarea id="pr-notes" rows={2} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!valid}>Create requisition</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function RequisitionsClient({ initialStatus = "", openMrp = false }) {
  const router = useRouter();
  const { can } = useCurrentUser();
  const [status, setStatus] = useState(initialStatus);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(openMrp ? "mrp" : "");
  const list = useApiData(`/api/procurement/requisitions${toQuery({ status, search, page, pageSize: 25 })}`);
  const rows = list.data?.requisitions ?? [];
  const canCreate = can("purchasing:create") || can("production:update");

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/procurement">Procurement</Link></p>
          <h1>Purchase requisitions</h1>
          <p>Draft → submitted → approved, then quoted (RFQ) or ordered directly. Confirmed MRP buy suggestions can be requisitioned once.</p>
        </div>
        <div className="inv-header__actions">
          {canCreate && <Button variant="primary" onClick={() => setCreating("manual")}>New requisition</Button>}
        </div>
      </header>
      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field"><label htmlFor="pr-search">Search</label><input id="pr-search" type="search" placeholder="Requisition number" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
          <div className="inv-field">
            <label htmlFor="pr-status">Status</label>
            <select id="pr-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">All</option>
              {["DRAFT", "SUBMITTED", "APPROVED", "ORDERED", "REJECTED", "CANCELLED"].map((value) => <option key={value} value={value}>{value.charAt(0) + value.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
        </div>
        {list.error ? (
          <p className="inv-state inv-state--error" role="alert">{list.error}</p>
        ) : !list.data ? (
          <p className="inv-state" role="status">Loading requisitions…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">{status || search ? "No requisitions match these filters." : "No requisitions yet."}</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Requisition</th><th>Needed by</th><th className="inv-num">Lines</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Requisition"><Link href={`/procurement/requisitions/${row.id}`}><strong>{row.requisitionNumber}</strong></Link><small>{row.createdAt?.slice(0, 10)}</small></td>
                    <td data-label="Needed by">{row.neededBy || "—"}</td>
                    <td data-label="Lines" className="inv-num">{row.lineCount}</td>
                    <td data-label="Status"><ProcStatusBadge status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={list.data?.hasMore} onChange={setPage} disabled={list.loading} />
      </section>
      {creating && <NewRequisitionDialog fromMrp={creating === "mrp"} onClose={() => setCreating("")} onCreated={(created) => router.push(`/procurement/requisitions/${created.id}`)} />}
    </main>
  );
}
