"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import { INSPECTION_TYPE_LABELS } from "@/components/quality/InspectionDialog";
import { InspectionStatusBadge } from "@/components/quality/QualityInspectionList";
import { apiRequest } from "@/lib/api/client";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const EFFECT = {
  FINAL: "Approving records the Quality Check stage of the production order: passed units go on to packing, rework returns to the Quality Check queue, rejected units are lost.",
  INCOMING: "Approving releases the passed quantity from quality hold to available stock and scraps the rejected quantity. Rework stays on hold.",
  IN_PROCESS: "Approving accepts this sampling record. It does not change stage quantities.",
};

function when(value) {
  return value ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "";
}

export default function InspectionClient({ id }) {
  const loaded = useApiData(`/api/quality/inspections/${id}`);
  const [override, setOverride] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const inspection = override ?? loaded.data;

  async function decide(action) {
    if (busy) return;
    const confirmText = action === "approve"
      ? "Approve this inspection? Its results are applied immediately and cannot be changed."
      : "Cancel this inspection? Its results will not be applied.";
    if (!window.confirm(confirmText)) return;
    const note = window.prompt(action === "approve" ? "Approval note (optional)" : "Reason for cancelling (optional)") ?? null;
    if (note === null) return;
    setBusy(action);
    setError("");
    try {
      setOverride(await apiRequest(`/api/quality/inspections/${id}`, { method: "PATCH", body: JSON.stringify({ action, note }) }));
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy("");
    }
  }

  if (loaded.error && !inspection) return <main className="inv-page"><p className="inv-dialog__error" role="alert">{loaded.error}</p></main>;
  if (!inspection) return <main className="inv-page"><p className="inv-state" role="status">Loading inspection…</p></main>;

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/quality/inspections">Inspections</Link></p>
          <h1>{inspection.inspectionNumber} <InspectionStatusBadge status={inspection.status} /></h1>
          <p>
            {INSPECTION_TYPE_LABELS[inspection.inspectionType]} · <strong>{inspection.sku}</strong> {inspection.productName}
            {inspection.orderNumber && <> · <Link href={`/production/orders/${inspection.productionOrderId}`}>{inspection.orderNumber}</Link></>}
            {inspection.stageLabel ? ` · ${inspection.stageLabel}` : ""}
            {inspection.locationLabel ? ` · at ${inspection.locationLabel}` : ""}
          </p>
        </div>
        {inspection.status === "OPEN" && (
          <div className="inv-header__actions">
            <Button variant="secondary" loading={busy === "cancel"} onClick={() => decide("cancel")}>Cancel</Button>
            <Button variant="primary" loading={busy === "approve"} onClick={() => decide("approve")}>Approve</Button>
          </div>
        )}
      </header>

      {error && <p className="inv-dialog__error" role="alert">{error}</p>}
      {inspection.status === "OPEN" && <p className="inv-state" role="status">{EFFECT[inspection.inspectionType]}</p>}

      <section className="inv-kpis" aria-label="Results">
        <div className="inv-kpi"><span>Inspected</span><strong>{inspection.inspectedQuantity}</strong><small>{inspection.unit}{inspection.sampleSize ? ` · sample ${inspection.sampleSize}` : ""}</small></div>
        <div className="inv-kpi"><span>Passed</span><strong>{inspection.passedQuantity}</strong></div>
        <div className={`inv-kpi ${Number(inspection.reworkQuantity) > 0 ? "inv-kpi--warning" : ""}`}><span>Rework</span><strong>{inspection.reworkQuantity}</strong></div>
        <div className={`inv-kpi ${Number(inspection.rejectedQuantity) > 0 ? "inv-kpi--danger" : ""}`}><span>Rejected</span><strong>{inspection.rejectedQuantity}</strong></div>
      </section>

      <section className="inv-card">
        <div className="inv-card__header"><h2>Defects</h2></div>
        {inspection.defects.length === 0 ? (
          <p className="inv-state">No defects recorded.</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Defect</th><th className="inv-num">Count</th></tr></thead>
              <tbody>
                {inspection.defects.map((defect, index) => (
                  <tr key={`${defect.description}-${index}`}><td data-label="Defect">{defect.description}</td><td data-label="Count" className="inv-num">{defect.count}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="inv-card">
        <div className="inv-card__header"><h2>Record</h2></div>
        <ul style={{ margin: 0, padding: "12px 32px", fontSize: 13 }}>
          <li>Recorded {when(inspection.createdAt)}{inspection.createdByName ? ` by ${inspection.createdByName}` : ""}{inspection.inspectorName ? ` · inspector ${inspection.inspectorName}` : ""}</li>
          {inspection.remarks && <li>Remarks: {inspection.remarks}</li>}
          {inspection.decidedAt && (
            <li>{inspection.status === "APPROVED" ? "Approved" : "Cancelled"} {when(inspection.decidedAt)}{inspection.decidedByName ? ` by ${inspection.decidedByName}` : ""}{inspection.decisionNote ? ` · ${inspection.decisionNote}` : ""}</li>
          )}
          {inspection.stockDocuments.map((document) => (
            <li key={document.id}>Stock document <Link href={`/print/stock-documents/${document.id}`}>{document.documentNumber}</Link></li>
          ))}
        </ul>
      </section>
    </main>
  );
}
