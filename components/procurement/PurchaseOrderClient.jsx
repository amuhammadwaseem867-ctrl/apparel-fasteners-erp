"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import ReceiveDialog from "@/components/procurement/ReceiveDialog";
import { ProcStatusBadge, formatAmount } from "@/components/procurement/procurementUi";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

export default function PurchaseOrderClient({ id }) {
  const { can } = useCurrentUser();
  const result = useApiData(`/api/procurement/purchase-orders/${encodeURIComponent(id)}`);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [receiving, setReceiving] = useState(false);
  const data = result.data;

  async function act(action) {
    let reason = "";
    if (action !== "approve") {
      reason = window.prompt(action === "close" ? "Reason for closing short (the rest will not be delivered)?" : "Reason for cancelling?");
      if (!reason) return;
    }
    setBusy(action);
    setError("");
    try {
      await apiRequest(`/api/procurement/purchase-orders/${id}`, { method: "PATCH", body: JSON.stringify({ action, reason }) });
      result.reload();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy("");
    }
  }

  if (result.error) return <main className="inv-page"><p className="inv-state inv-state--error" role="alert">{result.error}</p><Link href="/procurement/purchase-orders">Back to purchase orders</Link></main>;
  if (!data) return <main className="inv-page"><p className="inv-state" role="status">Loading purchase order…</p></main>;
  const receivable = ["APPROVED", "PARTIALLY_RECEIVED"].includes(data.status);
  const nothingReceived = data.lines.every((line) => Number(line.receivedQuantity) === 0);

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/procurement/purchase-orders">Purchase orders</Link></p>
          <h1>{data.poNumber} <ProcStatusBadge status={data.status} /></h1>
          <p>
            {data.supplierName} · ordered {data.orderDate}{data.expectedDate ? ` · expected ${data.expectedDate}` : ""}
            {data.requisitionNumber && <> · from <Link href={`/procurement/requisitions/${data.requisitionId}`}>{data.requisitionNumber}</Link></>}
            {data.rfqId && <> · <Link href={`/procurement/rfqs/${data.rfqId}`}>RFQ</Link></>}
            {data.closeReason ? ` · ${data.status === "CLOSED" ? "Closed" : "Cancelled"}: ${data.closeReason}` : ""}
          </p>
        </div>
        <div className="inv-header__actions">
          {data.status === "DRAFT" && can("purchasing:approve") && <Button variant="primary" loading={busy === "approve"} onClick={() => act("approve")}>Approve</Button>}
          {receivable && (can("purchasing:create") || can("inventory:create")) && <Button variant="primary" onClick={() => setReceiving(true)}>Receive goods</Button>}
          {data.status === "PARTIALLY_RECEIVED" && can("purchasing:approve") && <Button variant="secondary" loading={busy === "close"} onClick={() => act("close")}>Close short</Button>}
          {["DRAFT", "APPROVED"].includes(data.status) && nothingReceived && can("purchasing:approve") && <Button variant="secondary" loading={busy === "cancel"} onClick={() => act("cancel")}>Cancel PO</Button>}
          <Link className="inv-link-button" href={`/print/purchase-orders/${data.id}`}>Print PO</Link>
        </div>
      </header>
      {error && <p className="inv-dialog__error" role="alert">{error}</p>}
      <section className="inv-card">
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead><tr><th>#</th><th>Item</th><th className="inv-num">Ordered</th><th className="inv-num">Received</th><th className="inv-num">Billed</th><th className="inv-num">Price</th><th className="inv-num">Disc / tax %</th><th className="inv-num">Amount</th></tr></thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={line.id}>
                  <td data-label="#">{line.lineNo}</td>
                  <td data-label="Item"><strong>{line.sku}</strong><small>{line.productName}</small></td>
                  <td data-label="Ordered" className="inv-num">{line.quantity} {line.unit}</td>
                  <td data-label="Received" className="inv-num">{line.receivedQuantity}</td>
                  <td data-label="Billed" className="inv-num">{line.billedQuantity}</td>
                  <td data-label="Price" className="inv-num">{line.unitPrice}</td>
                  <td data-label="Disc / tax %" className="inv-num">{line.discountPercent} / {line.taxPercent}</td>
                  <td data-label="Amount" className="inv-num">{formatAmount(line.lineTotal)}</td>
                </tr>
              ))}
              <tr><td colSpan={7}>Subtotal · discount · tax</td><td className="inv-num">{formatAmount(data.subtotal)} · {formatAmount(data.discountTotal)} · {formatAmount(data.taxTotal)}</td></tr>
              <tr><td colSpan={7}><strong>Total</strong></td><td className="inv-num"><strong>{formatAmount(data.totalAmount)}</strong></td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="inv-card">
        <h2 style={{ padding: "12px 18px 0" }}>Goods receipts</h2>
        {data.receipts.length === 0 ? <p className="inv-state">Nothing received yet.</p> : (
          <ul style={{ padding: "8px 36px" }}>
            {data.receipts.map((receipt) => <li key={receipt.id}><Link href={`/procurement/goods-receipts?receipt=${receipt.id}`}>{receipt.receiptNumber}</Link> · {receipt.receivedDate}{receipt.deliveryNoteRef ? ` · DN ${receipt.deliveryNoteRef}` : ""}{receipt.qualityHold ? " · held for QC" : ""}</li>)}
          </ul>
        )}
        <h2 style={{ padding: "12px 18px 0" }}>Supplier bills</h2>
        {data.bills.length === 0 ? <p className="inv-state">No bills recorded.</p> : (
          <ul style={{ padding: "8px 36px" }}>
            {data.bills.map((bill) => <li key={bill.id}><Link href={`/finance/payables/bills/${bill.id}`}>{bill.billNumber}</Link> · invoice {bill.supplierInvoiceNumber} · {formatAmount(bill.totalAmount)} · {bill.status.toLowerCase()}</li>)}
          </ul>
        )}
      </section>
      {receiving && <ReceiveDialog order={data} onClose={() => setReceiving(false)} onDone={() => { setReceiving(false); result.reload(); }} />}
    </main>
  );
}
