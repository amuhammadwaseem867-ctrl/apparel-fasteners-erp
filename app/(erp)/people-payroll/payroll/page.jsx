"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import Button from "@/components/ui/Button";
import { RunStatusBadge, today } from "@/components/people/peopleUi";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import { formatAmount } from "@/lib/formatters/formatters";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

export default function PayrollRunsPage() {
  const router = useRouter();
  const { can } = useCurrentUser();
  const runs = useApiData("/api/payroll/runs");
  const [period, setPeriod] = useState(() => today().slice(0, 7));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rows = runs.data?.runs ?? [];

  async function create(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const created = await apiRequest("/api/payroll/runs", { method: "POST", body: JSON.stringify({ period }) });
      router.push(`/people-payroll/payroll/${created.id}`);
    } catch (cause) {
      setError(cause.message);
      setBusy(false);
    }
  }

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">People &amp; Payroll</p>
          <h1>Payroll</h1>
          <p>One payroll run per month, calculated from attendance, pay rates and open advances. Drafts can be recalculated and adjusted; approval locks the month.</p>
        </div>
      </header>
      {can("payroll:process") && (
        <section className="inv-card">
          <form className="inv-toolbar" onSubmit={create}>
            <div className="inv-field"><label htmlFor="pr-period">Month *</label><input id="pr-period" type="month" required value={period} onChange={(event) => setPeriod(event.target.value)} /></div>
            <Button type="submit" variant="primary" loading={busy}>Calculate payroll</Button>
          </form>
          {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        </section>
      )}
      <section className="inv-card">
        {runs.error ? (
          <p className="inv-state inv-state--error" role="alert">{runs.error}</p>
        ) : !runs.data ? (
          <p className="inv-state" role="status">Loading payroll runs…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">No payroll runs yet.</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Run</th><th>Month</th><th className="inv-num">Employees</th><th className="inv-num">Gross</th><th className="inv-num">Deductions</th><th className="inv-num">Net pay</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Run"><Link href={`/people-payroll/payroll/${row.id}`}><strong>{row.runNumber}</strong></Link></td>
                    <td data-label="Month">{row.period}</td>
                    <td data-label="Employees" className="inv-num">{row.employeeCount}</td>
                    <td data-label="Gross" className="inv-num">{formatAmount(row.grossTotal)}</td>
                    <td data-label="Deductions" className="inv-num">{formatAmount(row.deductionTotal)}</td>
                    <td data-label="Net pay" className="inv-num"><strong>{formatAmount(row.netTotal)}</strong></td>
                    <td data-label="Status"><RunStatusBadge status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
