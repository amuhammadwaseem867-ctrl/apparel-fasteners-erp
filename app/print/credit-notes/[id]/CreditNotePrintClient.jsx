"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api/client";
import { formatAmount } from "@/lib/formatters/formatters";
import useCompany from "@/lib/useCompany";

/* Printable credit note (GET /api/finance/credit-notes/[id]). */
export default function CreditNotePrintClient({ id }) {
  const COMPANY = useCompany();
  const [note, setNote] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest(`/api/finance/credit-notes/${encodeURIComponent(id)}`)
      .then((value) => { if (active) setNote(value); })
      .catch((cause) => { if (active) setError(cause?.message || "Unable to load this credit note."); });
    return () => { active = false; };
  }, [id]);

  if (error) return <main className="print-doc print-doc--message"><p role="alert">{error}</p><Link href="/finance/invoices">Back to invoices</Link></main>;
  if (!note) return <main className="print-doc print-doc--message"><p role="status">Loading credit note…</p></main>;

  return (
    <main className="print-doc">
      <nav className="print-doc__toolbar" aria-label="Document actions">
        <Link href={`/finance/invoices/${note.invoiceId}`}>Back to invoice</Link>
        <button type="button" onClick={() => window.print()}>Print</button>
      </nav>
      <article className="print-doc__page">
        <header className="print-doc__header">
          <div>
            <strong className="print-doc__company">{COMPANY.legalName || COMPANY.name}</strong>
            {[COMPANY.address, COMPANY.phone, COMPANY.taxRegistration && `Tax reg. ${COMPANY.taxRegistration}`].filter(Boolean).map((line) => <span key={line}>{line}</span>)}
          </div>
          <div className="print-doc__title">
            <h1>Credit Note</h1>
            <dl>
              <div><dt>Credit note no.</dt><dd>{note.creditNumber}</dd></div>
              <div><dt>Date</dt><dd>{note.creditDate}</dd></div>
              <div><dt>Against invoice</dt><dd>{note.invoiceNumber}</dd></div>
            </dl>
          </div>
        </header>
        <section className="print-doc__parties">
          <h2>Customer</h2>
          <span><strong>{note.customerName}</strong></span>
          <h2>Reason</h2>
          <span>{note.reason}</span>
        </section>
        <table className="print-doc__table">
          <thead><tr><th className="print-doc__num">Line</th><th>Description</th><th className="print-doc__num">Qty</th><th>Unit</th><th className="print-doc__num">Price</th><th className="print-doc__num">Tax</th><th className="print-doc__num">Amount</th></tr></thead>
          <tbody>
            {note.lines.map((line) => (
              <tr key={line.id}>
                <td className="print-doc__num">{line.lineNo}</td>
                <td>{line.description}</td>
                <td className="print-doc__num">{line.quantity}</td>
                <td>{line.unit}</td>
                <td className="print-doc__num">{line.unitPrice}</td>
                <td className="print-doc__num">{formatAmount(line.taxAmount)}</td>
                <td className="print-doc__num">{formatAmount(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <section className="print-doc__summary">
          <div className="print-doc__notes"><p>This credit reduces the balance of invoice {note.invoiceNumber}.</p></div>
          <dl className="print-doc__totals">
            <div><dt>Subtotal</dt><dd>{formatAmount(note.subtotal)}</dd></div>
            <div><dt>Discount</dt><dd>{formatAmount(note.discountTotal)}</dd></div>
            <div><dt>Tax</dt><dd>{formatAmount(note.taxTotal)}</dd></div>
            <div className="print-doc__grand"><dt>Credit total</dt><dd>{formatAmount(note.totalAmount)}</dd></div>
          </dl>
        </section>
        <section className="print-doc__signoff">
          <div><span>Prepared by</span></div>
          <div><span>Authorised signature</span></div>
          <div><span>Customer acknowledgement</span></div>
        </section>
      </article>
    </main>
  );
}
