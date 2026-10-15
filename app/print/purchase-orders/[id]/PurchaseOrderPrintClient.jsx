"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { COMPANY } from "@/config/company";
import { apiRequest } from "@/lib/api/client";
import { formatAmount } from "@/lib/formatters/formatters";

/* Printable purchase order (GET /api/procurement/purchase-orders/[id]). */
export default function PurchaseOrderPrintClient({ id }) {
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest(`/api/procurement/purchase-orders/${encodeURIComponent(id)}`)
      .then((value) => { if (active) setOrder(value); })
      .catch((cause) => { if (active) setError(cause?.message || "Unable to load this purchase order."); });
    return () => { active = false; };
  }, [id]);

  if (error) return <main className="print-doc print-doc--message"><p role="alert">{error}</p><Link href="/procurement/purchase-orders">Back to purchase orders</Link></main>;
  if (!order) return <main className="print-doc print-doc--message"><p role="status">Loading purchase order…</p></main>;

  return (
    <main className="print-doc">
      <nav className="print-doc__toolbar" aria-label="Document actions">
        <Link href={`/procurement/purchase-orders/${order.id}`}>Back to purchase order</Link>
        <button type="button" onClick={() => window.print()}>Print</button>
      </nav>
      <article className="print-doc__page">
        <header className="print-doc__header">
          <div>
            <strong className="print-doc__company">{COMPANY.legalName || COMPANY.name}</strong>
            {[COMPANY.address, COMPANY.phone, COMPANY.email, COMPANY.taxRegistration && `Tax reg. ${COMPANY.taxRegistration}`].filter(Boolean).map((line) => <span key={line}>{line}</span>)}
          </div>
          <div className="print-doc__title">
            <h1>Purchase order</h1>
            <dl>
              <div><dt>PO no.</dt><dd>{order.poNumber}</dd></div>
              <div><dt>Date</dt><dd>{order.orderDate}</dd></div>
              {order.expectedDate && <div><dt>Deliver by</dt><dd>{order.expectedDate}</dd></div>}
              {order.requisitionNumber && <div><dt>Requisition</dt><dd>{order.requisitionNumber}</dd></div>}
            </dl>
          </div>
        </header>
        {order.status === "DRAFT" && <p className="print-doc__notice">DRAFT: not approved. Do not supply against this document.</p>}
        {order.status === "CANCELLED" && <p className="print-doc__notice">CANCELLED: this purchase order is void.</p>}
        <section className="print-doc__parties">
          <h2>Supplier</h2>
          <span><strong>{order.supplierName}</strong> ({order.supplierCode})</span>
          {[order.supplierAddress, order.supplierPhone].filter(Boolean).map((line) => <span key={line}>{line}</span>)}
        </section>
        <table className="print-doc__table">
          <thead>
            <tr><th className="print-doc__num">#</th><th>Item</th><th className="print-doc__num">Qty</th><th>Unit</th><th className="print-doc__num">Price</th><th className="print-doc__num">Disc %</th><th className="print-doc__num">Tax %</th><th className="print-doc__num">Amount</th></tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.id}>
                <td className="print-doc__num">{line.lineNo}</td>
                <td><strong>{line.sku}</strong> · {line.productName}</td>
                <td className="print-doc__num">{line.quantity}</td>
                <td>{line.unit}</td>
                <td className="print-doc__num">{line.unitPrice}</td>
                <td className="print-doc__num">{line.discountPercent}</td>
                <td className="print-doc__num">{line.taxPercent}</td>
                <td className="print-doc__num">{formatAmount(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <section className="print-doc__summary">
          <div className="print-doc__notes">
            <h2>Terms</h2>
            <p>{order.notes || "Please quote the PO number on your delivery note and invoice."}</p>
          </div>
          <dl className="print-doc__totals">
            <div><dt>Subtotal</dt><dd>{formatAmount(order.subtotal)}</dd></div>
            <div><dt>Discount</dt><dd>{formatAmount(order.discountTotal)}</dd></div>
            <div><dt>Tax</dt><dd>{formatAmount(order.taxTotal)}</dd></div>
            <div className="print-doc__grand"><dt>Order total</dt><dd>{formatAmount(order.totalAmount)}</dd></div>
          </dl>
        </section>
        <section className="print-doc__signoff">
          <div><span>Prepared by</span></div>
          <div><span>Approved by</span></div>
          <div><span>Supplier acceptance</span></div>
        </section>
      </article>
    </main>
  );
}
