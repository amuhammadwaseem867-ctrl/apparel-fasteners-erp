"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PASS_TYPES } from "@/components/gate/gatePassUi";
import { apiRequest } from "@/lib/api/client";
import useCompany from "@/lib/useCompany";

/* Printable gate pass for the guard (GET /api/gate-passes/[id]). */
export default function GatePassPrintClient({ id }) {
  const COMPANY = useCompany();
  const [pass, setPass] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest(`/api/gate-passes/${encodeURIComponent(id)}`)
      .then((value) => { if (active) setPass(value); })
      .catch((cause) => { if (active) setError(cause?.message || "Unable to load this gate pass."); });
    return () => { active = false; };
  }, [id]);

  if (error) return <main className="print-doc print-doc--message"><p role="alert">{error}</p><Link href="/dispatch/gate-passes">Back to gate passes</Link></main>;
  if (!pass) return <main className="print-doc print-doc--message"><p role="status">Loading gate pass…</p></main>;

  return (
    <main className="print-doc">
      <nav className="print-doc__toolbar" aria-label="Document actions">
        <Link href={`/dispatch/gate-passes/${pass.id}`}>Back to gate pass</Link>
        <button type="button" onClick={() => window.print()}>Print</button>
      </nav>
      <article className="print-doc__page">
        <header className="print-doc__header">
          <div>
            <strong className="print-doc__company">{COMPANY.legalName || COMPANY.name}</strong>
            {[COMPANY.address, COMPANY.phone].filter(Boolean).map((line) => <span key={line}>{line}</span>)}
          </div>
          <div className="print-doc__title">
            <h1>Gate Pass</h1>
            <dl>
              <div><dt>Pass no.</dt><dd>{pass.passNumber}</dd></div>
              <div><dt>Type</dt><dd>{PASS_TYPES[pass.passType]}</dd></div>
              <div><dt>Date</dt><dd>{new Date(pass.createdAt).toLocaleDateString("en-GB")}</dd></div>
              {pass.expectedReturnDate && <div><dt>Return by</dt><dd>{pass.expectedReturnDate}</dd></div>}
            </dl>
          </div>
        </header>
        {pass.status === "DRAFT" && <p className="print-doc__notice">NOT APPROVED: goods may not pass the gate on this pass.</p>}
        {pass.status === "CANCELLED" && <p className="print-doc__notice">CANCELLED: this gate pass is void.</p>}
        <section className="print-doc__parties">
          <h2>Party</h2>
          <span><strong>{pass.partyName}</strong></span>
          <h2>Purpose</h2>
          <span>{pass.purpose}</span>
          <h2>Transport</h2>
          <span>{[pass.vehicleNumber && `Vehicle ${pass.vehicleNumber}`, pass.driverName, pass.shipmentNumber && `Shipment ${pass.shipmentNumber}`].filter(Boolean).join(" · ") || "—"}</span>
        </section>
        <table className="print-doc__table">
          <thead><tr><th className="print-doc__num">#</th><th>Item</th><th className="print-doc__num">Quantity</th><th>Unit</th>{pass.passType === "OUTWARD_RETURNABLE" && <th className="print-doc__num">Returned</th>}</tr></thead>
          <tbody>
            {pass.lines.map((line) => (
              <tr key={line.id}>
                <td className="print-doc__num">{line.lineNo}</td>
                <td>{line.description}</td>
                <td className="print-doc__num">{line.quantity}</td>
                <td>{line.unit}</td>
                {pass.passType === "OUTWARD_RETURNABLE" && <td className="print-doc__num">{line.returnedQuantity}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {pass.passedAt && <p className="print-doc__notes">Passed the gate {new Date(pass.passedAt).toLocaleString("en-GB")} · guard {pass.guardName}</p>}
        <section className="print-doc__signoff">
          <div><span>Prepared by</span></div>
          <div><span>Approved by{pass.approvedByName ? `: ${pass.approvedByName}` : ""}</span></div>
          <div><span>Security guard</span></div>
        </section>
      </article>
    </main>
  );
}
