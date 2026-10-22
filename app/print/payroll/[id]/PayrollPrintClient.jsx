"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api/client";
import { formatAmount } from "@/lib/formatters/formatters";
import { subtractDecimalStrings } from "@/server/core/utils/decimal";
import useCompany from "@/lib/useCompany";

/* Payroll register, or payslips (one per page), from GET /api/payroll/runs/[id] (payroll:view). */
export default function PayrollPrintClient({ id, view, employeeId }) {
  const COMPANY = useCompany();
  const [run, setRun] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest(`/api/payroll/runs/${encodeURIComponent(id)}`)
      .then((value) => { if (active) setRun(value); })
      .catch((cause) => { if (active) setError(cause?.message || "Unable to load this payroll."); });
    return () => { active = false; };
  }, [id]);

  if (error) return <main className="print-doc print-doc--message"><p role="alert">{error}</p><Link href="/people-payroll/payroll">Back to payroll</Link></main>;
  if (!run) return <main className="print-doc print-doc--message"><p role="status">Loading payrollâ€¦</p></main>;

  const company = (
    <div>
      <strong className="print-doc__company">{COMPANY.legalName || COMPANY.name}</strong>
      {[COMPANY.address, COMPANY.phone].filter(Boolean).map((line) => <span key={line}>{line}</span>)}
    </div>
  );
  const notice = run.status === "DRAFT" ? <p className="print-doc__notice">DRAFT: not approved. Figures may change.</p> : run.status === "CANCELLED" ? <p className="print-doc__notice">CANCELLED payroll.</p> : null;
  const toolbar = (
    <nav className="print-doc__toolbar" aria-label="Document actions">
      <Link href={`/people-payroll/payroll/${run.id}`}>Back to payroll</Link>
      <button type="button" onClick={() => window.print()}>Print</button>
    </nav>
  );

  if (view === "payslips") {
    const lines = employeeId ? run.lines.filter((line) => line.employeeId === employeeId) : run.lines;
    return (
      <main className="print-doc">
        {toolbar}
        {lines.map((line) => (
          <article key={line.id} className="print-doc__page" style={{ breakAfter: "page" }}>
            <header className="print-doc__header">
              {company}
              <div className="print-doc__title">
                <h1>Payslip</h1>
                <dl>
                  <div><dt>Month</dt><dd>{run.period}</dd></div>
                  <div><dt>Payroll</dt><dd>{run.runNumber}</dd></div>
                  <div><dt>Status</dt><dd>{run.status}</dd></div>
                </dl>
              </div>
            </header>
            {notice}
            <section className="print-doc__parties">
              <h2>Employee</h2>
              <span><strong>{line.employeeName}</strong> · {line.employeeCode}</span>
              <span>{line.designation} · {line.departmentName}</span>
              {line.bankAccount && <span>Bank account: {line.bankAccount}</span>}
              <span>Paid days {line.paidDays} of {line.employedDays} employed ({run.periodDays} in month){line.unrecordedDays > 0 ? ` · ${line.unrecordedDays} without attendance record` : ""}</span>
            </section>
            <table className="print-doc__table">
              <thead><tr><th>Earnings</th><th className="print-doc__num">Amount</th><th>Deductions</th><th className="print-doc__num">Amount</th></tr></thead>
              <tbody>
                <tr><td>Basic {line.payBasis === "DAILY" ? `(${line.paidDays} days Ã— ${formatAmount(line.basicSalary)})` : ""}</td><td className="print-doc__num">{formatAmount(line.basicEarned)}</td><td>Fixed deduction</td><td className="print-doc__num">{formatAmount(line.fixedDeduction)}</td></tr>
                <tr><td>Allowances</td><td className="print-doc__num">{formatAmount(line.allowancesEarned)}</td><td>Advance recovery</td><td className="print-doc__num">{formatAmount(line.advanceRecovery)}</td></tr>
                <tr><td>Overtime ({line.overtimeHours} h Ã— {formatAmount(line.overtimeRate)})</td><td className="print-doc__num">{formatAmount(line.overtimePay)}</td><td>Other{line.adjustmentNote ? ` (${line.adjustmentNote})` : ""}</td><td className="print-doc__num">{formatAmount(line.otherDeduction)}</td></tr>
                <tr><td>Other earning</td><td className="print-doc__num">{formatAmount(line.otherEarning)}</td><td /><td /></tr>
              </tbody>
            </table>
            <section className="print-doc__summary">
              <div className="print-doc__notes" />
              <dl className="print-doc__totals">
                <div><dt>Gross pay</dt><dd>{formatAmount(line.grossPay)}</dd></div>
                <div className="print-doc__grand"><dt>Net pay</dt><dd>{formatAmount(line.netPay)}</dd></div>
              </dl>
            </section>
            <section className="print-doc__signoff">
              <div><span>Prepared by</span></div>
              <div><span>Employee signature</span></div>
            </section>
          </article>
        ))}
      </main>
    );
  }

  return (
    <main className="print-doc">
      {toolbar}
      <article className="print-doc__page">
        <header className="print-doc__header">
          {company}
          <div className="print-doc__title">
            <h1>Payroll Register</h1>
            <dl>
              <div><dt>Month</dt><dd>{run.period}</dd></div>
              <div><dt>Payroll</dt><dd>{run.runNumber}</dd></div>
              <div><dt>Status</dt><dd>{run.status}</dd></div>
            </dl>
          </div>
        </header>
        {notice}
        <table className="print-doc__table">
          <thead><tr><th>Employee</th><th className="print-doc__num">Days</th><th className="print-doc__num">Gross</th><th className="print-doc__num">Deductions</th><th className="print-doc__num">Net</th><th>Signature</th></tr></thead>
          <tbody>
            {run.lines.map((line) => (
              <tr key={line.id}>
                <td><strong>{line.employeeName}</strong> · {line.employeeCode}</td>
                <td className="print-doc__num">{line.paidDays}</td>
                <td className="print-doc__num">{formatAmount(line.grossPay)}</td>
                <td className="print-doc__num">{formatAmount(subtractDecimalStrings(line.grossPay, line.netPay))}</td>
                <td className="print-doc__num">{formatAmount(line.netPay)}</td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
        <section className="print-doc__summary">
          <div className="print-doc__notes"><p>{run.employeeCount} employees{run.paymentReference ? ` · paid: ${run.paymentReference}` : ""}</p></div>
          <dl className="print-doc__totals">
            <div><dt>Gross</dt><dd>{formatAmount(run.grossTotal)}</dd></div>
            <div><dt>Deductions</dt><dd>{formatAmount(run.deductionTotal)}</dd></div>
            <div className="print-doc__grand"><dt>Net pay</dt><dd>{formatAmount(run.netTotal)}</dd></div>
          </dl>
        </section>
        <section className="print-doc__signoff">
          <div><span>Prepared by</span></div>
          <div><span>Approved by</span></div>
        </section>
      </article>
    </main>
  );
}

