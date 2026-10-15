"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { RunStatusBadge } from "@/components/people/peopleUi";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import { formatAmount } from "@/lib/formatters/formatters";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

function AdjustDialog({ run, line, onClose, onSaved }) {
  const [values, setValues] = useState({ otherEarning: line.otherEarning, otherDeduction: line.otherDeduction, adjustmentNote: line.adjustmentNote ?? "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      onSaved(await apiRequest(`/api/payroll/runs/${run.id}/lines/${line.id}`, {
        method: "PUT",
        body: JSON.stringify({ otherEarning: Number(values.otherEarning || 0), otherDeduction: Number(values.otherDeduction || 0), adjustmentNote: values.adjustmentNote }),
      }));
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title={`Adjust ${line.employeeName}`} description="A one-off earning (e.g. bonus) or deduction (e.g. canteen) for this month. Net pay cannot go below zero." size="medium">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          <div className="inv-field"><label htmlFor="aj-earn">Other earning</label><input id="aj-earn" type="number" min="0" step="0.01" value={values.otherEarning} onChange={set("otherEarning")} /></div>
          <div className="inv-field"><label htmlFor="aj-ded">Other deduction</label><input id="aj-ded" type="number" min="0" step="0.01" value={values.otherDeduction} onChange={set("otherDeduction")} /></div>
        </div>
        <div className="inv-field"><label htmlFor="aj-note">Note</label><input id="aj-note" maxLength={200} value={values.adjustmentNote} onChange={set("adjustmentNote")} /></div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>Save adjustment</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function PayrollRunClient({ id }) {
  const { can } = useCurrentUser();
  const loaded = useApiData(`/api/payroll/runs/${id}`);
  const [override, setOverride] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [adjusting, setAdjusting] = useState(null);
  const run = override ?? loaded.data;

  async function act(action) {
    if (busy) return;
    const prompts = {
      approve: "Approve this payroll? Advance recoveries are applied and the month's attendance is locked. This cannot be undone.",
      cancel: "Cancel this draft payroll?",
    };
    if (prompts[action] && !window.confirm(prompts[action])) return;
    let paymentReference = "";
    if (action === "pay") {
      paymentReference = window.prompt("Payment reference (bank batch, cheque numbers…)") ?? null;
      if (paymentReference === null) return;
    }
    setBusy(action);
    setError("");
    try {
      setOverride(await apiRequest(`/api/payroll/runs/${id}`, { method: "PATCH", body: JSON.stringify({ action, paymentReference }) }));
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy("");
    }
  }

  if (loaded.error && !run) return <main className="inv-page"><p className="inv-dialog__error" role="alert">{loaded.error}</p></main>;
  if (!run) return <main className="inv-page"><p className="inv-state" role="status">Loading payroll…</p></main>;
  const draft = run.status === "DRAFT";
  const unrecorded = run.lines.filter((line) => line.unrecordedDays > 0).length;
  const unpaid = run.lines.filter((line) => Number(line.basicSalary) === 0).length;

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/people-payroll/payroll">Payroll</Link></p>
          <h1>{run.runNumber} · {run.period} <RunStatusBadge status={run.status} /></h1>
          <p>{run.employeeCount} employees · {run.periodDays} days in month · calculated {new Date(run.calculatedAt).toLocaleString("en-GB")}{run.paymentReference ? ` · paid: ${run.paymentReference}` : ""}</p>
        </div>
        <div className="inv-header__actions">
          {draft && can("payroll:process") && <Button variant="secondary" loading={busy === "cancel"} onClick={() => act("cancel")}>Cancel</Button>}
          {draft && can("payroll:process") && <Button variant="secondary" loading={busy === "recalculate"} onClick={() => act("recalculate")}>Recalculate</Button>}
          {draft && can("payroll:approve") && <Button variant="primary" loading={busy === "approve"} onClick={() => act("approve")}>Approve</Button>}
          {run.status === "APPROVED" && can("payroll:approve") && <Button variant="primary" loading={busy === "pay"} onClick={() => act("pay")}>Mark paid</Button>}
          <Link className="inv-link-button" href={`/print/payroll/${run.id}`}>Print register</Link>
          <Link className="inv-link-button" href={`/print/payroll/${run.id}?view=payslips`}>Print payslips</Link>
        </div>
      </header>
      {error && <p className="inv-dialog__error" role="alert">{error}</p>}
      {draft && (unrecorded > 0 || unpaid > 0) && (
        <p className="inv-state" role="status">
          {unrecorded > 0 && `${unrecorded} employees have days without attendance records (monthly staff are paid for them; daily-wage workers are not). `}
          {unpaid > 0 && `${unpaid} employees have no pay rate set.`}
        </p>
      )}
      <section className="inv-kpis" aria-label="Totals">
        <div className="inv-kpi"><span>Gross pay</span><strong>{formatAmount(run.grossTotal)}</strong></div>
        <div className="inv-kpi"><span>Deductions</span><strong>{formatAmount(run.deductionTotal)}</strong><small>fixed, advance recovery and other</small></div>
        <div className="inv-kpi"><span>Net pay</span><strong>{formatAmount(run.netTotal)}</strong></div>
      </section>
      <section className="inv-card">
        <div className="inv-card__header"><h2>Employees</h2><small>Paid days: monthly = employed − absent − unpaid leave − ½ half days; daily = present + paid leave + ½ half days.</small></div>
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead>
              <tr>
                <th>Employee</th><th className="inv-num">Paid days</th><th className="inv-num">Basic</th><th className="inv-num">Allowances</th><th className="inv-num">Overtime</th>
                <th className="inv-num">Other +</th><th className="inv-num">Gross</th><th className="inv-num">Fixed ded.</th><th className="inv-num">Advance</th><th className="inv-num">Other −</th><th className="inv-num">Net</th><th />
              </tr>
            </thead>
            <tbody>
              {run.lines.map((line) => (
                <tr key={line.id}>
                  <td data-label="Employee"><strong>{line.employeeName}</strong><small>{line.employeeCode} · {line.departmentName}{line.adjustmentNote ? ` · ${line.adjustmentNote}` : ""}</small></td>
                  <td data-label="Paid days" className="inv-num">{line.paidDays} / {line.employedDays}{line.unrecordedDays > 0 && <small className="inv-neg">{line.unrecordedDays} unrecorded</small>}</td>
                  <td data-label="Basic" className="inv-num">{formatAmount(line.basicEarned)}</td>
                  <td data-label="Allowances" className="inv-num">{formatAmount(line.allowancesEarned)}</td>
                  <td data-label="Overtime" className="inv-num">{formatAmount(line.overtimePay)}<small>{line.overtimeHours} h</small></td>
                  <td data-label="Other +" className="inv-num">{formatAmount(line.otherEarning)}</td>
                  <td data-label="Gross" className="inv-num">{formatAmount(line.grossPay)}</td>
                  <td data-label="Fixed ded." className="inv-num">{formatAmount(line.fixedDeduction)}</td>
                  <td data-label="Advance" className="inv-num">{formatAmount(line.advanceRecovery)}</td>
                  <td data-label="Other −" className="inv-num">{formatAmount(line.otherDeduction)}</td>
                  <td data-label="Net" className="inv-num"><strong>{formatAmount(line.netPay)}</strong></td>
                  <td data-label="Actions">
                    {draft && can("payroll:process") && <button type="button" className="inv-text-button" onClick={() => setAdjusting(line)}>Adjust</button>}{" "}
                    <Link href={`/print/payroll/${run.id}?view=payslips&employee=${line.employeeId}`}>Payslip</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {adjusting && <AdjustDialog run={run} line={adjusting} onClose={() => setAdjusting(null)} onSaved={(updated) => { setAdjusting(null); setOverride(updated); }} />}
    </main>
  );
}
