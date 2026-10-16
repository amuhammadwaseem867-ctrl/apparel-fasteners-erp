"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api/client";
import { formatAmount } from "@/lib/formatters/formatters";
import useCompany from "@/lib/useCompany";

/* Printable tax invoice (GET /api/finance/invoices/[id]). */
export default function InvoicePrintClient({ id }) {
  const COMPANY = useCompany();
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest(`/api/finance/invoices/${encodeURIComponent(id)}`)
      .then((value) => { if (active) setInvoice(value); })
      .catch((cause) => { if (active) setError(cause?.message || "Unable to load this invoice."); });
    return () => { active = false; };
  }, [id]);

  if (error) return <main className="print-doc print-doc--message"><p role="alert">{error}</p><Link href="/finance/invoices">Back to invoices</Link></main>;
  if (!invoice) return <main className="print-doc print-doc--message"><p role="status">Loading invoice…</p></main>;

  return (
    <main className="print-doc">
      <nav className="print-doc__toolbar" aria-label="Document actions">
        <Link href={`/finance/invoices/${invoice.id}`}>Back to invoice</Link>
        <button type="button" onClick={() => window.print()}>Print</button>
      </nav>
      <article className="print-doc__page">
        <header className="print-doc__header">
          <div>
            <strong className="print-doc__company">{COMPANY.legalName || COMPANY.name}</strong>
            {[COMPANY.address, COMPANY.phone, COMPANY.email, COMPANY.taxRegistration && `Tax reg. ${COMPANY.taxRegistration}`].filter(Boolean).map((line) => <span key={line}>{line}</span>)}
          </div>
          <div className="print-doc__title">
            <h1>Invoice</h1>
            <dl>
              <div><dt>Invoice no.</dt><dd>{invoice.invoiceNumber}</dd></div>
              <div><dt>Date</dt><dd>{invoice.invoiceDate}</dd></div>
              <div><dt>Due date</dt><dd>{invoice.dueDate}</dd></div>
              <div><dt>Sales order</dt><dd>{invoice.salesOrderNumber}</dd></div>
              <div><dt>Delivery challan</dt><dd>{invoice.shipmentNumber}</dd></div>
            </dl>
          </div>
        </header>
        {invoice.status === "DRAFT" && <p className="print-doc__notice">DRAFT: not issued. This is not a valid invoice.</p>}
        {invoice.status === "CANCELLED" && <p className="print-doc__notice">CANCELLED: this invoice is void.</p>}
        <section className="print-doc__parties">
          <h2>Bill to</h2>
          <span><strong>{invoice.customerName}</strong></span>
          {[invoice.customerEmail, invoice.customerPhone].filter(Boolean).map((line) => <span key={line}>{line}</span>)}
        </section>
        <table className="print-doc__table">
          <thead>
            <tr><th className="print-doc__num">#</th><th>Description</th><th className="print-doc__num">Qty</th><th>Unit</th><th className="print-doc__num">Price</th><th className="print-doc__num">Disc %</th><th className="print-doc__num">Tax %</th><th className="print-doc__num">Tax</th><th className="print-doc__num">Amount</th></tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id}>
                <td className="print-doc__num">{line.lineNo}</td>
                <td><strong>{line.description}</strong>{line.sku ? ` · ${line.sku}` : ""}</td>
                <td className="print-doc__num">{line.quantity}</td>
                <td>{line.unit}</td>
                <td className="print-doc__num">{line.unitPrice}</td>
                <td className="print-doc__num">{line.discountPercent}</td>
                <td className="print-doc__num">{line.taxPercent}</td>
                <td className="print-doc__num">{formatAmount(line.taxAmount)}</td>
                <td className="print-doc__num">{formatAmount(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <section className="print-doc__summary">
          <div className="print-doc__notes">
            <h2>Notes</h2>
            <p>{invoice.notes || "Payment due by the due date shown."}</p>
            {invoice.status === "ISSUED" && (Number(invoice.credited) > 0 || Number(invoice.received) > 0) && (
              <p>Credited {formatAmount(invoice.credited)} · received {formatAmount(invoice.received)} · balance due {formatAmount(invoice.outstanding)}</p>
            )}
          </div>
          <dl className="print-doc__totals">
            <div><dt>Subtotal</dt><dd>{formatAmount(invoice.subtotal)}</dd></div>
            <div><dt>Discount</dt><dd>{formatAmount(invoice.discountTotal)}</dd></div>
            <div><dt>Tax</dt><dd>{formatAmount(invoice.taxTotal)}</dd></div>
            <div className="print-doc__grand"><dt>Invoice total</dt><dd>{formatAmount(invoice.totalAmount)}</dd></div>
          </dl>
        </section>
        <section className="print-doc__signoff">
          <div><span>Prepared by</span></div>
          <div><span>Authorised signature</span></div>
          <div><span>Received by customer</span></div>
        </section>
      </article>
    </main>
  );
}
