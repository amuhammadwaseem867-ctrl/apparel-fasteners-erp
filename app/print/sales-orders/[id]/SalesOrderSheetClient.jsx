"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api/client";
import { toSalesOrderSheet } from "@/lib/print/salesOrderSheet";
import useCompany from "@/lib/useCompany";

export default function SalesOrderSheetClient({ id }) {
  const COMPANY = useCompany();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    apiRequest(`/api/sales/orders/${encodeURIComponent(id)}`)
      .then((value) => {
        if (active) {
          setOrder(value);
        }
      })
      .catch((cause) => {
        if (active) {
          setError(cause?.message || "Unable to load this sales order.");
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  const backHref = `/sales/orders/${encodeURIComponent(id)}`;

  if (error) {
    return (
      <main className="print-doc print-doc--message">
        <p role="alert">{error}</p>
        <Link href={backHref}>Back to order</Link>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="print-doc print-doc--message">
        <p role="status">Loading sales order...</p>
      </main>
    );
  }

  const sheet = toSalesOrderSheet(order);
  const companyDetails = [
    COMPANY.legalName,
    COMPANY.address,
    COMPANY.phone,
    COMPANY.email,
    COMPANY.taxRegistration && `Tax reg.: ${COMPANY.taxRegistration}`,
  ].filter(Boolean);

  return (
    <main className="print-doc">
      <nav className="print-doc__toolbar" aria-label="Document actions">
        <Link href={backHref}>Back to order</Link>
        <button type="button" onClick={() => window.print()}>
          Print
        </button>
      </nav>

      {!sheet.isFinal && (
        <p className="print-doc__notice">
          This order is {sheet.status.toLowerCase()}. The printed sheet is
          marked accordingly and is not a confirmation.
        </p>
      )}

      <article className="print-doc__page">
        <header className="print-doc__header">
          <div>
            <strong className="print-doc__company">{COMPANY.name}</strong>
            {companyDetails.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>

          <div className="print-doc__title">
            <h1>{sheet.title}</h1>
            <dl>
              <div><dt>Order no.</dt><dd>{sheet.orderNumber}</dd></div>
              <div><dt>Order date</dt><dd>{sheet.orderDate}</dd></div>
              <div><dt>Delivery date</dt><dd>{sheet.deliveryDate}</dd></div>
              <div><dt>Status</dt><dd>{sheet.status}</dd></div>
            </dl>
          </div>
        </header>

        <section className="print-doc__parties">
          <h2>Customer</h2>
          <strong>{sheet.customer.name}</strong>
          {sheet.customer.code && <span>Code: {sheet.customer.code}</span>}
          {sheet.customer.phone && <span>Phone: {sheet.customer.phone}</span>}
          {sheet.customer.email && <span>Email: {sheet.customer.email}</span>}
        </section>

        <table className="print-doc__table">
          <thead>
            <tr>
              <th className="print-doc__num">#</th>
              <th>Description</th>
              <th>SKU / ref.</th>
              <th>Category</th>
              <th>Variant</th>
              <th className="print-doc__num">Qty</th>
              <th>Unit</th>
              <th className="print-doc__num">Unit price</th>
              <th className="print-doc__num">Disc.</th>
              <th className="print-doc__num">Tax</th>
              <th className="print-doc__num">Line total</th>
            </tr>
          </thead>

          <tbody>
            {sheet.lines.map((line) => (
              <tr key={line.key}>
                <td className="print-doc__num">{line.number}</td>
                <td>
                  <strong>{line.description}</strong>
                  {line.isCustom && <em> (custom)</em>}
                  {line.customerReference && <small>Customer ref.: {line.customerReference}</small>}
                  {line.lineNotes && <small>{line.lineNotes}</small>}
                </td>
                <td>{line.sku}</td>
                <td>{line.category}</td>
                <td>{line.variant}</td>
                <td className="print-doc__num">{line.quantity}</td>
                <td>{line.unit}</td>
                <td className="print-doc__num">{line.unitPrice}</td>
                <td className="print-doc__num">{line.discount}</td>
                <td className="print-doc__num">{line.tax}</td>
                <td className="print-doc__num">{line.lineTotal}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="print-doc__summary">
          <div className="print-doc__notes">
            <h2>Notes / specifications</h2>
            <p>{sheet.notes ?? "None."}</p>
          </div>

          <dl className="print-doc__totals">
            <div><dt>Subtotal</dt><dd>{sheet.totals.subtotal}</dd></div>
            <div><dt>Discount</dt><dd>{sheet.totals.discount}</dd></div>
            <div><dt>Tax</dt><dd>{sheet.totals.tax}</dd></div>
            <div className="print-doc__grand"><dt>Order total</dt><dd>{sheet.totals.total}</dd></div>
          </dl>
        </section>

        <section className="print-doc__signoff">
          <div><span>Prepared by</span></div>
          <div><span>Approved by</span></div>
          <div><span>Customer acceptance</span></div>
        </section>
      </article>
    </main>
  );
}
