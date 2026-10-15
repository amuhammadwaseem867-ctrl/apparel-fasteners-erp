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

function NewRfqDialog({ onClose, onCreated }) {
  const approved = useApiData("/api/procurement/requisitions?status=APPROVED&pageSize=100");
  const [requisitionId, setRequisitionId] = useState("");
  const [lines, setLines] = useState(() => [emptyLine(false)]);
  const [responseDue, setResponseDue] = useState("");
  const [notes, setNotes] = useState("");
  const [key] = useState(newKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const valid = requisitionId || linesValid(lines);

  async function submit(event) {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      onCreated(await apiRequest("/api/procurement/rfqs", {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: key, requisitionId: requisitionId || undefined, responseDue, notes, lines: requisitionId ? [] : linesPayload(lines) }),
      }));
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title="New request for quotation" description="Record each supplier's quote against the RFQ, compare them, then award one to raise a draft PO." size="large">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-field">
          <label htmlFor="rfq-req">Approved requisition</label>
          <select id="rfq-req" value={requisitionId} onChange={(event) => setRequisitionId(event.target.value)}>
            <option value="">None: enter items</option>
            {(approved.data?.requisitions ?? []).map((row) => <option key={row.id} value={row.id}>{row.requisitionNumber} · {row.lineCount} lines</option>)}
          </select>
        </div>
        {!requisitionId && <LinesEditor lines={lines} onChange={setLines} idPrefix="rfq" />}
        <div className="inv-dialog__grid">
          <div className="inv-field"><label htmlFor="rfq-due">Quotes due</label><input id="rfq-due" type="date" value={responseDue} onChange={(event) => setResponseDue(event.target.value)} /></div>
        </div>
        <div className="inv-field"><label htmlFor="rfq-notes">Notes</label><textarea id="rfq-notes" rows={2} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!valid}>Create RFQ</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function RfqsClient({ initialStatus = "" }) {
  const router = useRouter();
  const { can } = useCurrentUser();
  const [status, setStatus] = useState(initialStatus);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const list = useApiData(`/api/procurement/rfqs${toQuery({ status, search, page, pageSize: 25 })}`);
  const rows = list.data?.rfqs ?? [];

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/procurement">Procurement</Link></p>
          <h1>Requests for quotation</h1>
          <p>Supplier quotes compared side by side; awarding one raises a draft purchase order at the quoted prices.</p>
        </div>
        <div className="inv-header__actions">{can("purchasing:create") && <Button variant="primary" onClick={() => setCreating(true)}>New RFQ</Button>}</div>
      </header>
      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field"><label htmlFor="rfq-search">Search</label><input id="rfq-search" type="search" placeholder="RFQ number" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
          <div className="inv-field">
            <label htmlFor="rfq-status">Status</label>
            <select id="rfq-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">All</option><option value="OPEN">Open</option><option value="AWARDED">Awarded</option><option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
        {list.error ? (
          <p className="inv-state inv-state--error" role="alert">{list.error}</p>
        ) : !list.data ? (
          <p className="inv-state" role="status">Loading RFQs…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">{status || search ? "No RFQs match these filters." : "No RFQs yet."}</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>RFQ</th><th>Quotes due</th><th className="inv-num">Quotes</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="RFQ"><Link href={`/procurement/rfqs/${row.id}`}><strong>{row.rfqNumber}</strong></Link><small>{row.createdAt?.slice(0, 10)}</small></td>
                    <td data-label="Quotes due">{row.responseDue || "—"}</td>
                    <td data-label="Quotes" className="inv-num">{row.quoteCount}</td>
                    <td data-label="Status"><ProcStatusBadge status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={list.data?.hasMore} onChange={setPage} disabled={list.loading} />
      </section>
      {creating && <NewRfqDialog onClose={() => setCreating(false)} onCreated={(rfq) => router.push(`/procurement/rfqs/${rfq.id}`)} />}
    </main>
  );
}
