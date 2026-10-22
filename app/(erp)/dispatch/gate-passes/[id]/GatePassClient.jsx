"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { GatePassStatusBadge, PASS_TYPES } from "@/components/gate/gatePassUi";
import { apiRequest } from "@/lib/api/client";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

function when(value) {
  return value ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "";
}

export default function GatePassClient({ id }) {
  const pass = useApiData(`/api/gate-passes/${id}`);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState("");
  const [guardName, setGuardName] = useState("");
  const [returns, setReturns] = useState({});
  const data = pass.data;

  async function act(action, body = {}) {
    if (busy) return;
    setBusy(action);
    setError("");
    try {
      await apiRequest(`/api/gate-passes/${id}`, { method: "PATCH", body: JSON.stringify({ action, ...body }) });
      setDialog("");
      pass.reload();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy("");
    }
  }

  async function recordReturn(event) {
    event.preventDefault();
    const lines = Object.entries(returns).filter(([, quantity]) => Number(quantity) > 0).map(([lineId, quantity]) => ({ lineId, quantity: Number(quantity) }));
    if (!lines.length || busy) return;
    setBusy("return");
    setError("");
    try {
      await apiRequest(`/api/gate-passes/${id}/returns`, { method: "POST", body: JSON.stringify({ lines }) });
      setReturns({});
      setDialog("");
      pass.reload();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy("");
    }
  }

  if (pass.error && !data) return <main className="inv-page"><p className="inv-dialog__error" role="alert">{pass.error}</p></main>;
  if (!data) return <main className="inv-page"><p className="inv-state" role="status">Loading gate pass…</p></main>;
  const outward = data.passType !== "INWARD";

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/dispatch/gate-passes">Gate passes</Link></p>
          <h1>{data.passNumber} <GatePassStatusBadge status={data.status} overdue={data.overdue} /></h1>
          <p>{PASS_TYPES[data.passType]} · {data.partyName} · {data.purpose}{data.vehicleNumber ? ` · vehicle ${data.vehicleNumber}` : ""}{data.expectedReturnDate ? ` · return by ${data.expectedReturnDate}` : ""}</p>
        </div>
        <div className="inv-header__actions">
          {["DRAFT", "APPROVED"].includes(data.status) && (
            <Button variant="secondary" loading={busy === "cancel"} onClick={() => { const reason = window.prompt("Reason for cancelling") ?? ""; if (reason.trim()) act("cancel", { reason }); }}>Cancel</Button>
          )}
          {data.status === "DRAFT" && <Button variant="primary" loading={busy === "approve"} onClick={() => act("approve")}>Approve</Button>}
          {data.status === "APPROVED" && <Button variant="primary" onClick={() => setDialog("gate")}>{outward ? "Record gate exit" : "Record gate entry"}</Button>}
          {data.status === "OUT" && <Button variant="primary" onClick={() => setDialog("return")}>Record return</Button>}
          <Link className="inv-link-button" href={`/print/gate-passes/${data.id}`}>Print gate pass</Link>
        </div>
      </header>
      {error && <p className="inv-dialog__error" role="alert">{error}</p>}

      <section className="inv-card">
        <div className="inv-card__header"><h2>Items</h2>{data.shipmentNumber && <small>From shipment <Link href={`/dispatch/shipments/${data.shipmentId}`}>{data.shipmentNumber}</Link></small>}</div>
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead><tr><th className="inv-num">#</th><th>Item</th><th className="inv-num">Quantity</th>{data.passType === "OUTWARD_RETURNABLE" && <><th className="inv-num">Returned</th><th className="inv-num">Still out</th></>}</tr></thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={line.id}>
                  <td data-label="#" className="inv-num">{line.lineNo}</td>
                  <td data-label="Item">{line.description}</td>
                  <td data-label="Quantity" className="inv-num">{line.quantity} {line.unit}</td>
                  {data.passType === "OUTWARD_RETURNABLE" && <><td data-label="Returned" className="inv-num">{line.returnedQuantity}</td><td data-label="Still out" className={`inv-num ${Number(line.outstanding) > 0 ? "inv-neg" : ""}`}>{line.outstanding}</td></>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="inv-card">
        <div className="inv-card__header"><h2>Record</h2></div>
        <ul style={{ margin: 0, padding: "12px 32px", fontSize: 13 }}>
          <li>Created {when(data.createdAt)}{data.createdByName ? ` by ${data.createdByName}` : ""}</li>
          {data.approvedAt && <li>Approved {when(data.approvedAt)}{data.approvedByName ? ` by ${data.approvedByName}` : ""}</li>}
          {data.passedAt && <li>{outward ? "Left" : "Entered"} through the gate {when(data.passedAt)} · guard {data.guardName}</li>}
          {data.closedAt && <li>Completed {when(data.closedAt)}</li>}
          {data.cancelledAt && <li>Cancelled {when(data.cancelledAt)}{data.cancelledByName ? ` by ${data.cancelledByName}` : ""} · {data.cancelReason}</li>}
          {data.notes && <li>Notes: {data.notes}</li>}
        </ul>
      </section>

      {dialog === "gate" && (
        <Modal open onClose={() => setDialog("")} title={outward ? "Record gate exit" : "Record gate entry"} description="Records the time and the guard. This cannot be undone." size="medium">
          <form className="inv-dialog" onSubmit={(event) => { event.preventDefault(); act("pass", { guardName }); }}>
            <div className="inv-field"><label htmlFor="gp-guard">Guard *</label><input id="gp-guard" required maxLength={120} value={guardName} onChange={(event) => setGuardName(event.target.value)} /></div>
            {error && <p className="inv-dialog__error" role="alert">{error}</p>}
            <div className="inv-dialog__actions">
              <Button variant="secondary" onClick={() => setDialog("")}>Cancel</Button>
              <Button type="submit" variant="primary" loading={busy === "pass"} disabled={!guardName.trim()}>Record</Button>
            </div>
          </form>
        </Modal>
      )}
      {dialog === "return" && (
        <Modal open onClose={() => setDialog("")} title="Record returned items" description="Enter what came back now. The pass completes when every item is back." size="large">
          <form className="inv-dialog" onSubmit={recordReturn}>
            {data.lines.filter((line) => Number(line.outstanding) > 0).map((line) => (
              <div key={line.id} className="inv-field">
                <label htmlFor={`rt-${line.id}`}>{line.description} (still out {line.outstanding} {line.unit})</label>
                <input id={`rt-${line.id}`} type="number" step="any" min="0" max={line.outstanding} value={returns[line.id] ?? ""} onChange={(event) => setReturns((current) => ({ ...current, [line.id]: event.target.value }))} />
              </div>
            ))}
            {error && <p className="inv-dialog__error" role="alert">{error}</p>}
            <div className="inv-dialog__actions">
              <Button variant="secondary" onClick={() => setDialog("")}>Cancel</Button>
              <Button type="submit" variant="primary" loading={busy === "return"}>Record return</Button>
            </div>
          </form>
        </Modal>
      )}
    </main>
  );
}

