"use client";

/*
 * Order Profile (requirements 1.2, sections 4, 18 and 21): one page that
 * follows an order from placement to payment. Status, the order sheet
 * (no prices), each production order with its nine stages and simple
 * Start / Complete buttons, raw material issued, QC, packing, dispatch,
 * gate passes, invoices and payments, each with the next step to take.
 * Every step is passed here (D-047): QC, packing, dispatch with its gate
 * pass, delivery, invoice and payment open in place; nothing sends the
 * user to another page to carry on.
 */

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Circle, Factory, Pencil, PlayCircle, Printer } from "lucide-react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ReceiptDialog from "@/components/finance/ReceiptDialog";
import PackingListDialog from "@/components/packing/PackingListDialog";
import InspectionDialog from "@/components/quality/InspectionDialog";
import ShipmentDialog from "@/components/dispatch/ShipmentDialog";
import StageChecklistDialog from "@/components/production/StageChecklistDialog";
import { formatAmount } from "@/components/finance/financeUi";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";
import "./OrderProfile.css";

const STATUS_TONE = { New: "draft", Confirmed: "info", "In Production": "info", "On Hold": "warn", "QC Pending": "warn", "QC Approved": "ok", Packing: "info", "Ready for Delivery": "ok", Dispatched: "info", "Part delivered": "warn", Delivered: "ok", Cancelled: "bad" };

const SHORTFALL_REASONS = [
  ["PRODUCTION_SHORT", "Production short"],
  ["MATERIAL_SHORT", "Material short"],
  ["QC_REJECTED", "Rejected in QC"],
  ["CUSTOMER_REQUEST", "Customer asked for part now"],
  ["OTHER", "Other"],
];
const SHORTFALL_REASON = Object.fromEntries(SHORTFALL_REASONS);

/* Notes why part of an item is left for later (D-050): nothing waits on it. */
function ShortfallDialog({ order, line, onClose, onSaved }) {
  const [quantity, setQuantity] = useState(line.left);
  const [reason, setReason] = useState("PRODUCTION_SHORT");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiRequest("/api/shortfalls", {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: globalThis.crypto?.randomUUID?.() ?? `sf-${Date.now()}-${Math.random().toString(36).slice(2)}`, salesOrderId: order.id, productId: line.productId, quantity: Number(quantity), reason, notes }),
      });
      onSaved();
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={saving ? undefined : onClose} title={`Shortfall · ${line.sku ?? line.productName ?? "item"}`}>
      <form className="inv-dialog" onSubmit={submit}>
        <p className="inv-field__hint">Ordered {qty(line.ordered)}, delivered {qty(line.delivered)}. The rest can still be packed and sent later; a later delivery settles this shortfall by itself.</p>
        <div className="inv-dialog__grid">
          <div className="inv-field"><label htmlFor="sf-qty">Quantity short ({line.unit})</label><input id="sf-qty" type="number" step="any" min="0" required value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div>
          <div className="inv-field"><label htmlFor="sf-reason">Reason</label>
            <select id="sf-reason" value={reason} onChange={(event) => setReason(event.target.value)}>
              {SHORTFALL_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>
        <div className="inv-field"><label htmlFor="sf-notes">Notes</label><input id="sf-notes" maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. rest comes next week" /></div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>Save shortfall</Button>
        </div>
      </form>
    </Modal>
  );
}
const STAGE_STATUS = { PENDING: "Not started", IN_PROGRESS: "In progress", COMPLETED: "Done", SKIPPED: "Skipped" };

