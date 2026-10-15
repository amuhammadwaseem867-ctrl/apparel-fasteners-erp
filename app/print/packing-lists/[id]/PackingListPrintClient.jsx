"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { COMPANY } from "@/config/company";
import { apiRequest } from "@/lib/api/client";
import { addDecimalStrings } from "@/server/core/utils/decimal";

/* Printable packing list (GET /api/packing/lists/[id]); totals are exact. */
export default function PackingListPrintClient({ id }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest(`/api/packing/lists/${encodeURIComponent(id)}`)
      .then((value) => { if (active) setList(value); })
      .catch((cause) => { if (active) setError(cause?.message || "Unable to load this packing list."); });
    return () => { active = false; };
  }, [id]);

  if (error) return <main className="print-doc print-doc--message"><p role="alert">{error}</p><Link href="/packing/orders">Back to packing</Link></main>;
  if (!list) return <main className="print-doc print-doc--message"><p role="status">Loading packing list…</p></main>;

  const weight = (field) => (list.packages.every((item) => item[field] !== null)
    ? list.packages.reduce((sum, item) => addDecimalStrings(sum, item[field]), "0")
    : "—");

  return (
    <main className="print-doc">
      <nav className="print-doc__toolbar" aria-label="Document actions">
        <Link href={`/packing/orders/${list.id}`}>Back to packing list</Link>
        <button type="button" onClick={() => window.print()}>Print</button>
      </nav>
      <article className="print-doc__page">
        <header className="print-doc__header">
          <div>
            <strong className="print-doc__company">{COMPANY.name}</strong>
            {[COMPANY.address, COMPANY.phone].filter(Boolean).map((line) => <span key={line}>{line}</span>)}
          </div>
          <div className="print-doc__title">
            <h1>Packing List</h1>
            <dl>
              <div><dt>Packing no.</dt><dd>{list.packingNumber}</dd></div>
              <div><dt>Status</dt><dd>{list.status}</dd></div>
              <div><dt>Production order</dt><dd>{list.orderNumber}</dd></div>
              {list.salesOrderNumber && <div><dt>Sales order</dt><dd>{list.salesOrderNumber}</dd></div>}
              {list.shipmentNumber && <div><dt>Shipment</dt><dd>{list.shipmentNumber}</dd></div>}
            </dl>
          </div>
        </header>
        <section className="print-doc__parties">
          <h2>Item</h2>
          <span><strong>{list.sku}</strong> · {list.productName}</span>
          <span>{list.totalQuantity} {list.unit} in {list.packageCount} packages · stored at {list.locationLabel}</span>
        </section>
        <table className="print-doc__table">
          <thead><tr><th className="print-doc__num">Pkg</th><th>Type</th><th className="print-doc__num">Quantity</th><th className="print-doc__num">Net kg</th><th className="print-doc__num">Gross kg</th><th>Dimensions</th><th>Marks</th></tr></thead>
          <tbody>
            {list.packages.map((item) => (
              <tr key={item.id}>
                <td className="print-doc__num">{item.packageNo}</td>
                <td>{item.packageType}</td>
                <td className="print-doc__num">{item.quantity}</td>
                <td className="print-doc__num">{item.netWeight ?? "—"}</td>
                <td className="print-doc__num">{item.grossWeight ?? "—"}</td>
                <td>{item.dimensions || ""}</td>
                <td>{item.marks || ""}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={2}><strong>Total</strong></td>
              <td className="print-doc__num"><strong>{list.totalQuantity}</strong></td>
              <td className="print-doc__num"><strong>{weight("netWeight")}</strong></td>
              <td className="print-doc__num"><strong>{weight("grossWeight")}</strong></td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
        {list.notes && <p className="print-doc__notes">Notes: {list.notes}</p>}
        <section className="print-doc__signoff">
          <div><span>Packed by</span></div>
          <div><span>Checked by</span></div>
          <div><span>Store in-charge</span></div>
        </section>
      </article>
    </main>
  );
}
