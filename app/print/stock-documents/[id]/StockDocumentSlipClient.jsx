"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api/client";
import { STOCK_DOCUMENT_TYPES } from "@/server/inventory/stock-rules";
import useCompany from "@/lib/useCompany";

const TITLES = {
  GOODS_RECEIPT: "Goods Receipt Note",
  MATERIAL_ISSUE: "Material Issue Slip",
  MATERIAL_RETURN: "Material Return Slip",
  TRANSFER: "Stock Transfer Slip",
  ADJUSTMENT: "Stock Adjustment Slip",
  COUNT: "Stock Count Reconciliation",
  DAMAGE: "Damaged / Rejected Stock Slip",
  FG_RECEIPT: "Finished Goods Receipt",
  FG_DISPATCH: "Finished Goods Dispatch Slip",
  RESERVATION: "Stock Reservation",
  RESERVATION_RELEASE: "Reservation Release",
};

const BUCKET_LABELS = { ON_HAND: "On hand", RESERVED: "Reserved", QUALITY_HOLD: "QC hold" };

/*
 * Printable slip for a posted stock document, loaded through
 * GET /api/inventory/documents/[id] (inventory:view governs printing).
 * Shows every ledger movement the document posted.
 */
export default function StockDocumentSlipClient({ id }) {
  const COMPANY = useCompany();
  const [document, setDocument] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest(`/api/inventory/documents/${encodeURIComponent(id)}`)
      .then((value) => { if (active) setDocument(value); })
      .catch((cause) => { if (active) setError(cause?.message || "Unable to load this document."); });
    return () => { active = false; };
  }, [id]);

  if (error) {
    return (
      <main className="print-doc print-doc--message">
        <p role="alert">{error}</p>
        <Link href="/inventory/movements">Back to inventory</Link>
      </main>
    );
  }

  if (!document) {
    return <main className="print-doc print-doc--message"><p role="status">Loading document…</p></main>;
  }

  const title = TITLES[document.documentType] ?? STOCK_DOCUMENT_TYPES[document.documentType]?.label ?? "Stock Document";
  const posted = new Date(document.postedAt);

  return (
    <main className="print-doc">
      <nav className="print-doc__toolbar" aria-label="Document actions">
        <Link href="/inventory/movements">Back to inventory</Link>
        <button type="button" onClick={() => window.print()}>Print</button>
      </nav>

      <article className="print-doc__page">
        <header className="print-doc__header">
          <div>
            <strong className="print-doc__company">{COMPANY.name}</strong>
            {[COMPANY.address, COMPANY.phone].filter(Boolean).map((line) => <span key={line}>{line}</span>)}
          </div>
          <div className="print-doc__title">
            <h1>{title}</h1>
            <dl>
              <div><dt>Document no.</dt><dd>{document.documentNumber}</dd></div>
              <div><dt>Posted</dt><dd>{Number.isNaN(posted.getTime()) ? "—" : posted.toLocaleString("en-GB")}</dd></div>
              <div><dt>Posted by</dt><dd>{document.createdByName ?? "—"}</dd></div>
              {document.reference && <div><dt>Reference</dt><dd>{document.reference}</dd></div>}
            </dl>
          </div>
        </header>

        {(document.reason || document.notes) && (
          <section className="print-doc__parties">
            {document.reason && <><h2>Reason</h2><span>{document.reason}</span></>}
            {document.notes && <><h2>Notes</h2><span>{document.notes}</span></>}
          </section>
        )}

        <table className="print-doc__table">
          <thead>
            <tr>
              <th className="print-doc__num">#</th>
              <th>Item</th>
              <th>Description</th>
              <th>Location</th>
              <th>Bucket</th>
              <th className="print-doc__num">Quantity</th>
              <th>Unit</th>
              <th className="print-doc__num">Balance after</th>
            </tr>
          </thead>
          <tbody>
            {document.movements.length === 0 ? (
              <tr><td colSpan={8}>No quantity changed (the count matched the book quantity).</td></tr>
            ) : document.movements.map((row) => (
              <tr key={row.id}>
                <td className="print-doc__num">{row.lineNo}</td>
                <td><strong>{row.sku}</strong></td>
                <td>{row.productName}</td>
                <td>{row.warehouseCode}/{row.locationCode}</td>
                <td>{BUCKET_LABELS[row.bucket] ?? row.bucket}</td>
                <td className="print-doc__num">{row.quantityDelta.startsWith("-") ? row.quantityDelta : `+${row.quantityDelta}`}</td>
                <td>{row.unit}</td>
                <td className="print-doc__num">{row.balanceAfter}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="print-doc__signoff">
          <div><span>Issued / received by</span></div>
          <div><span>Checked by</span></div>
          <div><span>Store in-charge</span></div>
        </section>
      </article>
    </main>
  );
}
