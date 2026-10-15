"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { RECEIPT_METHOD_LABELS } from "@/components/finance/financeUi";
import { COMPANY } from "@/config/company";
import { apiRequest } from "@/lib/api/client";
import { formatAmount } from "@/lib/formatters/formatters";

/* Printable payment receipt (GET /api/finance/receipts/[id]). */
export default function ReceiptPrintClient({ id }) {
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest(`/api/finance/receipts/${encodeURIComponent(id)}`)
      .then((value) => { if (active) setReceipt(value); })
      .catch((cause) => { if (active) setError(cause?.message || "Unable to load this receipt."); });
    return () => { active = false; };
  }, [id]);

  if (error) return <main className="print-doc print-doc--message"><p role="alert">{error}</p><Link href="/finance/payments">Back to receipts</Link></main>;
  if (!receipt) return <main className="print-doc print-doc--message"><p role="status">Loading receipt…</p></main>;

  return (
    <main className="print-doc">
      <nav className="print-doc__toolbar" aria-label="Document actions">
        <Link href={`/finance/invoices/${receipt.invoiceId}`}>Back to invoice</Link>
        <button type="button" onClick={() => window.print()}>Print</button>
      </nav>
      <article className="print-doc__page">
        <header className="print-doc__header">
          <div>
            <strong className="print-doc__company">{COMPANY.legalName || COMPANY.name}</strong>
            {[COMPANY.address, COMPANY.phone].filter(Boolean).map((line) => <span key={line}>{line}</span>)}
          </div>
          <div className="print-doc__title">
            <h1>Payment Receipt</h1>
            <dl>
              <div><dt>Receipt no.</dt><dd>{receipt.receiptNumber}</dd></div>
              <div><dt>Date</dt><dd>{receipt.receiptDate}</dd></div>
              <div><dt>Invoice</dt><dd>{receipt.invoiceNumber}</dd></div>
            </dl>
          </div>
        </header>
        {receipt.status === "VOIDED" && <p className="print-doc__notice">VOIDED{receipt.voidReason ? `: ${receipt.voidReason}` : ""}. This receipt is not valid.</p>}
        <section className="print-doc__parties">
          <h2>Received from</h2>
          <span><strong>{receipt.customerName}</strong></span>
          <h2>Payment</h2>
          <span>{RECEIPT_METHOD_LABELS[receipt.method]}{receipt.reference ? ` · ${receipt.reference}` : ""}</span>
          {receipt.notes && <span>{receipt.notes}</span>}
        </section>
        <section className="print-doc__summary">
          <div className="print-doc__notes"><p>Received with thanks against invoice {receipt.invoiceNumber}.</p></div>
          <dl className="print-doc__totals">
            <div className="print-doc__grand"><dt>Amount received</dt><dd>{formatAmount(receipt.amount)}</dd></div>
          </dl>
        </section>
        <section className="print-doc__signoff">
          <div><span>Received by{receipt.createdByName ? `: ${receipt.createdByName}` : ""}</span></div>
          <div><span>Authorised signature</span></div>
        </section>
      </article>
    </main>
  );
}
