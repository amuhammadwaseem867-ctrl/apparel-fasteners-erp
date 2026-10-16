"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import PlanEditor from "@/components/planning/PlanEditor";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const TONE = { DRAFT: "warning", APPROVED: "good", CLOSED: "", CANCELLED: "danger", PLANNED: "warning", RELEASED: "good" };
const Badge = ({ value }) => <span className={`inv-badge ${TONE[value] ? `inv-badge--${TONE[value]}` : ""}`}>{value.charAt(0) + value.slice(1).toLowerCase()}</span>;

export default function PlanClient({ id }) {
  const { can } = useCurrentUser();
  const result = useApiData(`/api/planning/production-plans/${encodeURIComponent(id)}`);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const data = result.data;

  async function act(action, lineId) {
    if (["close", "cancel"].includes(action) && !window.confirm(action === "close" ? "Close this plan? Lines not yet released are cancelled; released orders continue." : "Cancel this draft plan?")) return;
    setBusy(lineId ?? action);
    setError("");
    try {
      await apiRequest(`/api/planning/production-plans/${id}`, { method: "PATCH", body: JSON.stringify({ action, lineId }) });
      result.reload();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy("");
    }
  }

  if (result.error) return <main className="inv-page"><p className="inv-state inv-state--error" role="alert">{result.error}</p><Link href="/planning/production-plans">Back to plans</Link></main>;
  if (!data) return <main className="inv-page"><p className="inv-state" role="status">Loading plan…</p></main>;
  const update = can("production:update");

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/planning/production-plans">Production plans</Link></p>
          <h1>{data.planNumber} <Badge value={data.status} /></h1>
          <p>{data.title} · {data.periodStart} → {data.periodEnd} · {data.workingDays} working days{data.notes ? ` · ${data.notes}` : ""}</p>
        </div>
        <div className="inv-header__actions">
          {data.status === "DRAFT" && can("production:create") && <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>}
          {data.status === "DRAFT" && update && <Button variant="primary" loading={busy === "approve"} onClick={() => act("approve")}>Approve plan</Button>}
          {data.status === "DRAFT" && update && <Button variant="secondary" loading={busy === "cancel"} onClick={() => act("cancel")}>Cancel plan</Button>}
          {data.status === "APPROVED" && update && <Button variant="secondary" loading={busy === "close"} onClick={() => act("close")}>Close plan</Button>}
        </div>
      </header>
      {error && <p className="inv-dialog__error" role="alert">{error}</p>}
      <section className="inv-card">
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead><tr><th>#</th><th>Item</th><th className="inv-num">Quantity</th><th>Due</th><th>Priority</th><th>Status</th><th>Production order</th><th /></tr></thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={line.id}>
                  <td data-label="#">{line.lineNo}</td>
                  <td data-label="Item"><strong>{line.sku}</strong><small>{line.productName}</small></td>
                  <td data-label="Quantity" className="inv-num">{line.quantity} {line.unit}</td>
                  <td data-label="Due">{line.dueDate}</td>
                  <td data-label="Priority">{line.priority.toLowerCase()}</td>
                  <td data-label="Status"><Badge value={line.status} /></td>
                  <td data-label="Production order">{line.productionOrderId ? <Link href={`/production/orders/${line.productionOrderId}`}>{line.orderNumber}</Link> : "—"}{line.orderStatus && <small>{line.orderStatus.toLowerCase().replace("_", " ")}</small>}</td>
                  <td data-label="">
                    {data.status === "APPROVED" && line.status === "PLANNED" && update && <><button type="button" className="inv-link-button" disabled={Boolean(busy)} onClick={() => act("release-line", line.id)}>{busy === line.id ? "Releasing…" : "Release"}</button> · <button type="button" className="inv-link-button" disabled={Boolean(busy)} onClick={() => act("cancel-line", line.id)}>Cancel</button></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="inv-card">
        <div className="inv-card__header"><h2>Capacity check</h2></div>
        {data.capacity.length === 0 ? <p className="inv-state">No stage capacity is set yet. Set it on <Link href="/planning/capacity">Capacity planning</Link>.</p> : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Stage</th><th className="inv-num">Planned</th><th className="inv-num">Days needed</th><th className="inv-num">Working days</th><th>Fits</th></tr></thead>
              <tbody>
                {data.capacity.map((row) => (
                  <tr key={row.stageKey}>
                    <td data-label="Stage">{row.label}</td>
                    <td data-label="Planned" className="inv-num">{row.quantity} {row.unit}</td>
                    <td data-label="Days needed" className="inv-num">{row.daysNeeded}</td>
                    <td data-label="Working days" className="inv-num">{row.daysAvailable}</td>
                    <td data-label="Fits">{row.fits ? <span className="inv-badge inv-badge--good">Yes</span> : <span className="inv-badge inv-badge--danger">Over capacity</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="inv-field__hint" style={{ padding: "8px 18px" }}>Only quantities in a stage&apos;s capacity unit are compared; this plan alone, not other open orders.{data.unconfiguredStages ? ` ${data.unconfiguredStages} stage(s) have no capacity set.` : ""}</p>
      </section>
      {editing && <PlanEditor plan={data} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); result.reload(); }} />}
    </main>
  );
}
