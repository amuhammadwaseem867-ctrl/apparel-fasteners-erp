"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ItemPicker from "@/components/inventory/ItemPicker";
import { apiRequest } from "@/lib/api/client";

const newKey = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const blank = (dueDate = "") => ({ key: newKey(), item: null, quantity: "", dueDate, priority: "NORMAL", notes: "" });

/* Creates a plan, or replaces a draft plan's header and lines. */
export default function PlanEditor({ plan = null, onClose, onSaved }) {
  const [values, setValues] = useState({ title: plan?.title ?? "", periodStart: plan?.periodStart ?? "", periodEnd: plan?.periodEnd ?? "", notes: plan?.notes ?? "" });
  const [lines, setLines] = useState(() => (plan?.lines?.length
    ? plan.lines.filter((line) => line.status !== "CANCELLED").map((line) => ({ key: line.id, item: { id: line.productId, sku: line.sku, name: line.productName, unit: line.unit }, quantity: line.quantity, dueDate: line.dueDate, priority: line.priority, notes: line.notes }))
    : [blank()]));
  const [key] = useState(newKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (lineKey, patch) => setLines((current) => current.map((line) => (line.key === lineKey ? { ...line, ...patch } : line)));
  const valid = values.title.trim().length >= 3 && values.periodStart && values.periodEnd >= values.periodStart && lines.every((line) => line.item && Number(line.quantity) > 0 && line.dueDate);

  async function submit(event) {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    const body = { ...values, lines: lines.map((line) => ({ productId: line.item.id, quantity: Number(line.quantity), dueDate: line.dueDate, priority: line.priority, notes: line.notes })) };
    try {
      onSaved(await apiRequest(plan ? `/api/planning/production-plans/${plan.id}` : "/api/planning/production-plans", { method: plan ? "PUT" : "POST", body: JSON.stringify(plan ? body : { ...body, idempotencyKey: key }) }));
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title={plan ? `Edit ${plan.planNumber}` : "New production plan"} description="Lines are released into production orders after the plan is approved." size="large">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          <div className="inv-field"><label htmlFor="pl-title">Title *</label><input id="pl-title" required minLength={3} maxLength={120} value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} /></div>
          <div className="inv-field"><label htmlFor="pl-start">Period start *</label><input id="pl-start" type="date" required value={values.periodStart} onChange={(event) => setValues({ ...values, periodStart: event.target.value })} /></div>
          <div className="inv-field"><label htmlFor="pl-end">Period end *</label><input id="pl-end" type="date" required min={values.periodStart} value={values.periodEnd} onChange={(event) => setValues({ ...values, periodEnd: event.target.value })} /></div>
        </div>
        {lines.map((line, index) => (
          <div key={line.key} className="inv-dialog__grid" style={{ alignItems: "end", borderBottom: "1px solid #e5e7eb", paddingBottom: 8 }}>
            <ItemPicker label={`Item ${index + 1}`} required value={line.item} onChange={(item) => update(line.key, { item })} />
            <div className="inv-field"><label htmlFor={`pl-q-${line.key}`}>Quantity{line.item ? ` (${line.item.unit})` : ""} *</label><input id={`pl-q-${line.key}`} type="number" min="0" step="any" required value={line.quantity} onChange={(event) => update(line.key, { quantity: event.target.value })} /></div>
            <div className="inv-field"><label htmlFor={`pl-d-${line.key}`}>Due *</label><input id={`pl-d-${line.key}`} type="date" required min={values.periodStart} max={values.periodEnd} value={line.dueDate} onChange={(event) => update(line.key, { dueDate: event.target.value })} /></div>
            <div className="inv-field"><label htmlFor={`pl-p-${line.key}`}>Priority</label><select id={`pl-p-${line.key}`} value={line.priority} onChange={(event) => update(line.key, { priority: event.target.value })}><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></div>
            <div className="inv-field"><button type="button" className="inv-link-button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}>Remove</button></div>
          </div>
        ))}
        <button type="button" className="inv-link-button" onClick={() => setLines((current) => [...current, blank(values.periodEnd)])}>+ Add line</button>
        <div className="inv-field"><label htmlFor="pl-notes">Notes</label><textarea id="pl-notes" rows={2} maxLength={1000} value={values.notes} onChange={(event) => setValues({ ...values, notes: event.target.value })} /></div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!valid}>{plan ? "Save plan" : "Create plan"}</Button>
        </div>
      </form>
    </Modal>
  );
}
