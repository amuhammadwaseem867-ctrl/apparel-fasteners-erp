"use client";

/*
 * Order Profile (requirements 1.2, sections 4, 18 and 21): one page that
 * follows an order from placement to payment. Status, the order sheet
 * (no prices), each production order with its nine stages and simple
 * Start / Complete buttons, raw material issued, QC, packing, dispatch,
 * gate passes, invoices and payments, each with the next step to take.
 */

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Circle, Factory, Pencil, PlayCircle, Printer } from "lucide-react";

import Button from "@/components/ui/Button";
import PackingListDialog from "@/components/packing/PackingListDialog";
import ShipmentDialog from "@/components/dispatch/ShipmentDialog";
import { formatAmount } from "@/components/finance/financeUi";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";
import "./OrderProfile.css";

const PHASES = ["New", "Confirmed", "In Production", "QC Pending", "QC Approved", "Packing", "Ready for Delivery", "Delivered"];
const STATUS_TONE = { New: "draft", Confirmed: "info", "In Production": "info", "On Hold": "warn", "QC Pending": "warn", "QC Approved": "ok", Packing: "info", "Ready for Delivery": "ok", Delivered: "ok", Cancelled: "bad" };
const STAGE_STATUS = { PENDING: "Not started", IN_PROGRESS: "In progress", COMPLETED: "Done", SKIPPED: "Skipped" };

