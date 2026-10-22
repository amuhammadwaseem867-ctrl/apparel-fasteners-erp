"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api/client";
import useCompany from "@/lib/useCompany";

const STATUS_LABELS = { PENDING: "Pending", IN_PROGRESS: "In progress", COMPLETED: "Completed" };

/*
 * Printable job card for a production order (GET /api/production/orders/[id];
 * production:view governs printing). Shows the nine stages with the output
 * recorded so far, the BOM material requirement and blank sign-off boxes,
 * so it works both as a traveller for the floor and as a completion record.
 */
export default function ProductionJobCardClient({ id }) {
  const COMPANY = useCompany();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest(`/api/production/orders/${encodeURIComponent(id)}`)
      .then((value) => { if (active) setOrder(value); })
      .catch((cause) => { if (active) setError(cause?.message || "Unable to load this production order."); });
    return () => { active = false; };
  }, [id]);

  if (error) {
    return (
      <main className="print-doc print-doc--message">
        <p role="alert">{error}</p>
        <Link href="/production/orders">Back to production</Link>
      </main>
    );
  }

  if (!order) {
    return <main className="print-doc print-doc--message"><p role="status">Loading job card…</p></main>;
  }

  return (
    <main className="print-doc">
      <nav className="print-doc__toolbar" aria-label="Document actions">
        <Link href={`/production/orders/${order.id}`}>Back to order</Link>
        <button type="button" onClick={() => window.print()}>Print</button>
      </nav>

      <article className="print-doc__page">
        <header className="print-doc__header">
          <div>
            <strong className="print-doc__company">{COMPANY.name}</strong>
            {[COMPANY.address, COMPANY.phone].filter(Boolean).map((line) => <span key={line}>{line}</span>)}
          </div>
          <div className="print-doc__title">
            <h1>Production Job Card</h1>
            <dl>
              <div><dt>Order no.</dt><dd>{order.orderNumber}</dd></div>
              <div><dt>Status</dt><dd>{order.status.replace("_", " ")}</dd></div>
              <div><dt>Priority</dt><dd>{order.priority}</dd></div>
              <div><dt>Due date</dt><dd>{order.dueDate ?? "—"}</dd></div>
              {order.salesOrderNumber && <div><dt>Sales order</dt><dd>{order.salesOrderNumber}</dd></div>}
            </dl>
          </div>
        </header>

        <section className="print-doc__parties">
          <h2>Item</h2>
          <span><strong>{order.sku}</strong> · {order.productName}</span>
          <span>Quantity: <strong>{order.quantity} {order.unit}</strong>{order.bomRevision ? ` · BOM revision ${order.bomRevision}` : " · no BOM recorded"}</span>
          {order.notes && <span>Notes: {order.notes}</span>}
        </section>

        <table className="print-doc__table">
          <thead>
            <tr>
              <th className="print-doc__num">#</th>
              <th>Stage</th>
              <th>Department</th>
              <th className="print-doc__num">Received</th>
              <th className="print-doc__num">Accepted</th>
              <th className="print-doc__num">Rejected</th>
              <th className="print-doc__num">Wastage</th>
              <th className="print-doc__num">Rework</th>
              <th>Status</th>
              <th>Sign</th>
            </tr>
          </thead>
          <tbody>
            {order.stages.map((stage) => (
              <tr key={stage.stageKey}>
                <td className="print-doc__num">{stage.sequence}</td>
                <td><strong>{stage.label}</strong></td>
                <td>{stage.department}</td>
                <td className="print-doc__num">{stage.received}</td>
                <td className="print-doc__num">{stage.acceptedQuantity}</td>
                <td className="print-doc__num">{stage.rejectedQuantity}</td>
                <td className="print-doc__num">{stage.wastageQuantity}</td>
                <td className="print-doc__num">{stage.reworkQuantity}</td>
                <td>{STATUS_LABELS[stage.status] ?? stage.status}</td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>

        {order.materials.length > 0 && (
          <table className="print-doc__table">
            <thead>
              <tr><th>Component</th><th>Description</th><th className="print-doc__num">Per unit</th><th className="print-doc__num">Scrap %</th><th className="print-doc__num">Required</th><th>Unit</th></tr>
            </thead>
            <tbody>
              {order.materials.map((line) => (
                <tr key={line.componentId}>
                  <td><strong>{line.sku}</strong></td>
                  <td>{line.productName}</td>
                  <td className="print-doc__num">{line.perUnit}</td>
                  <td className="print-doc__num">{line.scrapPercent}</td>
                  <td className="print-doc__num">{line.required}</td>
                  <td>{line.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <section className="print-doc__signoff">
          <div><span>Production supervisor</span></div>
          <div><span>Quality check</span></div>
          <div><span>Production manager</span></div>
        </section>
      </article>
    </main>
  );
}

