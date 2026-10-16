"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api/client";
import useCompany from "@/lib/useCompany";

/* Printable delivery challan for a shipment (GET /api/dispatch/shipments/[id]). */
export default function DeliveryChallanClient({ id }) {
  const COMPANY = useCompany();
  const [shipment, setShipment] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest(`/api/dispatch/shipments/${encodeURIComponent(id)}`)
      .then((value) => { if (active) setShipment(value); })
      .catch((cause) => { if (active) setError(cause?.message || "Unable to load this shipment."); });
    return () => { active = false; };
  }, [id]);

  if (error) return <main className="print-doc print-doc--message"><p role="alert">{error}</p><Link href="/dispatch/shipments">Back to dispatch</Link></main>;
  if (!shipment) return <main className="print-doc print-doc--message"><p role="status">Loading delivery challan…</p></main>;

  const date = (value) => (value ? new Date(value).toLocaleString("en-GB") : "—");

  return (
    <main className="print-doc">
      <nav className="print-doc__toolbar" aria-label="Document actions">
        <Link href={`/dispatch/shipments/${shipment.id}`}>Back to shipment</Link>
        <button type="button" onClick={() => window.print()}>Print</button>
      </nav>
      <article className="print-doc__page">
        <header className="print-doc__header">
          <div>
            <strong className="print-doc__company">{COMPANY.name}</strong>
            {[COMPANY.address, COMPANY.phone].filter(Boolean).map((line) => <span key={line}>{line}</span>)}
          </div>
          <div className="print-doc__title">
            <h1>Delivery Challan</h1>
            <dl>
              <div><dt>Challan no.</dt><dd>{shipment.shipmentNumber}</dd></div>
              <div><dt>Sales order</dt><dd>{shipment.salesOrderNumber}</dd></div>
              <div><dt>Dispatched</dt><dd>{date(shipment.dispatchedAt)}</dd></div>
              <div><dt>Status</dt><dd>{shipment.status}</dd></div>
            </dl>
          </div>
        </header>
        {shipment.status === "DRAFT" && <p className="print-doc__notice">DRAFT: not yet dispatched. Goods have not left stock.</p>}
        <section className="print-doc__parties">
          <h2>Deliver to</h2>
          <span><strong>{shipment.customerName}</strong></span>
          {shipment.deliveryAddress && <span>{shipment.deliveryAddress}</span>}
          <h2>Transport</h2>
          <span>
            {[shipment.transporter, shipment.vehicleNumber && `Vehicle ${shipment.vehicleNumber}`, shipment.driverName && `Driver ${shipment.driverName}`, shipment.driverPhone, shipment.trackingReference && `Ref ${shipment.trackingReference}`]
              .filter(Boolean).join(" · ") || "—"}
          </span>
        </section>
        <table className="print-doc__table">
          <thead><tr><th className="print-doc__num">#</th><th>Item</th><th>Description</th><th>Packing list</th><th className="print-doc__num">Packages</th><th className="print-doc__num">Quantity</th><th>Unit</th></tr></thead>
          <tbody>
            {shipment.lines.map((line) => (
              <tr key={line.id}>
                <td className="print-doc__num">{line.lineNo}</td>
                <td><strong>{line.sku}</strong></td>
                <td>{line.productName}</td>
                <td>{line.packingNumber ?? "Loose"}</td>
                <td className="print-doc__num">{line.packageCount ?? "—"}</td>
                <td className="print-doc__num">{line.quantity}</td>
                <td>{line.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shipment.notes && <p className="print-doc__notes">Notes: {shipment.notes}</p>}
        {shipment.deliveredAt && <p className="print-doc__notes">Delivered {date(shipment.deliveredAt)} · received by {shipment.receivedBy}</p>}
        <section className="print-doc__signoff">
          <div><span>Dispatched by</span></div>
          <div><span>Driver</span></div>
          <div><span>Received by (name, sign, stamp)</span></div>
        </section>
      </article>
    </main>
  );
}
