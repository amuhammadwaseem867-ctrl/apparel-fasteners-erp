"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import StageChecklistDialog from "@/components/production/StageChecklistDialog";
import StockDocumentDialog from "@/components/inventory/StockDocumentDialog";
import {
  OrderStatusBadge,
  PriorityBadge,
  ProgressBar,
  StageStatusBadge,
  formatDateTime,
  newKey,
} from "@/components/production/productionUi";
import { apiRequest } from "@/lib/api/client";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";
import "@/components/production/Production.css";

const EMPTY_RUN = { inputQuantity: "", acceptedQuantity: "", rejectedQuantity: "", wastageQuantity: "", reworkQuantity: "", operatorName: "", workstation: "", remarks: "" };

const ACTIONS = {
  release: { label: "Release", confirm: "Release this order to the floor? Stage output can then be recorded." },
  hold: { label: "Put on hold", reason: "Reason for the hold" },
  resume: { label: "Resume" },
  cancel: { label: "Cancel order", reason: "Reason for cancelling", confirm: "Cancel this production order? This cannot be undone." },
};

const AVAILABLE_ACTIONS = {
  PLANNED: ["release", "cancel"],
  RELEASED: ["hold", "cancel"],
  IN_PROGRESS: ["hold"],
  ON_HOLD: ["resume"],
};

/* Stages owned by another module (D-022) link there instead of a run form. */
const MANAGED_LINKS = {
  quality: { text: "Quality Check is recorded by approving a final inspection.", label: "Record final inspection", href: (order) => `/quality/final?productionOrderId=${order.id}` },
  packing: { text: "Packing is recorded by confirming a packing list.", label: "New packing list", href: (order) => `/packing/orders?productionOrderId=${order.id}` },
  dispatch: { text: "Delivery for this sales order is recorded by confirming a shipment's delivery.", label: "Ready for delivery", href: () => "/dispatch/ready" },
};

const EVENT_LABELS = {
  CREATED: "Order created",
  STATUS_RELEASE: "Released",
  STATUS_HOLD: "Put on hold",
  STATUS_RESUME: "Resumed",
  STATUS_CANCEL: "Cancelled",
  STATUS_STARTED: "Production started",
  STATUS_COMPLETED: "Order completed",
  STAGE_RUN_RECORDED: "Output recorded",
  STAGE_COMPLETED: "Stage completed",
  STAGE_ADVANCED: "Moved to next stage",
};

/*
 * One stage's run form. The idempotency key lives for one submission and
 * is reused on retry, so a double click or a retry after a network error
 * records the run once.
 */
function StageRunForm({ order, stage, onRecorded }) {
  const [values, setValues] = useState(EMPTY_RUN);
  const [key, setKey] = useState(newKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (field) => (event) => { setValues((current) => ({ ...current, [field]: event.target.value })); setError(""); };
  const number = (value) => (value === "" ? 0 : Number(value));
  const parts = number(values.acceptedQuantity) + number(values.rejectedQuantity) + number(values.wastageQuantity) + number(values.reworkQuantity);
  const ready = Number(values.inputQuantity) > 0 && values.acceptedQuantity !== "";

  async function submit(event) {
    event.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError("");
    try {
      const updated = await apiRequest(`/api/production/orders/${order.id}/stages/${stage.stageKey}/runs`, {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: key,
          inputQuantity: Number(values.inputQuantity),
          acceptedQuantity: number(values.acceptedQuantity),
          rejectedQuantity: number(values.rejectedQuantity),
          wastageQuantity: number(values.wastageQuantity),
          reworkQuantity: number(values.reworkQuantity),
          operatorName: values.operatorName,
          workstation: values.workstation,
          remarks: values.remarks,
        }),
      });
      setValues(EMPTY_RUN);
      setKey(newKey());
      onRecorded(updated);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSaving(false);
    }
  }

  const id = (field) => `run-${stage.stageKey}-${field}`;

  return (
    <form className="prd-run-form" onSubmit={submit} aria-label={`Record output for ${stage.label}`}>
      <div className="inv-field">
        <label htmlFor={id("input")}>Input *</label>
        <input id={id("input")} type="number" step="any" min="0" max={stage.available} required value={values.inputQuantity} onChange={set("inputQuantity")} />
      </div>
      <div className="inv-field">
        <label htmlFor={id("accepted")}>Accepted *</label>
        <input id={id("accepted")} type="number" step="any" min="0" required value={values.acceptedQuantity} onChange={set("acceptedQuantity")} />
      </div>
      <div className="inv-field">
        <label htmlFor={id("rejected")}>Rejected</label>
        <input id={id("rejected")} type="number" step="any" min="0" value={values.rejectedQuantity} onChange={set("rejectedQuantity")} />
      </div>
      <div className="inv-field">
        <label htmlFor={id("wastage")}>Wastage</label>
        <input id={id("wastage")} type="number" step="any" min="0" value={values.wastageQuantity} onChange={set("wastageQuantity")} />
      </div>
      <div className="inv-field">
        <label htmlFor={id("rework")}>Rework</label>
        <input id={id("rework")} type="number" step="any" min="0" value={values.reworkQuantity} onChange={set("reworkQuantity")} />
      </div>
      <div className="inv-field">
        <label htmlFor={id("operator")}>Operator</label>
        <input id={id("operator")} maxLength={120} value={values.operatorName} onChange={set("operatorName")} />
      </div>
      <div className="inv-field">
        <label htmlFor={id("workstation")}>Machine / workstation</label>
        <input id={id("workstation")} maxLength={120} value={values.workstation} onChange={set("workstation")} />
      </div>
      <div className="inv-field">
        <label htmlFor={id("remarks")}>Remarks</label>
        <input id={id("remarks")} maxLength={1000} value={values.remarks} onChange={set("remarks")} />
      </div>
      <Button type="submit" variant="primary" loading={saving} disabled={!ready}>Record output</Button>
      {values.inputQuantity !== "" && ready && Math.abs(parts - Number(values.inputQuantity)) > 1e-9 && (
        <p className="inv-field__hint" role="status" style={{ gridColumn: "1 / -1" }}>
          Accepted + rejected + wastage + rework must equal the input. The server checks this exactly.
        </p>
      )}
      {error && <p className="inv-dialog__error" role="alert" style={{ gridColumn: "1 / -1" }}>{error}</p>}
    </form>
  );
}