const day = (value) => (value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const when = (value) => (value ? new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const qty = (value) => (value === null || value === undefined || value === "" ? "—" : Number(value).toLocaleString("en-US", { maximumFractionDigits: 3 }));

function Section({ title, step, children, action }) {
  return (
    <section className="inv-card op-section">
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

function StageRow({ order, stage, index, canRun, busy, onStart, onComplete, onPacking, onShip }) {
  const [kg, setKg] = useState("");
  const previousDone = index === 0 || order.stages[index - 1].status === "COMPLETED";
  const running = ["RELEASED", "IN_PROGRESS"].includes(order.status);
  const needsKg = stage.stageKey === "tape-dyeing" && !order.tapeKg;
  const done = stage.status === "COMPLETED";

  let action = null;
  if (!done && running && previousDone) {
    if (stage.managedBy === "quality") {
      action = <Link className="inv-link-button" href={`/quality/final?productionOrderId=${order.id}`}>Record QC</Link>;
    } else if (stage.managedBy === "packing") {
      action = <Button size="sm" variant="secondary" onClick={onPacking}>Make packing list</Button>;
    } else if (stage.managedBy === "dispatch") {
      action = <Button size="sm" variant="secondary" onClick={onShip}>Dispatch</Button>;
    } else if (canRun && stage.status === "PENDING") {
      action = <Button size="sm" variant="secondary" loading={busy} onClick={() => onStart(stage.stageKey)}>Start</Button>;
    } else if (canRun && stage.status === "IN_PROGRESS") {
      action = (
        <form className="op-complete" onSubmit={(event) => { event.preventDefault(); onComplete(stage.stageKey, needsKg ? kg : undefined); }}>
          {needsKg && <input required type="number" min="0.001" step="0.001" inputMode="decimal" placeholder="Total kg" aria-label="Total quantity in kg" value={kg} onChange={(event) => setKg(event.target.value)} />}
          <Button type="submit" size="sm" variant="primary" loading={busy}>Complete</Button>
        </form>
      );
    }
  }

  return (
    <tr className={done ? "op-stage--done" : stage.status === "IN_PROGRESS" ? "op-stage--active" : ""}>
      <td data-label="Stage">
        <span className="op-stage-name">{done ? <CheckCircle2 size={16} /> : stage.status === "IN_PROGRESS" ? <PlayCircle size={16} /> : <Circle size={16} />}{index + 1}. {stage.label}</span>
      </td>
      <td data-label="Status">{STAGE_STATUS[stage.status] ?? stage.status}</td>
      <td data-label="Start">{when(stage.startedAt)}</td>
      <td data-label="End">{when(stage.completedAt)}</td>
      <td data-label="Quantity" className="inv-num">{Number(stage.acceptedQuantity) > 0 ? `${qty(stage.acceptedQuantity)} ${stage.unit}` : "—"}</td>
      <td data-label="">{action}</td>
    </tr>
  );
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

  if (!trace) {
    return <main className="inv-page">{error ? <p className="inv-dialog__error" role="alert">{error}</p> : <p className="inv-state" role="status">Loading order…</p>}</main>;
  }

  const { order, status, production, inspections, packingLists, shipments, gatePasses, invoices, receipts, money } = trace;
  const phaseIndex = PHASES.indexOf(status);
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
          <p>{order.customer.name}{order.customerPo ? ` · PO ${order.customerPo}` : ""} · ordered {day(order.orderDate)}{order.deliveryDate ? ` · delivery ${day(order.deliveryDate)}` : ""}</p>
        </div>
        <div className="inv-header__actions">
          <Link className="inv-link-button" href={`/print/sales-orders/${order.id}`}><Printer size={15} /> Print order sheet</Link>
          {order.status === "DRAFT" && can("sales:update") && <Link className="inv-link-button" href={`/sales/orders/${order.id}/edit`}><Pencil size={15} /> Edit</Link>}
          {order.status === "DRAFT" && can("sales:approve") && <Button variant="primary" loading={busy === "approve"} onClick={() => changeStatus("approve")}>Confirm order</Button>}
          {order.status === "APPROVED" && linesWithout.length > 0 && can("production:create") && (
            <Button variant="primary" icon={Factory} loading={busy === "production"} onClick={toProduction}>Send to production</Button>
          )}
        </div>
      </header>

      {error && <p className="inv-dialog__error" role="alert">{error}</p>}

      {status !== "Cancelled" && status !== "On Hold" && (
        <ol className="op-phases" aria-label="Order progress">
          {PHASES.map((phase, index) => (
            <li key={phase} className={index < phaseIndex ? "is-done" : index === phaseIndex ? "is-current" : ""}>{phase}</li>
          ))}
        </ol>
      )}

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

      <Section step="1" title="Order sheet">
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
      </Section>

      <Section step="2" title="Production">
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
                      onComplete={(key, kg) => stageAction(item.id, key, "complete", kg)}
                      onPacking={() => setDialog({ type: "packing", productionOrderId: item.id })}
                      onShip={() => setDialog({ type: "ship" })}
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
      </Section>

      <Section step="3" title="Quality check">
        {inspections.length === 0 ? <Empty>No inspection yet. QC is recorded at the Quality Check stage above.</Empty> : (
          <ul className="op-list">
            {inspections.map((row) => (
              <li key={row.id}><Link href={`/quality/inspections/${row.id}`}>{row.inspectionNumber}</Link> · {row.status.toLowerCase()} · passed {qty(row.passedQuantity)}, rejected {qty(row.rejectedQuantity)} · {day(row.createdAt)}</li>
            ))}
          </ul>
        )}
      </Section>

      <Section step="4" title="Packing">
        {packingLists.length === 0 ? <Empty>No packing list yet.</Empty> : (
          <ul className="op-list">
            {packingLists.map((row) => (
              <li key={row.id}><Link href={`/packing/orders/${row.id}`}>{row.packingNumber}</Link> · {row.status.toLowerCase()} · {qty(row.totalQuantity)} in {row.packageCount} package(s) · <Link href={`/print/packing-lists/${row.id}`}>Print</Link></li>
            ))}
          </ul>
        )}
      </Section>

      <Section step="5" title="Dispatch & gate pass" action={order.status === "APPROVED" && packingLists.some((row) => row.status === "CONFIRMED") && can("dispatch:create") ? <Button size="sm" variant="secondary" onClick={() => setDialog({ type: "ship" })}>New shipment</Button> : null}>
        {shipments.length === 0 ? <Empty>Nothing dispatched yet.</Empty> : (
          <ul className="op-list">
            {shipments.map((row) => (
              <li key={row.id}>
                <Link href={`/dispatch/shipments/${row.id}`}>{row.shipmentNumber}</Link> · {row.status.toLowerCase()}{row.vehicleNumber ? ` · vehicle ${row.vehicleNumber}` : ""}{row.dispatchedAt ? ` · dispatched ${day(row.dispatchedAt)}` : ""}{row.deliveredAt ? ` · delivered ${day(row.deliveredAt)}` : ""}
                {gatePasses.filter((pass) => pass.shipmentId === row.id).map((pass) => (
                  <span key={pass.id}> · gate pass <Link href={`/print/gate-passes/${pass.id}`}>{pass.passNumber}</Link></span>
                ))}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section step="6" title="Invoice & payment" action={shipments.some((row) => row.dispatchedAt) && can("finance:create") ? <Link className="inv-link-button" href="/finance/invoices">Make invoice</Link> : null}>
        {invoices.length === 0 ? <Empty>No invoice yet. An invoice is made from a dispatched shipment.</Empty> : (
          <ul className="op-list">
            {invoices.map((row) => (
              <li key={row.id}>
                <Link href={`/finance/invoices/${row.id}`}>{row.invoiceNumber}</Link> · {row.status.toLowerCase()} · {formatAmount(row.totalAmount)} · due {day(row.dueDate)} · <Link href={`/print/invoices/${row.id}`}>Print</Link>
                {receipts.filter((receipt) => receipt.invoiceId === row.id).map((receipt) => (
                  <span key={receipt.id}> · paid {formatAmount(receipt.amount)} on {day(receipt.receiptDate)} ({receipt.receiptNumber})</span>
                ))}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {dialog?.type === "packing" && (
        <PackingListDialog initialOrderId={dialog.productionOrderId} onClose={() => setDialog(null)} onCreated={() => { setDialog(null); load(); }} />
      )}
      {dialog?.type === "ship" && (
        <ShipmentDialog initialSalesOrderId={order.id} onClose={() => setDialog(null)} onCreated={() => { setDialog(null); load(); }} />
      )}
    </main>
  );
}
