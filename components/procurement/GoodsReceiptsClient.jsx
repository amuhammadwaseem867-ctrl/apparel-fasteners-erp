"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import InventoryPager from "@/components/inventory/InventoryPager";
import ReceiveDialog from "@/components/procurement/ReceiveDialog";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

function ReceiptDetail({ id, onClose }) {
  const receipt = useApiData(`/api/procurement/receipts/${encodeURIComponent(id)}`);
  const data = receipt.data;
  return (
    <Modal open onClose={onClose} title={data ? `Goods receipt ${data.receiptNumber}` : "Goods receipt"} size="large">
      {receipt.error ? <p className="inv-dialog__error" role="alert">{receipt.error}</p> : !data ? <p className="inv-state" role="status">Loading…</p> : (
        <div className="inv-dialog">
          <p>
            Against <Link href={`/procurement/purchase-orders/${data.purchaseOrderId}`}>{data.poNumber}</Link> · received {data.receivedDate}
            {data.deliveryNoteRef ? ` · delivery note ${data.deliveryNoteRef}` : ""}{data.qualityHold ? " · held for incoming inspection" : ""}
          </p>
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Item</th><th className="inv-num">Quantity</th></tr></thead>
              <tbody>{data.lines.map((line) => <tr key={line.id}><td data-label="Item"><strong>{line.sku}</strong><small>{line.productName}</small></td><td data-label="Quantity" className="inv-num">{line.quantity} {line.unit}</td></tr>)}</tbody>
            </table>
          </div>
          <p>Stock documents: {data.stockDocuments.map((document, index) => <span key={document.id}>{index ? ", " : ""}<Link href={`/print/stock-documents/${document.id}`}>{document.documentNumber}</Link> ({document.documentType.replace("_", " ").toLowerCase()})</span>)}</p>
          {data.notes && <p>{data.notes}</p>}
        </div>
      )}
    </Modal>
  );
}

function PickOrderDialog({ onClose, onPicked }) {
  const orders = useApiData("/api/procurement/purchase-orders?status=OPEN&pageSize=200");
  const [orderId, setOrderId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const rows = orders.data?.purchaseOrders ?? [];

  async function next(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      onPicked(await apiRequest(`/api/procurement/purchase-orders/${orderId}`));
    } catch (cause) {
      setError(cause.message);
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Receive against a purchase order" size="medium">
      <form className="inv-dialog" onSubmit={next}>
        {orders.error ? <p className="inv-dialog__error" role="alert">{orders.error}</p> : !orders.data ? <p className="inv-state" role="status">Loading open orders…</p> : rows.length === 0 ? (
          <p className="inv-state">No approved purchase orders are waiting for delivery.</p>
        ) : (
          <div className="inv-field">
            <label htmlFor="gr-po">Open purchase order *</label>
            <select id="gr-po" required value={orderId} onChange={(event) => setOrderId(event.target.value)}>
              <option value="">Select PO</option>
              {rows.map((row) => <option key={row.id} value={row.id}>{row.poNumber} · {row.supplierName} · {row.received}/{row.ordered} received</option>)}
            </select>
          </div>
        )}
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={loading} disabled={!orderId}>Next</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function GoodsReceiptsClient({ initialReceipt = "" }) {
  const { can } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [picking, setPicking] = useState(false);
  const [order, setOrder] = useState(null);
  const [viewing, setViewing] = useState(initialReceipt);
  const list = useApiData(`/api/procurement/receipts${toQuery({ search, page, pageSize: 25 })}`);
  const rows = list.data?.receipts ?? [];

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/procurement">Procurement</Link></p>
          <h1>Goods receipts</h1>
          <p>Deliveries received against purchase orders. Each receipt posts a goods receipt (and, when held, a QC hold) to the stock ledger in the same transaction.</p>
        </div>
        <div className="inv-header__actions">{(can("purchasing:create") || can("inventory:create")) && <Button variant="primary" onClick={() => setPicking(true)}>Receive goods</Button>}</div>
      </header>
      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field"><label htmlFor="gr-search">Search</label><input id="gr-search" type="search" placeholder="Receipt, PO or supplier" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
        </div>
        {list.error ? (
          <p className="inv-state inv-state--error" role="alert">{list.error}</p>
        ) : !list.data ? (
          <p className="inv-state" role="status">Loading receipts…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">{search ? "No receipts match." : "No goods received yet."}</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Receipt</th><th>PO / supplier</th><th>Delivery note</th><th className="inv-num">Quantity</th><th>QC</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Receipt"><button type="button" className="inv-link-button" onClick={() => setViewing(row.id)}><strong>{row.receiptNumber}</strong></button><small>{row.receivedDate}{row.expectedDate && row.receivedDate > row.expectedDate ? " · late" : ""}</small></td>
                    <td data-label="PO / supplier"><Link href={`/procurement/purchase-orders/${row.purchaseOrderId}`}>{row.poNumber}</Link><small>{row.supplierName}</small></td>
                    <td data-label="Delivery note">{row.deliveryNoteRef || "—"}</td>
                    <td data-label="Quantity" className="inv-num">{row.quantity}</td>
                    <td data-label="QC">{row.qualityHold ? <span className="inv-badge inv-badge--warning">Held</span> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={list.data?.hasMore} onChange={setPage} disabled={list.loading} />
      </section>
      {picking && <PickOrderDialog onClose={() => setPicking(false)} onPicked={(picked) => { setPicking(false); setOrder(picked); }} />}
      {order && <ReceiveDialog order={order} onClose={() => setOrder(null)} onDone={(receipt) => { setOrder(null); list.reload(); setViewing(receipt.id); }} />}
      {viewing && <ReceiptDetail id={viewing} onClose={() => setViewing("")} />}
    </main>
  );
}