function StageSection({ order, stage, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showRuns, setShowRuns] = useState(false);
  const [checking, setChecking] = useState(false);
  const open = ["RELEASED", "IN_PROGRESS"].includes(order.status) && stage.status !== "COMPLETED";
  // No blockers (D-048): an open stage can be completed at any time.
  const canComplete = open;
  const points = stage.checks?.points ?? [];

  async function complete() {
    if (busy) return;
    // Stages 1–6 complete through their check points (D-040).
    if (!stage.managedBy) {
      setChecking(true);
      return;
    }
    const next = order.stages.find((item) => item.sequence === stage.sequence + 1);
    const message = next
      ? `Complete ${stage.label}? The order moves to ${next.label}; no more output can be recorded at this stage.`
      : `Complete ${stage.label}? This completes the production order.`;
    if (!window.confirm(message)) return;
    setBusy(true);
    setError("");
    try {
      onChanged(await apiRequest(`/api/production/orders/${order.id}/stages/${stage.stageKey}/complete`, { method: "POST" }));
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="prd-stage" id={`stage-${stage.stageKey}`} aria-labelledby={`stage-${stage.stageKey}-title`}>
      <div className="prd-stage__head">
        <h3 id={`stage-${stage.stageKey}-title`}>{stage.sequence}. {stage.label} <StageStatusBadge status={stage.status} /></h3>
        <div className="inv-header__actions prd-no-print">
          {stage.runs.length > 0 && (
            <button type="button" className="inv-text-button" aria-expanded={showRuns} onClick={() => setShowRuns((current) => !current)}>
              {showRuns ? "Hide" : "Show"} {stage.runs.length} {stage.runs.length === 1 ? "run" : "runs"}
            </button>
          )}
          {points.length > 0 && !open && (
            <button type="button" className="inv-text-button" onClick={() => setChecking(true)}>View checks</button>
          )}
          {open && (
            <Button size="small" variant="secondary" loading={busy} disabled={!canComplete} onClick={complete}>
              Complete stage
            </Button>
          )}
        </div>
      </div>
      <dl className="prd-stage__figures">
        <div><dt>Department</dt><dd>{stage.department}</dd></div>
        <div><dt>Received</dt><dd>{stage.received}</dd></div>
        <div><dt>Processed</dt><dd>{stage.processedQuantity}</dd></div>
        <div><dt>Accepted</dt><dd>{stage.acceptedQuantity}</dd></div>
        <div><dt>Rejected</dt><dd>{stage.rejectedQuantity}</dd></div>
        <div><dt>Wastage</dt><dd>{stage.wastageQuantity}</dd></div>
        <div><dt>Rework</dt><dd>{stage.reworkQuantity}</dd></div>
        <div><dt>Waiting</dt><dd className={Number(stage.available) > 0 ? "inv-pos" : ""}>{stage.available}</dd></div>
        {stage.startedAt && <div><dt>Started</dt><dd>{formatDateTime(stage.startedAt)}</dd></div>}
        {stage.completedAt && <div><dt>Completed</dt><dd>{formatDateTime(stage.completedAt)}</dd></div>}
      </dl>
      {stage.completionNote && <p className="inv-field__hint"><strong>Completion note:</strong> {stage.completionNote}</p>}
      {stage.checks?.problem && open && stage.status === "IN_PROGRESS" && <p className="inv-field__hint" role="status">Checks: {stage.checks.problem} (the stage can still be completed)</p>}
      {checking && (
        <StageChecklistDialog
          order={order}
          stage={stage}
          readOnly={!open}
          onClose={() => setChecking(false)}
          onSaved={async () => onChanged(await apiRequest(`/api/production/orders/${order.id}`))}
          onComplete={async ({ note }) => onChanged(await apiRequest(`/api/production/orders/${order.id}/stages/${stage.stageKey}/complete`, { method: "POST", body: JSON.stringify({ note }) }))}
        />
      )}
      {error && <p className="inv-dialog__error" role="alert">{error}</p>}
      {open && Number(stage.available) > 0 && (MANAGED_LINKS[stage.managedBy] ? (
        <p className="inv-state" role="status">
          {MANAGED_LINKS[stage.managedBy].text}{" "}
          <Link className="inv-link-button" href={MANAGED_LINKS[stage.managedBy].href(order)}>{MANAGED_LINKS[stage.managedBy].label}</Link>
        </p>
      ) : (
        <StageRunForm order={order} stage={stage} onRecorded={onChanged} />
      ))}
      {showRuns && (
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead>
              <tr>
                <th className="inv-num">Run</th><th className="inv-num">Input</th><th className="inv-num">Accepted</th><th className="inv-num">Rejected</th>
                <th className="inv-num">Wastage</th><th className="inv-num">Rework</th><th>Operator</th><th>Workstation</th><th>Recorded</th><th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {stage.runs.map((run) => (
                <tr key={run.id}>
                  <td data-label="Run" className="inv-num">{run.runNo}</td>
                  <td data-label="Input" className="inv-num">{run.inputQuantity}</td>
                  <td data-label="Accepted" className="inv-num">{run.acceptedQuantity}</td>
                  <td data-label="Rejected" className="inv-num">{run.rejectedQuantity}</td>
                  <td data-label="Wastage" className="inv-num">{run.wastageQuantity}</td>
                  <td data-label="Rework" className="inv-num">{run.reworkQuantity}</td>
                  <td data-label="Operator">{run.operatorName || "—"}</td>
                  <td data-label="Workstation">{run.workstation || "—"}</td>
                  <td data-label="Recorded">{formatDateTime(run.recordedAt)}<small>{run.recordedBy ?? ""}</small></td>
                  <td data-label="Remarks">{run.remarks || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function ProductionOrderClient({ id }) {
  const loaded = useApiData(`/api/production/orders/${id}`);
  const [override, setOverride] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [issueOpen, setIssueOpen] = useState(false);
  const locations = useApiData(issueOpen ? "/api/inventory/locations?status=ACTIVE" : null);
  const order = override && override.updatedAt >= (loaded.data?.updatedAt ?? "") ? override : loaded.data;

  async function act(action) {
    if (busy) return;
    const meta = ACTIONS[action];
    if (meta.confirm && !window.confirm(meta.confirm)) return;
    let reason = "";
    if (meta.reason) {
      reason = window.prompt(meta.reason) ?? null;
      if (reason === null) return;
    }
    setBusy(action);
    setError("");
    try {
      setOverride(await apiRequest(`/api/production/orders/${id}`, { method: "PATCH", body: JSON.stringify({ action, reason }) }));
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy("");
    }
  }

  if (loaded.error && !order) return <main className="inv-page"><p className="inv-dialog__error" role="alert">{loaded.error}</p></main>;
  if (!order) return <main className="inv-page"><p className="inv-state" role="status">Loading production order…</p></main>;

  const actions = AVAILABLE_ACTIONS[order.status] ?? [];

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/production/orders">Production orders</Link></p>
          <h1>{order.orderNumber} <OrderStatusBadge status={order.status} /></h1>
          <p>
            <strong>{order.sku}</strong> · {order.productName} · {order.quantity} {order.unit} · <PriorityBadge priority={order.priority} />
            {order.dueDate ? ` · due ${order.dueDate}` : ""}
            {order.salesOrderNumber ? ` · for ${order.salesOrderNumber}` : " · make to stock"}
            {order.bomRevision ? ` · BOM rev ${order.bomRevision}` : " · no active BOM"}
          </p>
        </div>
        <div className="inv-header__actions prd-no-print">
          {actions.map((action) => (
            <Button key={action} variant={action === "release" || action === "resume" ? "primary" : "secondary"} loading={busy === action} onClick={() => act(action)}>
              {ACTIONS[action].label}
            </Button>
          ))}
          <Link className="inv-link-button" href={`/print/production-orders/${order.id}`}>Print job card</Link>
        </div>
      </header>

      {error && <p className="inv-dialog__error" role="alert">{error}</p>}

      <section className="inv-card">
        <div className="inv-card__header">
          <h2>Stages</h2>
          <ProgressBar value={order.progress} />
        </div>
        <ol className="prd-stepper" aria-label="Production stages">
          {order.stages.map((stage) => (
            <li key={stage.stageKey} data-status={stage.status} data-current={order.status !== "COMPLETED" && order.currentStage === stage.stageKey}>
              <strong>{stage.sequence}</strong>
              <a href={`#stage-${stage.stageKey}`}>{stage.label}</a>
            </li>
          ))}
        </ol>
        {order.status === "PLANNED" && <p className="inv-state">Release the order to start recording output.</p>}
        {order.status === "ON_HOLD" && <p className="inv-state inv-state--error" role="status">On hold. Resume the order to record output or complete stages.</p>}
        {order.stages.map((stage) => (
          <StageSection key={stage.stageKey} order={order} stage={stage} onChanged={setOverride} />
        ))}
      </section>

      <section className="inv-card">
        <div className="inv-card__header">
          <div>
            <h2>Materials</h2>
            <small>Requirement from BOM revision {order.bomRevision ?? "—"} for {order.quantity} {order.unit}, including scrap. Issues post to the stock ledger.</small>
          </div>
          {order.materials.length > 0 && ["RELEASED", "IN_PROGRESS"].includes(order.status) && (
            <Button variant="primary" onClick={() => setIssueOpen(true)}>Issue material</Button>
          )}
        </div>
        {order.materials.length === 0 ? (
          <p className="inv-state">{order.bomId ? "The BOM has no lines." : "This item had no active BOM when the order was created, so no material requirement is recorded."}</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Component</th><th className="inv-num">Per unit</th><th className="inv-num">Scrap %</th><th className="inv-num">Required</th></tr></thead>
              <tbody>
                {order.materials.map((line) => (
                  <tr key={line.componentId}>
                    <td data-label="Component"><strong>{line.sku}</strong><small>{line.productName}</small></td>
                    <td data-label="Per unit" className="inv-num">{line.perUnit}</td>
                    <td data-label="Scrap %" className="inv-num">{line.scrapPercent}</td>
                    <td data-label="Required" className="inv-num">{line.required} {line.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="inv-card__header"><h2>Material issues</h2></div>
        {order.materialIssues.length === 0 ? (
          <p className="inv-state">No material issued to this order yet.</p>
        ) : (
          <ul className="prd-events">
            {order.materialIssues.map((document) => (
              <li key={document.id}>
                <Link href={`/print/stock-documents/${document.id}`}>{document.documentNumber}</Link> · {formatDateTime(document.postedAt)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="inv-card">
        <div className="inv-card__header"><h2>History</h2></div>
        <ol className="prd-events">
          {order.events.map((event) => (
            <li key={event.id}>
              <strong>{EVENT_LABELS[event.eventType] ?? event.eventType}</strong>
              {event.stageKey ? ` · ${order.stages.find((stage) => stage.stageKey === event.stageKey)?.label ?? event.stageKey}` : ""}
              {event.eventType === "STAGE_RUN_RECORDED" && event.details ? ` · in ${event.details.inputQuantity}, accepted ${event.details.acceptedQuantity}` : ""}
              {event.details?.reason ? ` · ${event.details.reason}` : ""}
              {" · "}{formatDateTime(event.createdAt)}{event.actorName ? ` · ${event.actorName}` : ""}
            </li>
          ))}
        </ol>
      </section>

      {issueOpen && (
        <StockDocumentDialog
          open
          documentType="MATERIAL_ISSUE"
          locations={locations.data ?? []}
          source={{ sourceType: "ProductionOrder", sourceId: order.id, reference: order.orderNumber }}
          initialLines={order.materials.map((line) => ({
            item: { id: line.componentId, sku: line.sku, name: line.productName, unit: line.unit },
            quantity: line.required,
          }))}
          onClose={() => setIssueOpen(false)}
          onPosted={() => { setOverride(null); loaded.reload(); }}
        />
      )}
    </main>
  );
}

