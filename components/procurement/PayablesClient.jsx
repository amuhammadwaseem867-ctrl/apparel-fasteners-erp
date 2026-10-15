"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import InventoryPager from "@/components/inventory/InventoryPager";
import { ProcStatusBadge, SupplierSelect, formatAmount, newKey, today } from "@/components/procurement/procurementUi";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const BUCKET_LABELS = { current: "Not yet due", "1-30": "1–30 days", "31-60": "31–60 days", "61-90": "61–90 days", "90+": "Over 90 days" };

/*
 * Records a supplier's invoice. Against a PO, each line bills received,
 * not yet billed quantity (three-way match); otherwise lines are free text.
 */
function NewBillDialog({ onClose, onCreated }) {
  const suppliers = useApiData("/api/procurement/suppliers?pageSize=200");
  const [supplierId, setSupplierId] = useState("");
  const orders = useApiData(supplierId ? `/api/procurement/purchase-orders${toQuery({ supplierId, pageSize: 100 })}` : null);
  const [orderId, setOrderId] = useState("");
  const order = useApiData(orderId ? `/api/procurement/purchase-orders/${orderId}` : null);
  const [values, setValues] = useState({ supplierInvoiceNumber: "", billDate: today(), dueDate: "", notes: "" });
  const [quantities, setQuantities] = useState({});
  const [prices, setPrices] = useState({});
  const [free, setFree] = useState([{ key: newKey(), description: "", quantity: "1", unitPrice: "", taxPercent: "0" }]);
  const [key] = useState(newKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));
  const poLines = (order.data?.lines ?? []).map((line) => ({ ...line, billable: (Number(line.receivedQuantity) - Number(line.billedQuantity)).toString() }));
  const orderRows = (orders.data?.purchaseOrders ?? []).filter((row) => !["DRAFT", "CANCELLED"].includes(row.status));

  const lines = orderId
    ? poLines.filter((line) => Number(quantities[line.id] ?? 0) > 0).map((line) => ({ purchaseOrderLineId: line.id, quantity: Number(quantities[line.id]), ...(prices[line.id] ? { unitPrice: Number(prices[line.id]) } : {}) }))
    : free.filter((line) => line.description && Number(line.quantity) > 0 && line.unitPrice !== "").map((line) => ({ description: line.description, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice), taxPercent: Number(line.taxPercent || 0) }));
  const valid = supplierId && values.supplierInvoiceNumber.trim() && lines.length > 0;

  function pickOrder(id) {
    setOrderId(id);
    setQuantities({});
    setPrices({});
  }

  async function submit(event) {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      onCreated(await apiRequest("/api/procurement/bills", {
        method: "POST",
        body: JSON.stringify({ ...values, idempotencyKey: key, supplierId, purchaseOrderId: orderId || undefined, lines }),
      }));
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title="Record a supplier bill" description="Created as a draft. Approval checks the bill against goods received and the PO price." size="large">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          <SupplierSelect id="bl-supplier" suppliers={suppliers.data?.suppliers ?? []} value={supplierId} onChange={(id) => { setSupplierId(id); pickOrder(""); }} />
          <div className="inv-field">
            <label htmlFor="bl-po">Purchase order</label>
            <select id="bl-po" value={orderId} disabled={!supplierId} onChange={(event) => pickOrder(event.target.value)}>
              <option value="">None (service / expense bill)</option>
              {orderRows.map((row) => <option key={row.id} value={row.id}>{row.poNumber} · {row.status.toLowerCase().replace("_", " ")}</option>)}
            </select>
          </div>
          <div className="inv-field"><label htmlFor="bl-inv">Supplier invoice no. *</label><input id="bl-inv" required maxLength={60} value={values.supplierInvoiceNumber} onChange={set("supplierInvoiceNumber")} /></div>
          <div className="inv-field"><label htmlFor="bl-date">Bill date *</label><input id="bl-date" type="date" required value={values.billDate} onChange={set("billDate")} /></div>
          <div className="inv-field"><label htmlFor="bl-due">Due date</label><input id="bl-due" type="date" min={values.billDate} value={values.dueDate} onChange={set("dueDate")} /><small className="inv-field__hint">Blank: bill date + supplier terms</small></div>
        </div>
        {orderId ? (
          !order.data ? <p className="inv-state" role="status">Loading PO…</p> : (
            <div className="inv-table-wrap">
              <table className="inv-table">
                <thead><tr><th>Item</th><th className="inv-num">Ordered</th><th className="inv-num">Received</th><th className="inv-num">Billed</th><th className="inv-num">PO price</th><th>Bill qty</th><th>Bill price</th></tr></thead>
                <tbody>
                  {poLines.map((line) => (
                    <tr key={line.id}>
                      <td data-label="Item"><strong>{line.sku}</strong><small>{line.productName}</small></td>
                      <td data-label="Ordered" className="inv-num">{line.quantity}</td>
                      <td data-label="Received" className="inv-num">{line.receivedQuantity}</td>
                      <td data-label="Billed" className="inv-num">{line.billedQuantity}</td>
                      <td data-label="PO price" className="inv-num">{line.unitPrice}</td>
                      <td data-label="Bill qty"><input aria-label={`Bill quantity ${line.sku}`} type="number" min="0" max={line.billable} step="any" placeholder={`≤ ${line.billable}`} value={quantities[line.id] ?? ""} onChange={(event) => setQuantities((current) => ({ ...current, [line.id]: event.target.value }))} /></td>
                      <td data-label="Bill price"><input aria-label={`Bill price ${line.sku}`} type="number" min="0" step="any" placeholder={line.unitPrice} value={prices[line.id] ?? ""} onChange={(event) => setPrices((current) => ({ ...current, [line.id]: event.target.value }))} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div>
            {free.map((line, index) => (
              <div key={line.key} className="inv-dialog__grid" style={{ alignItems: "end" }}>
                <div className="inv-field"><label htmlFor={`bl-d-${line.key}`}>Description {index + 1} *</label><input id={`bl-d-${line.key}`} maxLength={300} value={line.description} onChange={(event) => setFree((rows) => rows.map((row) => (row.key === line.key ? { ...row, description: event.target.value } : row)))} /></div>
                <div className="inv-field"><label htmlFor={`bl-q-${line.key}`}>Quantity</label><input id={`bl-q-${line.key}`} type="number" min="0" step="any" value={line.quantity} onChange={(event) => setFree((rows) => rows.map((row) => (row.key === line.key ? { ...row, quantity: event.target.value } : row)))} /></div>
                <div className="inv-field"><label htmlFor={`bl-p-${line.key}`}>Unit price *</label><input id={`bl-p-${line.key}`} type="number" min="0" step="any" value={line.unitPrice} onChange={(event) => setFree((rows) => rows.map((row) => (row.key === line.key ? { ...row, unitPrice: event.target.value } : row)))} /></div>
                <div className="inv-field"><label htmlFor={`bl-t-${line.key}`}>Tax %</label><input id={`bl-t-${line.key}`} type="number" min="0" max="100" step="1" value={line.taxPercent} onChange={(event) => setFree((rows) => rows.map((row) => (row.key === line.key ? { ...row, taxPercent: event.target.value } : row)))} /></div>
              </div>
            ))}
            <button type="button" className="inv-link-button" onClick={() => setFree((rows) => [...rows, { key: newKey(), description: "", quantity: "1", unitPrice: "", taxPercent: "0" }])}>+ Add line</button>
          </div>
        )}
        <div className="inv-field"><label htmlFor="bl-notes">Notes</label><textarea id="bl-notes" rows={2} maxLength={1000} value={values.notes} onChange={set("notes")} /></div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!valid}>Save draft bill</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function PayablesClient() {
  const router = useRouter();
  const { can } = useCurrentUser();
  const [status, setStatus] = useState("OPEN");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const ageing = useApiData("/api/procurement/payables");
  const bills = useApiData(`/api/procurement/bills${toQuery({ status, search, page, pageSize: 25 })}`);
  const rows = bills.data?.bills ?? [];
  const data = ageing.data;

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/finance">Finance</Link></p>
          <h1>Payables</h1>
          <p>What is owed to suppliers: approved bills less posted payments, aged by due date{data ? ` as of ${data.asOf}` : ""}.</p>
        </div>
        <div className="inv-header__actions">{can("finance:create") && <Button variant="primary" onClick={() => setCreating(true)}>Record supplier bill</Button>}</div>
      </header>
      {ageing.error ? <p className="inv-state inv-state--error" role="alert">{ageing.error}</p> : data && (
        <section className="inv-card">
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Supplier</th><th className="inv-num">Bills</th>{data.buckets.map((bucket) => <th key={bucket} className="inv-num">{BUCKET_LABELS[bucket]}</th>)}<th className="inv-num">Total</th></tr></thead>
              <tbody>
                {data.suppliers.length === 0 ? (
                  <tr><td colSpan={data.buckets.length + 3}>Nothing owed to suppliers.</td></tr>
                ) : data.suppliers.map((row) => (
                  <tr key={row.supplierId}>
                    <td data-label="Supplier">{row.supplierName}</td>
                    <td data-label="Bills" className="inv-num">{row.bills}</td>
                    {data.buckets.map((bucket) => <td key={bucket} data-label={BUCKET_LABELS[bucket]} className={`inv-num ${bucket !== "current" && Number(row.buckets[bucket]) > 0 ? "inv-neg" : ""}`}>{formatAmount(row.buckets[bucket])}</td>)}
                    <td data-label="Total" className="inv-num"><strong>{formatAmount(row.total)}</strong></td>
                  </tr>
                ))}
                {data.suppliers.length > 0 && (
                  <tr><td><strong>Total</strong></td><td className="inv-num">{data.totals.bills}</td>{data.buckets.map((bucket) => <td key={bucket} className="inv-num"><strong>{formatAmount(data.totals.buckets[bucket])}</strong></td>)}<td className="inv-num"><strong>{formatAmount(data.totals.total)}</strong></td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="inv-field__hint" style={{ padding: "8px 18px" }}>
            Overdue {formatAmount(data.overdue)}. Received but not yet billed: {data.receivedNotBilled.lines} PO lines, about {formatAmount(data.receivedNotBilled.value)} at PO prices (not included above until billed).
          </p>
        </section>
      )}
      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field"><label htmlFor="bl-search">Search</label><input id="bl-search" type="search" placeholder="Bill, supplier invoice or supplier" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
          <div className="inv-field">
            <label htmlFor="bl-status">Bills</label>
            <select id="bl-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="OPEN">Approved, unpaid</option><option value="DRAFT">Draft</option><option value="APPROVED">All approved</option><option value="CANCELLED">Cancelled</option><option value="">All</option>
            </select>
          </div>
        </div>
        {bills.error ? (
          <p className="inv-state inv-state--error" role="alert">{bills.error}</p>
        ) : !bills.data ? (
          <p className="inv-state" role="status">Loading bills…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">No bills match.</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Bill</th><th>Supplier</th><th>Due</th><th className="inv-num">Total</th><th className="inv-num">Outstanding</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Bill"><Link href={`/finance/payables/bills/${row.id}`}><strong>{row.billNumber}</strong></Link><small>inv. {row.supplierInvoiceNumber}{row.poNumber ? ` · ${row.poNumber}` : ""}</small></td>
                    <td data-label="Supplier">{row.supplierName}</td>
                    <td data-label="Due">{row.dueDate}{row.daysOverdue > 0 && <small className="inv-neg">{row.daysOverdue} days overdue</small>}</td>
                    <td data-label="Total" className="inv-num">{formatAmount(row.totalAmount)}</td>
                    <td data-label="Outstanding" className="inv-num">{row.status === "APPROVED" ? formatAmount(row.outstandingAmount) : "—"}</td>
                    <td data-label="Status"><ProcStatusBadge status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={bills.data?.hasMore} onChange={setPage} disabled={bills.loading} />
      </section>
      {creating && <NewBillDialog onClose={() => setCreating(false)} onCreated={(bill) => router.push(`/finance/payables/bills/${bill.id}`)} />}
    </main>
  );
}
