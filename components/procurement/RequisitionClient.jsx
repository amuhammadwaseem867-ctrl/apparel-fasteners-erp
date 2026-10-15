"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { ProcStatusBadge, SupplierSelect, newKey, today } from "@/components/procurement/procurementUi";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

/* Raises a draft PO for an approved requisition at prices entered here. */
function OrderDialog({ requisition, onClose, onCreated }) {
  const suppliers = useApiData("/api/procurement/suppliers?status=ACTIVE&pageSize=200");
  const [supplierId, setSupplierId] = useState("");
  const [orderDate, setOrderDate] = useState(today);
  const [expectedDate, setExpectedDate] = useState("");
  const [prices, setPrices] = useState(() => Object.fromEntries(requisition.lines.map((line) => [line.id, { unitPrice: "", taxPercent: "0" }])));
  const [key] = useState(newKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const valid = supplierId && requisition.lines.every((line) => prices[line.id].unitPrice !== "" && Number(prices[line.id].unitPrice) >= 0);
  const set = (id, field) => (event) => setPrices((current) => ({ ...current, [id]: { ...current[id], [field]: event.target.value } }));

  async function submit(event) {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      onCreated(await apiRequest("/api/procurement/purchase-orders", {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: key, supplierId, orderDate, expectedDate, requisitionId: requisition.id,
          lines: requisition.lines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity), unitPrice: Number(prices[line.id].unitPrice), taxPercent: Number(prices[line.id].taxPercent || 0), requisitionLineId: line.id })),
        }),
      }));
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title={`Purchase order for ${requisition.requisitionNumber}`} description="Creates a draft PO; it must be approved before goods can be received." size="large">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          <SupplierSelect id="po-supplier" suppliers={suppliers.data?.suppliers ?? []} value={supplierId} onChange={setSupplierId} />
          <div className="inv-field"><label htmlFor="po-date">Order date *</label><input id="po-date" type="date" required value={orderDate} onChange={(event) => setOrderDate(event.target.value)} /></div>
          <div className="inv-field"><label htmlFor="po-expected">Expected delivery</label><input id="po-expected" type="date" min={orderDate} value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} /></div>
        </div>
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead><tr><th>Item</th><th className="inv-num">Quantity</th><th>Unit price *</th><th>Tax %</th></tr></thead>
            <tbody>
              {requisition.lines.map((line) => (
                <tr key={line.id}>
                  <td data-label="Item"><strong>{line.sku}</strong><small>{line.productName}</small></td>
                  <td data-label="Quantity" className="inv-num">{line.quantity} {line.unit}</td>
                  <td data-label="Unit price"><input aria-label={`Unit price ${line.sku}`} type="number" min="0" step="any" required value={prices[line.id].unitPrice} onChange={set(line.id, "unitPrice")} /></td>
                  <td data-label="Tax %"><input aria-label={`Tax ${line.sku}`} type="number" min="0" max="100" step="1" value={prices[line.id].taxPercent} onChange={set(line.id, "taxPercent")} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!valid}>Create draft PO</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function RequisitionClient({ id }) {
  const router = useRouter();
  const { can } = useCurrentUser();
  const result = useApiData(`/api/procurement/requisitions/${encodeURIComponent(id)}`);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [ordering, setOrdering] = useState(false);
  const [rfqKey] = useState(newKey);
  const data = result.data;

  async function act(action) {
    const note = ["reject", "cancel"].includes(action) ? window.prompt(`Reason to ${action}?`) : "";
    if (note === null) return;
    setBusy(action);
    setError("");
    try {
      await apiRequest(`/api/procurement/requisitions/${id}`, { method: "PATCH", body: JSON.stringify({ action, note }) });
      result.reload();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy("");
    }
  }

  async function requestQuotes() {
    setBusy("rfq");
    setError("");
    try {
      const rfq = await apiRequest("/api/procurement/rfqs", { method: "POST", body: JSON.stringify({ idempotencyKey: rfqKey, requisitionId: id }) });
      router.push(`/procurement/rfqs/${rfq.id}`);
    } catch (cause) {
      setError(cause.message);
      setBusy("");
    }
  }

  if (result.error) return <main className="inv-page"><p className="inv-state inv-state--error" role="alert">{result.error}</p><Link href="/procurement/requisitions">Back to requisitions</Link></main>;
  if (!data) return <main className="inv-page"><p className="inv-state" role="status">Loading requisition…</p></main>;

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/procurement/requisitions">Requisitions</Link></p>
          <h1>{data.requisitionNumber} <ProcStatusBadge status={data.status} /></h1>
          <p>{data.neededBy ? `Needed by ${data.neededBy}. ` : ""}{data.notes || ""}{data.decisionNote ? ` Decision: ${data.decisionNote}` : ""}</p>
        </div>
        <div className="inv-header__actions">
          {data.status === "DRAFT" && can("purchasing:create") && <Button variant="primary" loading={busy === "submit"} onClick={() => act("submit")}>Submit for approval</Button>}
          {data.status === "SUBMITTED" && can("purchasing:approve") && <Button variant="primary" loading={busy === "approve"} onClick={() => act("approve")}>Approve</Button>}
          {data.status === "SUBMITTED" && can("purchasing:approve") && <Button variant="secondary" loading={busy === "reject"} onClick={() => act("reject")}>Reject</Button>}
          {data.status === "APPROVED" && can("purchasing:create") && <Button variant="primary" loading={busy === "rfq"} onClick={requestQuotes}>Request quotations</Button>}
          {data.status === "APPROVED" && can("purchasing:create") && <Button variant="secondary" onClick={() => setOrdering(true)}>Raise PO directly</Button>}
          {["DRAFT", "SUBMITTED"].includes(data.status) && can("purchasing:create") && <button type="button" className="inv-link-button" onClick={() => act("cancel")}>Cancel requisition</button>}
        </div>
      </header>
      {error && <p className="inv-dialog__error" role="alert">{error}</p>}
      <section className="inv-card">
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead><tr><th>#</th><th>Item</th><th className="inv-num">Quantity</th><th>Notes</th></tr></thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={line.id}>
                  <td data-label="#">{line.lineNo}</td>
                  <td data-label="Item"><strong>{line.sku}</strong><small>{line.productName}</small></td>
                  <td data-label="Quantity" className="inv-num">{line.quantity} {line.unit}</td>
                  <td data-label="Notes">{line.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.purchaseOrders.length > 0 && (
          <p className="inv-field__hint" style={{ padding: "8px 18px" }}>
            Purchase orders: {data.purchaseOrders.map((order, index) => <span key={order.id}>{index ? ", " : ""}<Link href={`/procurement/purchase-orders/${order.id}`}>{order.poNumber}</Link> ({order.status.toLowerCase()})</span>)}
          </p>
        )}
      </section>
      {ordering && <OrderDialog requisition={data} onClose={() => setOrdering(false)} onCreated={(order) => router.push(`/procurement/purchase-orders/${order.id}`)} />}
    </main>
  );
}
