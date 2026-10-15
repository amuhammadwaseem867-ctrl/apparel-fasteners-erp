"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import InventoryPager from "@/components/inventory/InventoryPager";
import { LinesEditor, ProcStatusBadge, SupplierSelect, emptyLine, formatAmount, linesPayload, linesValid, newKey, today } from "@/components/procurement/procurementUi";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

function NewOrderDialog({ onClose, onCreated }) {
  const suppliers = useApiData("/api/procurement/suppliers?status=ACTIVE&pageSize=200");
  const [supplierId, setSupplierId] = useState("");
  const [orderDate, setOrderDate] = useState(today);
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState(() => [emptyLine(true)]);
  const [key] = useState(newKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const valid = supplierId && linesValid(lines, true);

  async function submit(event) {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      onCreated(await apiRequest("/api/procurement/purchase-orders", {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: key, supplierId, orderDate, expectedDate, notes, lines: linesPayload(lines, true) }),
      }));
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title="New purchase order" description="Created as a draft. Totals are computed exactly on the server; approve the PO before receiving goods." size="large">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          <SupplierSelect id="npo-supplier" suppliers={suppliers.data?.suppliers ?? []} value={supplierId} onChange={setSupplierId} />
          <div className="inv-field"><label htmlFor="npo-date">Order date *</label><input id="npo-date" type="date" required value={orderDate} onChange={(event) => setOrderDate(event.target.value)} /></div>
          <div className="inv-field"><label htmlFor="npo-expected">Expected delivery</label><input id="npo-expected" type="date" min={orderDate} value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} /></div>
        </div>
        <LinesEditor lines={lines} onChange={setLines} withPrice idPrefix="npo" />
        <div className="inv-field"><label htmlFor="npo-notes">Notes / terms</label><textarea id="npo-notes" rows={2} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!valid}>Create draft PO</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function PurchaseOrdersClient({ initialStatus = "" }) {
  const router = useRouter();
  const { can } = useCurrentUser();
  const [status, setStatus] = useState(initialStatus);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const list = useApiData(`/api/procurement/purchase-orders${toQuery({ status, search, page, pageSize: 25 })}`);
  const rows = list.data?.purchaseOrders ?? [];
  const todayIso = today();

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/procurement">Procurement</Link></p>
          <h1>Purchase orders</h1>
          <p>Draft → approved → partly received → received. Orders with nothing received can be cancelled; partly received ones are closed short with a reason.</p>
        </div>
        <div className="inv-header__actions">{can("purchasing:create") && <Button variant="primary" onClick={() => setCreating(true)}>New purchase order</Button>}</div>
      </header>
      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field"><label htmlFor="po-search">Search</label><input id="po-search" type="search" placeholder="PO number or supplier" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
          <div className="inv-field">
            <label htmlFor="po-status">Status</label>
            <select id="po-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="OPEN">Open (to receive)</option>
              {["DRAFT", "APPROVED", "PARTIALLY_RECEIVED", "RECEIVED", "CLOSED", "CANCELLED"].map((value) => <option key={value} value={value}>{value.charAt(0) + value.slice(1).toLowerCase().replace("_", " ")}</option>)}
            </select>
          </div>
        </div>
        {list.error ? (
          <p className="inv-state inv-state--error" role="alert">{list.error}</p>
        ) : !list.data ? (
          <p className="inv-state" role="status">Loading purchase orders…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">{status || search ? "No purchase orders match these filters." : "No purchase orders yet."}</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>PO</th><th>Supplier</th><th>Expected</th><th className="inv-num">Received</th><th className="inv-num">Total</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((row) => {
                  const late = ["APPROVED", "PARTIALLY_RECEIVED"].includes(row.status) && row.expectedDate && row.expectedDate < todayIso;
                  return (
                    <tr key={row.id}>
                      <td data-label="PO"><Link href={`/procurement/purchase-orders/${row.id}`}><strong>{row.poNumber}</strong></Link><small>{row.orderDate}</small></td>
                      <td data-label="Supplier">{row.supplierName}</td>
                      <td data-label="Expected">{row.expectedDate || "—"}{late && <small className="inv-neg">Late</small>}</td>
                      <td data-label="Received" className="inv-num">{row.received} / {row.ordered}</td>
                      <td data-label="Total" className="inv-num">{formatAmount(row.totalAmount)}</td>
                      <td data-label="Status"><ProcStatusBadge status={row.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={list.data?.hasMore} onChange={setPage} disabled={list.loading} />
      </section>
      {creating && <NewOrderDialog onClose={() => setCreating(false)} onCreated={(order) => router.push(`/procurement/purchase-orders/${order.id}`)} />}
    </main>
  );
}
