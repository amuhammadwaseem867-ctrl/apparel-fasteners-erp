"use client";

import Link from "next/link";

import { RunStatusBadge, today } from "@/components/people/peopleUi";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import { formatAmount } from "@/lib/formatters/formatters";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

export default function PeoplePayrollPage() {
  const { can, loading } = useCurrentUser();
  const date = today();
  const employees = useApiData("/api/hr/employees?status=ACTIVE&pageSize=200");
  const departments = useApiData("/api/hr/departments");
  const attendance = useApiData(`/api/hr/attendance${toQuery({ date })}`);
  const runs = useApiData(!loading && can("payroll:view") ? "/api/payroll/runs" : null);
  const active = employees.data?.employees?.length;
  const error = employees.error || departments.error || attendance.error;

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">People &amp; Payroll</p>
          <h1>People &amp; Payroll</h1>
          <p>Employees, attendance, salary advances and monthly payroll. Pay details are shown only to payroll staff.</p>
        </div>
        <div className="inv-header__actions"><Link className="inv-link-button" href="/people-payroll/attendance">Today&apos;s attendance</Link></div>
      </header>
      {error ? (
        <p className="inv-dialog__error" role="alert">{error}</p>
      ) : (
        <section className="inv-kpis" aria-label="People">
          <div className="inv-kpi"><span>Active employees</span><strong>{active === undefined ? "…" : `${active}${employees.data?.hasMore ? "+" : ""}`}</strong></div>
          <div className="inv-kpi"><span>Departments</span><strong>{departments.data ? departments.data.departments.filter((item) => item.status === "ACTIVE").length : "…"}</strong></div>
          <div className={`inv-kpi ${attendance.data && active && attendance.data.records.length < active ? "inv-kpi--warning" : ""}`}><span>Attendance recorded today</span><strong>{attendance.data ? attendance.data.records.length : "…"}</strong><small>{date}</small></div>
        </section>
      )}
      {runs.data && (
        <section className="inv-card">
          <div className="inv-card__header"><h2>Recent payroll</h2><Link href="/people-payroll/payroll">All runs</Link></div>
          {runs.data.runs.length === 0 ? <p className="inv-state">No payroll runs yet.</p> : (
            <ul style={{ margin: 0, padding: "12px 32px", fontSize: 13 }}>
              {runs.data.runs.slice(0, 6).map((run) => (
                <li key={run.id}><Link href={`/people-payroll/payroll/${run.id}`}>{run.period}</Link> · {run.employeeCount} employees · net {formatAmount(run.netTotal)} <RunStatusBadge status={run.status} /></li>
              ))}
            </ul>
          )}
        </section>
      )}
      <section className="inv-card">
        <div className="inv-card__header"><h2>Areas</h2></div>
        <ul style={{ margin: 0, padding: "12px 32px", fontSize: 13 }}>
          <li><Link href="/people-payroll/employees">Employees</Link> and <Link href="/people-payroll/departments">departments</Link>.</li>
          <li><Link href="/people-payroll/attendance">Attendance</Link>: daily status, leave and overtime.</li>
          <li><Link href="/people-payroll/advances-loans">Salary advances</Link>, recovered through payroll.</li>
          <li><Link href="/people-payroll/payroll">Payroll</Link>: monthly runs, payslips and register.</li>
          <li>Shifts, leave balances and HR reports are not implemented yet.</li>
        </ul>
      </section>
    </main>
  );
}
