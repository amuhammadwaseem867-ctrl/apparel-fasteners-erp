"use client";

/*
 * Check points and completion of one production stage (D-040). The
 * operator marks each check point Pass, Fail or N/A (N/A only where it is
 * optional), enters measured values, leaves a note, and completes the
 * stage. Completion stays blocked while a required check is missing or a
 * check has failed; the server enforces the same rule.
 */

import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { apiRequest } from "@/lib/api/client";

import "./StageChecklistDialog.css";

const RESULTS = [["PASS", "Pass"], ["FAIL", "Fail"], ["NA", "N/A"]];

/* Same rule as the server's checksProblem, for the live state of the form. */
function blocker(points, values) {
  const failed = points.filter((point) => values[point.key]?.result === "FAIL");
  if (failed.length) return `Failed: ${failed.map((point) => point.label).join("; ")}. Fix it and check again before completing.`;
  const missing = points.filter((point) => point.required && !["PASS", "NA"].includes(values[point.key]?.result ?? ""));
  if (missing.length) return `${missing.length} required check${missing.length === 1 ? "" : "s"} still to record.`;
  return null;
}

export default function StageChecklistDialog({ order, stage, needsKg = false, readOnly = false, onClose, onComplete, onSaved }) {
  const points = stage.checks?.points ?? [];
  const [values, setValues] = useState(() => Object.fromEntries(points.map((point) => [point.key, { result: point.result ?? "", value: point.value ?? "", note: point.note ?? "" }])));
  const [kg, setKg] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const set = (key, field, value) => setValues((current) => ({ ...current, [key]: { ...current[key], [field]: value } }));
  const problem = blocker(points, values);
  const changed = points.filter((point) => {
    const now = values[point.key];
    return now.result && (now.result !== (point.result ?? "") || now.value !== (point.value ?? "") || now.note !== (point.note ?? ""));
  });

  async function saveChecks() {
    if (!changed.length) return;
    await apiRequest(`/api/production/orders/${order.id}/stages/${stage.stageKey}/checks`, {
      method: "POST",
      body: JSON.stringify({ results: changed.map((point) => ({ key: point.key, result: values[point.key].result, value: values[point.key].value || undefined, note: values[point.key].note || undefined })) }),
    });
  }

  async function run(kind) {
    if (busy) return;
    setBusy(kind);
    setError("");
    try {
      await saveChecks();
      if (kind === "complete") await onComplete({ note: note.trim() || undefined, totalQuantity: needsKg ? Number(kg) : undefined });
      else onSaved?.();
      onClose();
    } catch (cause) {
      setError(cause.message);
      // Saved checks still count; show the latest state when the dialog closes.
      onSaved?.();
    } finally {
      setBusy("");
    }
  }

  return (
    <Modal open onClose={busy ? undefined : onClose} title={`${stage.sequence ?? ""}${stage.sequence ? ". " : ""}${stage.label}: check points`} description={`${order.orderNumber} · ${order.productName ?? ""}`} size="large">
      <form className="inv-dialog" onSubmit={(event) => { event.preventDefault(); run("complete"); }}>
        {points.length === 0 ? (
          <p className="inv-state">This stage has no check points. Add them in Settings → Production check points.</p>
        ) : (
          <div className="sc-list">
            {points.map((point) => {
              const current = values[point.key];
              return (
                <fieldset key={point.key} className={`sc-point sc-point--${(current.result || "open").toLowerCase()}`}>
                  <legend>
                    {point.label}
                    {point.required ? <span className="sc-required">Required</span> : <span className="sc-optional">Optional</span>}
                  </legend>
                  {(point.limit || point.unit) && <p className="sc-limit">{point.limit ? `Limit: ${point.limit}` : ""}{point.limit && point.unit ? " · " : ""}{point.unit ? `Unit: ${point.unit}` : ""}</p>}
                  <div className="sc-row">
                    <div className="sc-results" role="radiogroup" aria-label={`${point.label} result`}>
                      {RESULTS.filter(([result]) => result !== "NA" || !point.required).map(([result, label]) => (
                        <label key={result} className={`sc-result sc-result--${result.toLowerCase()} ${current.result === result ? "is-on" : ""}`}>
                          <input type="radio" disabled={readOnly} name={`sc-${point.key}`} value={result} checked={current.result === result} onChange={() => set(point.key, "result", result)} />
                          {label}
                        </label>
                      ))}
                    </div>
                    {point.kind === "measure" && (
                      <input className="sc-value" disabled={readOnly} aria-label={`${point.label} measured value`} placeholder={`Measured${point.unit ? ` (${point.unit})` : ""}`} maxLength={60} value={current.value} onChange={(event) => set(point.key, "value", event.target.value)} />
                    )}
                    <input className="sc-note" disabled={readOnly} aria-label={`${point.label} note`} placeholder={current.result === "FAIL" ? "What was wrong? (required)" : "Note (optional)"} maxLength={500} value={current.note} onChange={(event) => set(point.key, "note", event.target.value)} />
                  </div>
                  {point.checkedByName && <small className="sc-by">Last checked by {point.checkedByName}, {new Date(point.checkedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</small>}
                </fieldset>
              );
            })}
          </div>
        )}

        {!readOnly && needsKg && (
          <div className="inv-field">
            <label htmlFor="sc-kg">Total tape quantity (kg) *</label>
            <input id="sc-kg" required type="number" min="0.001" step="0.001" inputMode="decimal" value={kg} onChange={(event) => setKg(event.target.value)} />
          </div>
        )}
        {readOnly ? (stage.completionNote && <p className="sc-limit"><strong>Completion note:</strong> {stage.completionNote}</p>) : (
        <div className="inv-field">
          <label htmlFor="sc-note">Completion note</label>
          <textarea id="sc-note" rows={2} maxLength={1000} placeholder="Anything the next stage or management should know (lot, machine, operator, issue fixed…)" value={note} onChange={(event) => setNote(event.target.value)} />
        </div>
        )}

        {!readOnly && <p className={`sc-status ${problem ? "sc-status--blocked" : "sc-status--ok"}`} role="status">
          {problem ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          {problem ? `Blocked: ${problem}` : "All checks done. The stage can be completed."}
        </p>}
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={Boolean(busy)}>Close</Button>
          {!readOnly && points.length > 0 && <Button variant="secondary" loading={busy === "save"} disabled={!changed.length || Boolean(busy)} onClick={() => run("save")}>Save checks</Button>}
          {!readOnly && <Button type="submit" variant="primary" loading={busy === "complete"} disabled={Boolean(problem) || Boolean(busy)}>Complete stage</Button>}
        </div>
      </form>
    </Modal>
  );
}