const day = (value) => (value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const when = (value) => (value ? new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const qty = (value) => (value === null || value === undefined || value === "" ? "—" : Number(value).toLocaleString("en-US", { maximumFractionDigits: 3 }));

const STEP_NAMES = { order: "Order", production: "Production", qc: "Quality check", packing: "Packing", dispatch: "Dispatch", invoice: "Invoice", payment: "Payment" };

/* Notes left at a process step (D-041): read by everyone who opens the order. */
function StepNotes({ steps, notes, onAdd }) {
  const [text, setText] = useState("");
  const [step, setStep] = useState(steps[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const own = notes.filter((note) => steps.includes(note.step));

  async function submit(event) {
    event.preventDefault();
    if (saving || text.trim().length < 2) return;
    setSaving(true);
    setError("");
    try {
      await onAdd(step, text.trim());
      setText("");
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="op-notes-log">
      {own.length > 0 && (
        <ul>
          {own.map((note) => (
            <li key={note.id}>
              <span className="op-notes-log__meta">{steps.length > 1 ? `${STEP_NAMES[note.step]} · ` : ""}{note.createdByName ?? "Unknown user"} · {when(note.createdAt)}</span>
              {note.note}
            </li>
          ))}
        </ul>
      )}
      <form className="op-notes-log__form" onSubmit={submit}>
        {steps.length > 1 && (
          <select aria-label="Note for step" value={step} onChange={(event) => setStep(event.target.value)}>
            {steps.map((item) => <option key={item} value={item}>{STEP_NAMES[item]}</option>)}
          </select>
        )}
        <input aria-label={`Note for ${STEP_NAMES[step]}`} maxLength={1000} placeholder={`Add a note for ${STEP_NAMES[step]} (what was done, issues, instructions)…`} value={text} onChange={(event) => setText(event.target.value)} />
        <Button type="submit" size="sm" variant="secondary" loading={saving} disabled={text.trim().length < 2}>Add note</Button>
      </form>
      {error && <p className="inv-dialog__error" role="alert">{error}</p>}
    </div>
  );
}

function Section({ title, step, children, action, id }) {
  return (
    <section className="inv-card op-section" id={id}>
      <div className="op-section__head">
        <h2>{step && <span className="op-step">{step}</span>}{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }) {
  return <p className="op-empty">{children}</p>;
}

/* Check point summary for a stage: "3/4 checks", or the failure. */
function checkSummary(checks) {
  const points = checks?.points ?? [];
  if (!points.length) return null;
  const failed = points.filter((point) => point.result === "FAIL").length;
  if (failed) return <span className="op-checks op-checks--fail">{failed} check failed</span>;
  const done = points.filter((point) => point.result).length;
  return <span className={`op-checks ${done === points.length ? "op-checks--ok" : ""}`}>{done}/{points.length} checks</span>;
}

const MANAGED_ACTIONS = { quality: "Record QC", packing: "Make packing list", dispatch: "Dispatch" };

function StageRow({ order, stage, index, canRun, busy, onStart, onChecks, onManaged, onComplete }) {
  // No blockers (D-048): any stage can be started or completed, in any order.
  const running = ["RELEASED", "IN_PROGRESS"].includes(order.status);
  const done = stage.status === "COMPLETED";

  // QC, packing and dispatch stay open while anything waits, even after
  // Complete was pressed (D-053): the rest of a part delivery comes later.
  const working = running || order.status === "COMPLETED";
  const waitingManaged = stage.managedBy && Number(stage.available) > 0;

  let action = null;
  if (done && working && waitingManaged) {
    action = <Button size="sm" variant="secondary" onClick={() => onManaged(stage.managedBy)}>{MANAGED_ACTIONS[stage.managedBy]}</Button>;
  } else if (!done && running) {
    if (stage.managedBy) {
      // QC, packing and dispatch are recorded here; once nothing is left waiting, the stage is completed here too.
      const waiting = Number(stage.available) > 0;
      action = waiting
        ? <Button size="sm" variant="secondary" onClick={() => onManaged(stage.managedBy)}>{MANAGED_ACTIONS[stage.managedBy]}</Button>
        : Number(stage.acceptedQuantity) > 0 && canRun
          ? <Button size="sm" variant="primary" loading={busy} onClick={() => onComplete(stage.stageKey)}>Complete {stage.label}</Button>
          : null;
    } else if (canRun && stage.status === "PENDING") {
      action = <Button size="sm" variant="secondary" loading={busy} onClick={() => onStart(stage.stageKey)}>Start</Button>;
    } else if (canRun && stage.status === "IN_PROGRESS") {
      action = <Button size="sm" variant="primary" onClick={() => onChecks(stage)}>{stage.checks?.points?.length ? "Checks & complete" : "Complete"}</Button>;
    }
  } else if (done && stage.checks?.points?.length) {
    action = <button type="button" className="inv-text-button" onClick={() => onChecks(stage)}>View checks</button>;
  }

  return (
    <>
      <tr className={done ? "op-stage--done" : stage.status === "IN_PROGRESS" ? "op-stage--active" : ""}>
        <td data-label="Stage">
          <span className="op-stage-name">{done ? <CheckCircle2 size={16} /> : stage.status === "IN_PROGRESS" ? <PlayCircle size={16} /> : <Circle size={16} />}{index + 1}. {stage.label}</span>
        </td>
        <td data-label="Status">{STAGE_STATUS[stage.status] ?? stage.status} {checkSummary(stage.checks)}</td>
        <td data-label="Start">{when(stage.startedAt)}</td>
        <td data-label="End">{when(stage.completedAt)}</td>
        <td data-label="Quantity" className="inv-num">{Number(stage.acceptedQuantity) > 0 ? `${qty(stage.acceptedQuantity)} ${stage.unit}` : "—"}</td>
        <td data-label="">{action}</td>
      </tr>
      {stage.completionNote && (
        <tr className="op-note-row"><td colSpan={6}><strong>Note:</strong> {stage.completionNote}</td></tr>
      )}
    </>
  );
}

/* The payment dialog needs the invoice's own outstanding balance (credit notes included). */
function ReceiptLoader({ invoiceId, onClose, onDone }) {
  const invoice = useApiData(`/api/finance/invoices/${invoiceId}`);
  if (invoice.error) {
    return (
      <Modal open onClose={onClose} title="Record payment" size="medium">
        <p className="inv-dialog__error" role="alert">{invoice.error}</p>
      </Modal>
    );
  }
  if (!invoice.data) return null;
  return <ReceiptDialog invoice={invoice.data} onClose={onClose} onDone={onDone} />;
}

export default function OrderProfileClient({ id }) {
  const { can } = useCurrentUser();
  const traceData = useApiData(`/api/sales/orders/${encodeURIComponent(id)}/trace`);
  const trace = traceData.data;
  const load = traceData.reload;
  const [actionError, setError] = useState("");
  const error = actionError || traceData.error;
  const [busy, setBusy] = useState("");
  const [dialog, setDialog] = useState(null);

  async function run(label, request) {
    if (busy) return;
    setBusy(label);
    setError("");
    try {
      await request();
      load();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy("");
    }
  }

  const changeStatus = (action) => run(action, () => apiRequest(`/api/sales/orders/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ action }) }));
  const toProduction = () => run("production", () => apiRequest(`/api/sales/orders/${encodeURIComponent(id)}/to-production`, { method: "POST" }));
  const stageAction = (productionId, stageKey, action, totalQuantity) => run(`${productionId}:${stageKey}`, () => apiRequest(
    `/api/production/orders/${productionId}/stages/${stageKey}/simple`,
    { method: "POST", body: JSON.stringify(totalQuantity === undefined ? { action } : { action, totalQuantity: Number(totalQuantity) }) },
  ));

  const stageComplete = (productionId, stageKey) => run(`${productionId}:${stageKey}`, () => apiRequest(
    `/api/production/orders/${productionId}/stages/${stageKey}/complete`, { method: "POST", body: "{}" },
  ));
  const decide = (inspection, action) => {
    if (action === "cancel" && !window.confirm(`Cancel inspection ${inspection.inspectionNumber}?`)) return;
    return run(`qc:${inspection.id}`, () => apiRequest(`/api/quality/inspections/${inspection.id}`, { method: "PATCH", body: JSON.stringify({ action, note: "" }) }));
  };
  const packingAction = (list, action) => {
    const text = action === "confirm"
      ? `Pass packing ${list.packingNumber}? ${qty(list.totalQuantity)} goes into finished-goods stock.`
      : `Cancel packing list ${list.packingNumber}?`;
    if (!window.confirm(text)) return;
    return run(`pk:${list.id}`, () => apiRequest(`/api/packing/lists/${list.id}`, { method: "PATCH", body: JSON.stringify({ action }) }));
  };
  // Dispatching hands the goods over: the outward gate pass is made from the shipment at the same time.
  const gatePass = (shipment) => apiRequest("/api/gate-passes", {
    method: "POST",
    body: JSON.stringify({
      idempotencyKey: `gp-${shipment.id}`,
      passType: "OUTWARD_NON_RETURNABLE",
      partyName: trace.order.customer.name,
      purpose: `Delivery of order ${trace.order.orderNumber} (${shipment.shipmentNumber})`,
      shipmentId: shipment.id,
      vehicleNumber: shipment.vehicleNumber ?? "",
      lines: [],
    }),
  });
  const dispatchShipment = (shipment) => {
    if (!window.confirm(`Dispatch ${shipment.shipmentNumber}? The goods leave finished-goods stock and the gate pass is made.`)) return;
    return run(`sh:${shipment.id}`, async () => {
      await apiRequest(`/api/dispatch/shipments/${shipment.id}`, { method: "PATCH", body: JSON.stringify({ action: "dispatch" }) });
      await gatePass(shipment);
    });
  };
  const makeGatePass = (shipment) => run(`gp:${shipment.id}`, () => gatePass(shipment));
  // The goods leaving the gate are the delivery (D-051): approve if needed, pass, and the shipment is delivered.
  const passGate = (pass) => {
    const guardName = window.prompt(`Gate pass ${pass.passNumber}: guard name at the gate?`) ?? "";
    if (!guardName.trim()) return;
    return run(`gp:${pass.id}`, async () => {
      if (pass.status === "DRAFT") await apiRequest(`/api/gate-passes/${pass.id}`, { method: "PATCH", body: JSON.stringify({ action: "approve" }) });
      await apiRequest(`/api/gate-passes/${pass.id}`, { method: "PATCH", body: JSON.stringify({ action: "pass", guardName }) });
    });
  };
  const cancelShortfall = (shortfall) => {
    if (!window.confirm("Remove this shortfall note?")) return;
    return run(`sf:${shortfall.id}`, () => apiRequest(`/api/shortfalls/${shortfall.id}`, { method: "PATCH", body: JSON.stringify({ action: "cancel" }) }));
  };
  const deliver = (shipment) => {
    const receivedBy = window.prompt(`Who received ${shipment.shipmentNumber}?`) ?? "";
    if (!receivedBy.trim()) return;
    return run(`sh:${shipment.id}`, () => apiRequest(`/api/dispatch/shipments/${shipment.id}`, { method: "PATCH", body: JSON.stringify({ action: "deliver", receivedBy }) }));
  };
  const issueInvoice = (invoice) => {
    if (!window.confirm(`Approve invoice ${invoice.invoiceNumber}? The order goes to Orders, ready for production. An approved invoice cannot be edited; corrections need a credit note.`)) return;
    return run(`in:${invoice.id}`, () => apiRequest(`/api/finance/invoices/${invoice.id}`, { method: "PATCH", body: JSON.stringify({ action: "issue", reason: "" }) }));
  };

  if (!trace) {
    return <main className="inv-page">{error ? <p className="inv-dialog__error" role="alert">{error}</p> : <p className="inv-state" role="status">Loading order…</p>}</main>;
  }

  const { order, status, production, inspections, packingLists, shipments, gatePasses, invoices, receipts, money, deliveryLines = [], shortfalls = [] } = trace;
  const notes = trace.notes ?? [];
  const draftInvoice = invoices.find((row) => row.status === "DRAFT" && !row.shipmentId);
  const addNote = (step, note) => apiRequest(`/api/sales/orders/${encodeURIComponent(id)}/notes`, { method: "POST", body: JSON.stringify({ step, note }) }).then(load);
  const productionByLine = new Map(production.map((item) => [item.salesOrderLineId, item]));
  const linesWithout = order.lines.filter((line) => !production.some((item) => item.salesOrderLineId === line.id && item.status !== "CANCELLED"));
  const totalQuantity = order.lines.reduce((sum, line) => sum + Number(line.quantity), 0);
  const canRun = can("production:update") && can("production:complete");

  return (
    <main className="inv-page op-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/sales/orders">Orders</Link> / Order profile</p>
          <h1>Order {order.orderNumber} <span className={`op-badge op-badge--${STATUS_TONE[status] ?? "info"}`}>{status}</span></h1>
          <p><Link href={`/sales/customers/${order.customer.id}`}>{order.customer.name}</Link>{order.customerPo ? ` · PO ${order.customerPo}` : ""} · ordered {day(order.orderDate)}{order.deliveryDate ? ` · delivery ${day(order.deliveryDate)}` : ""}</p>
        </div>
        <div className="inv-header__actions">
          <Link className="inv-link-button" href={`/print/sales-orders/${order.id}`}><Printer size={15} /> Print order sheet</Link>
          <Link className="inv-link-button" href={`/print/sales-orders/${order.id}/costing`}><Printer size={15} /> Costing report</Link>
          {order.status === "DRAFT" && draftInvoice && can("finance:create") && <Link className="inv-link-button" href={`/finance/invoices/${draftInvoice.id}/edit`}><Pencil size={15} /> Edit</Link>}
          {order.status === "DRAFT" && draftInvoice && can("finance:create") && <Button variant="primary" loading={busy === `in:${draftInvoice.id}`} onClick={() => issueInvoice(draftInvoice)}>Approve invoice</Button>}
          {order.status === "DRAFT" && !draftInvoice && can("sales:update") && <Link className="inv-link-button" href={`/sales/orders/${order.id}/edit`}><Pencil size={15} /> Edit</Link>}
          {order.status === "DRAFT" && !draftInvoice && can("sales:approve") && <Button variant="primary" loading={busy === "approve"} onClick={() => changeStatus("approve")}>Confirm order</Button>}
          {order.status === "APPROVED" && linesWithout.length > 0 && can("production:create") && (
            <Button variant="primary" icon={Factory} loading={busy === "production"} onClick={toProduction}>Send to production</Button>
          )}
        </div>
      </header>

      {error && <p className="inv-dialog__error" role="alert">{error}</p>}


      <div className="op-grid">
        <Section title="Customer">
          <dl className="op-facts">
            <dt>Name</dt><dd>{order.customer.name}</dd>
            <dt>Address</dt><dd>{order.customer.address || "—"}</dd>
            <dt>Contact person</dt><dd>{order.customer.contactPerson || "—"}</dd>
            <dt>Contact no</dt><dd>{order.customer.phone || "—"}</dd>
            <dt>Email</dt><dd>{order.customer.email || "—"}</dd>
          </dl>
        </Section>
        <Section title="Payment">
          <dl className="op-facts">
            <dt>Invoiced</dt><dd>{formatAmount(money.invoiced)}</dd>
            <dt>Received</dt><dd>{formatAmount(money.paid)}</dd>
            <dt>Outstanding</dt><dd><strong>{formatAmount(money.outstanding)}</strong></dd>
          </dl>
          {order.notes && <p className="op-notes"><strong>Remarks:</strong> {order.notes}</p>}
        </Section>
      </div>

      <span id="step-payment" />
      <Section step="1" title="Invoice & payment" id="step-invoice">
        {invoices.length === 0 ? <Empty>No invoice for this order.</Empty> : (
          <ul className="op-list">
            {invoices.map((row) => (
              <li key={row.id}>
                <Link href={`/finance/invoices/${row.id}`}>{row.invoiceNumber}</Link> · {row.status.toLowerCase()} · {formatAmount(row.totalAmount)} · due {day(row.dueDate)} · <Link href={`/print/invoices/${row.id}`}>Print</Link>
                <span className="op-inline-actions">
                  {row.status === "DRAFT" && can("finance:create") && <Link className="inv-link-button" href={`/finance/invoices/${row.id}/edit`}>Edit</Link>}
                  {row.status === "DRAFT" && can("finance:create") && <Button size="sm" variant="primary" loading={busy === `in:${row.id}`} onClick={() => issueInvoice(row)}>Approve invoice</Button>}
                  {row.status === "ISSUED" && Number(money.outstanding) > 0 && can("finance:create") && <Button size="sm" variant="secondary" onClick={() => setDialog({ type: "receipt", invoiceId: row.id })}>Record payment</Button>}
                </span>
                {receipts.filter((receipt) => receipt.invoiceId === row.id).map((receipt) => (
                  <span key={receipt.id}> · paid {formatAmount(receipt.amount)} on {day(receipt.receiptDate)} ({receipt.receiptNumber})</span>
                ))}
              </li>
            ))}
          </ul>
        )}
        <StepNotes steps={["invoice", "payment"]} notes={notes} onAdd={addNote} />
      </Section>

      <Section step="2" title="Order sheet" id="step-order">
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead>
              <tr><th>#</th><th>Product</th><th>Variant</th><th>Finish</th><th>Type</th><th>Tape color</th><th>Slider</th><th>Size</th><th className="inv-num">Quantity</th><th>Production</th></tr>
            </thead>
            <tbody>
              {order.lines.map((line, index) => {
                const item = productionByLine.get(line.id);
                return (
                  <tr key={line.id}>
                    <td data-label="#">{index + 1}</td>
                    <td data-label="Product">{line.productName}</td>
                    <td data-label="Variant">{line.variant || "—"}</td>
                    <td data-label="Finish">{line.finish || "—"}</td>
                    <td data-label="Type">{line.teethType || "—"}</td>
                    <td data-label="Tape color">{line.tapeColor || "—"}</td>
                    <td data-label="Slider">{line.slider || "—"}</td>
                    <td data-label="Size">{line.size || "—"}</td>
                    <td data-label="Quantity" className="inv-num">{qty(line.quantity)} {line.unit}</td>
                    <td data-label="Production">{item ? <a href={`#po-${item.id}`}>{item.orderNumber}</a> : "Not sent"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot><tr><td colSpan={8}>Total</td><td className="inv-num">{qty(totalQuantity)}</td><td /></tr></tfoot>
          </table>
        </div>
        <StepNotes steps={["order"]} notes={notes} onAdd={addNote} />
      </Section>

      <Section step="3" title="Production" id="step-production">
        {order.status === "DRAFT" && <Empty>Confirm the order first, then send it to production.</Empty>}
        {order.status === "APPROVED" && production.length === 0 && <Empty>Confirmed. Press “Send to production” to open a production order for each line.</Empty>}
        {production.map((item) => (
          <div key={item.id} id={`po-${item.id}`} className="op-production">
            <div className="op-production__head">
              <div>
                <Link href={`/production/orders/${item.id}`}><strong>{item.orderNumber}</strong></Link>
                <span> · {item.productName} · {qty(item.quantity)} {item.unit}{item.tapeKg ? ` · tape ${qty(item.tapeKg)} kg` : ""}</span>
              </div>
              <span className="op-progress">{Math.round(Number(item.progress) || 0)}% · {item.status.replace(/_/g, " ").toLowerCase()}</span>
            </div>
            <div className="inv-table-wrap">
              <table className="inv-table op-stages">
                <thead><tr><th>Stage</th><th>Status</th><th>Start</th><th>End</th><th className="inv-num">Quantity</th><th /></tr></thead>
                <tbody>
                  {item.stages.map((stage, index) => (
                    <StageRow
                      key={stage.stageKey}
                      order={item}
                      stage={stage}
                      index={index}
                      canRun={canRun}
                      busy={busy === `${item.id}:${stage.stageKey}`}
                      onStart={(key) => stageAction(item.id, key, "start")}
                      onChecks={(stage) => setDialog({ type: "checks", productionOrderId: item.id, stageKey: stage.stageKey })}
                      onManaged={(managedBy) => setDialog(managedBy === "quality" ? { type: "qc", productionOrderId: item.id }
                        : managedBy === "packing" ? { type: "packing", productionOrderId: item.id } : { type: "ship" })}
                      onComplete={(key) => stageComplete(item.id, key)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="op-sub">
              Raw material issued:{" "}
              {item.materialIssues.length === 0
                ? <>none yet · <Link href="/production/material-issue">Issue raw material</Link></>
                : item.materialIssues.map((issue, index) => (
                  <span key={issue.id}>{index > 0 && ", "}<Link href={`/print/stock-documents/${issue.id}`}>{issue.documentNumber}</Link> ({day(issue.postedAt)})</span>
                ))}
            </p>
          </div>
        ))}
        <StepNotes steps={["production"]} notes={notes} onAdd={addNote} />
      </Section>

      <Section step="4" title="Quality check" id="step-qc">
        {inspections.length === 0 ? <Empty>No inspection yet. Press Record QC at the Quality Check stage above.</Empty> : (
          <ul className="op-list">
            {inspections.map((row) => (
              <li key={row.id}>
                <Link href={`/quality/inspections/${row.id}`}>{row.inspectionNumber}</Link> · {row.status.toLowerCase()} · passed {qty(row.passedQuantity)}, rejected {qty(row.rejectedQuantity)} · {day(row.createdAt)}
                {row.status === "OPEN" && can("quality:approve") && (
                  <span className="op-inline-actions">
                    <Button size="sm" variant="primary" loading={busy === `qc:${row.id}`} onClick={() => decide(row, "approve")}>Approve</Button>
                    <button type="button" className="inv-text-button" onClick={() => decide(row, "cancel")}>Cancel</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <StepNotes steps={["qc"]} notes={notes} onAdd={addNote} />
      </Section>

      <Section step="5" title="Packing" id="step-packing" action={packingLists.some((row) => row.status !== "CANCELLED") ? <Link className="inv-link-button" href={`/print/sales-orders/${order.id}/packing`}><Printer size={15} /> Print packing list (whole order)</Link> : null}>
        {packingLists.length === 0 ? <Empty>No packing list yet.</Empty> : (
          <ul className="op-list">
            {packingLists.map((row) => (
              <li key={row.id}>
                <Link href={`/packing/orders/${row.id}`}>{row.packingNumber}</Link> · {row.status === "CONFIRMED" ? "passed" : row.status.toLowerCase()} · {qty(row.totalQuantity)} in {row.packageCount} bag(s) / carton(s) · <Link href={`/print/packing-lists/${row.id}`}>Print</Link>
                {row.status === "DRAFT" && canRun && (
                  <span className="op-inline-actions">
                    <Button size="sm" variant="primary" loading={busy === `pk:${row.id}`} onClick={() => packingAction(row, "confirm")}>Pass packing</Button>
                    <button type="button" className="inv-text-button" onClick={() => packingAction(row, "cancel")}>Cancel</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <StepNotes steps={["packing"]} notes={notes} onAdd={addNote} />
      </Section>

      <Section step="6" title="Dispatch & gate pass" id="step-dispatch" action={order.status === "APPROVED" && packingLists.some((row) => row.status === "CONFIRMED") && can("dispatch:create") ? <Button size="sm" variant="secondary" onClick={() => setDialog({ type: "ship" })}>New shipment</Button> : null}>
        {shipments.length === 0 ? <Empty>Nothing dispatched yet.</Empty> : (
          <ul className="op-list">
            {shipments.map((row) => (
              <li key={row.id}>
                <Link href={`/dispatch/shipments/${row.id}`}>{row.shipmentNumber}</Link> · {row.status.toLowerCase()}{row.vehicleNumber ? ` · vehicle ${row.vehicleNumber}` : ""}{row.dispatchedAt ? ` · dispatched ${day(row.dispatchedAt)}` : ""}{row.deliveredAt ? ` · delivered ${day(row.deliveredAt)}` : ""}
                {gatePasses.filter((pass) => pass.shipmentId === row.id).map((pass) => (
                  <span key={pass.id}> · gate pass <Link href={`/print/gate-passes/${pass.id}`}>{pass.passNumber}</Link> ({pass.status === "COMPLETED" ? "passed" : pass.status.toLowerCase()})</span>
                ))}
                <span className="op-inline-actions">
                  {row.status === "DISPATCHED" && can("inventory:create") && gatePasses.filter((pass) => pass.shipmentId === row.id && ["DRAFT", "APPROVED"].includes(pass.status)).map((pass) => (
                    <Button key={pass.id} size="sm" variant="primary" loading={busy === `gp:${pass.id}`} onClick={() => passGate(pass)}>Pass gate · delivered</Button>
                  ))}
                  {row.status === "DRAFT" && can("dispatch:ship") && <Button size="sm" variant="primary" loading={busy === `sh:${row.id}`} onClick={() => dispatchShipment(row)}>Dispatch &amp; make gate pass</Button>}
                  {row.dispatchedAt && !gatePasses.some((pass) => pass.shipmentId === row.id) && <Button size="sm" variant="secondary" loading={busy === `gp:${row.id}`} onClick={() => makeGatePass(row)}>Make gate pass</Button>}
                  {row.status === "DISPATCHED" && can("dispatch:update") && <Button size="sm" variant="secondary" loading={busy === `sh:${row.id}`} onClick={() => deliver(row)}>Mark delivered</Button>}
                </span>
              </li>
            ))}
          </ul>
        )}
        {deliveryLines.length > 0 && shipments.some((row) => row.status !== "CANCELLED") && (
          <div className="inv-table-wrap" style={{ marginTop: 10 }}>
            <table className="inv-table">
              <thead><tr><th>Item</th><th className="inv-num">Ordered</th><th className="inv-num">Dispatched</th><th className="inv-num">Delivered</th><th className="inv-num">Left (shortfall)</th><th /></tr></thead>
              <tbody>
                {deliveryLines.map((line) => (
                  <tr key={line.productId}>
                    <td data-label="Item">{line.sku ?? line.productName}</td>
                    <td data-label="Ordered" className="inv-num">{qty(line.ordered)} {line.unit}</td>
                    <td data-label="Dispatched" className="inv-num">{qty(line.shipped)}</td>
                    <td data-label="Delivered" className="inv-num">{qty(line.delivered)}</td>
                    <td data-label="Left (shortfall)" className="inv-num">{Number(line.left) > 0 ? <strong>{qty(line.left)}</strong> : "—"}</td>
                    <td data-label="">{Number(line.left) > 0 && can("sales:update") && <button type="button" className="inv-link-button" onClick={() => setDialog({ type: "shortfall", line })}>Note reason</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {shortfalls.length > 0 && (
          <ul className="op-list" style={{ marginTop: 8 }}>
            {shortfalls.map((row) => {
              const line = deliveryLines.find((item) => item.productId === row.productId);
              return (
                <li key={row.id}>
                  Shortfall {qty(row.quantity)} {row.unit} {line?.sku ? `of ${line.sku}` : ""} · {SHORTFALL_REASON[row.reason] ?? row.reason}{row.notes ? ` · ${row.notes}` : ""} · {row.status === "OPEN" ? (Number(row.resolvedQuantity) > 0 ? `${qty(row.resolvedQuantity)} delivered since` : "to send later") : row.status === "RESOLVED" ? `delivered later ${day(row.resolvedAt)}` : "removed"} · noted {day(row.createdAt)}
                  {row.status === "OPEN" && can("sales:update") && <span className="op-inline-actions"><button type="button" className="inv-link-button" onClick={() => cancelShortfall(row)}>Remove</button></span>}
                </li>
              );
            })}
          </ul>
        )}
        <StepNotes steps={["dispatch"]} notes={notes} onAdd={addNote} />
      </Section>

      {dialog?.type === "checks" && (() => {
        const item = production.find((row) => row.id === dialog.productionOrderId);
        const stage = item?.stages.find((row) => row.stageKey === dialog.stageKey);
        if (!item || !stage) return null;
        const readOnly = stage.status !== "IN_PROGRESS" || !canRun;
        return (
          <StageChecklistDialog
            key={`${item.id}:${stage.stageKey}:${stage.status}`}
            order={item}
            stage={stage}
            readOnly={readOnly}
            needsKg={stage.stageKey === "tape-dyeing" && !item.tapeKg}
            onClose={() => setDialog(null)}
            onSaved={load}
            onComplete={({ note, totalQuantity }) => apiRequest(`/api/production/orders/${item.id}/stages/${stage.stageKey}/simple`, {
              method: "POST",
              body: JSON.stringify({ action: "complete", note, ...(totalQuantity ? { totalQuantity } : {}) }),
            }).then(load)}
          />
        );
      })()}
      {dialog?.type === "qc" && (
        <InspectionDialog fixedType="FINAL" initialOrderId={dialog.productionOrderId} onClose={() => setDialog(null)} onCreated={() => { setDialog(null); load(); }} />
      )}
      {dialog?.type === "packing" && (() => {
        const item = production.find((row) => row.id === dialog.productionOrderId);
        const line = order.lines.find((row) => row.id === item?.salesOrderLineId);
        return (
          <PackingListDialog
            initialOrderId={dialog.productionOrderId}
            defaults={{
              description: line ? [line.productName, line.variant].filter(Boolean).join(" ") : item?.productName,
              size: line?.size ?? "",
              customerPo: order.customerPo ?? "",
              orderNumber: order.orderNumber,
            }}
            onClose={() => setDialog(null)}
            onCreated={() => { setDialog(null); load(); }}
          />
        );
      })()}
      {dialog?.type === "receipt" && <ReceiptLoader invoiceId={dialog.invoiceId} onClose={() => setDialog(null)} onDone={() => { setDialog(null); load(); }} />}
      {dialog?.type === "shortfall" && (
        <ShortfallDialog order={order} line={dialog.line} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); load(); }} />
      )}
      {dialog?.type === "ship" && (
        <ShipmentDialog initialSalesOrderId={order.id} onClose={() => setDialog(null)} onCreated={() => { setDialog(null); load(); }} />
      )}
    </main>
  );
}
