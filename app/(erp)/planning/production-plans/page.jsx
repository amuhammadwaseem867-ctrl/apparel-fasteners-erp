"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import Button from "@/components/ui/Button";
import InventoryPager from "@/components/inventory/InventoryPager";
import PlanEditor from "@/components/planning/PlanEditor";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const TONE = { DRAFT: "warning", APPROVED: "good", CLOSED: "", CANCELLED: "danger" };

export default function ProductionPlansPage() {
  const router = useRouter();
  const { can } = useCurrentUser();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const list = useApiData(`/api/planning/production-plans${toQuery({ status, page, pageSize: 25 })}`);
  const rows = list.data?.plans ?? [];

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/planning">Planning</Link></p>
          <h1>Production plans</h1>
          <p>What to make in a period, checked against stage capacity. Approved plans release their lines into production orders one by one.</p>
        </div>
        <div className="inv-header__actions">{can("production:create") && <Button variant="primary" onClick={() => setCreating(true)}>New plan</Button>}</div>
      </header>
      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field"><label htmlFor="pp-status">Status</label><select id="pp-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All</option><option value="DRAFT">Draft</option><option value="APPROVED">Approved</option><option value="CLOSED">Closed</option><option value="CANCELLED">Cancelled</option></select></div>
        </div>
        {list.error ? <p className="inv-state inv-state--error" role="alert">{list.error}</p> : !list.data ? <p className="inv-state" role="status">Loading plans…</p> : rows.length === 0 ? <p className="inv-state">No production plans yet.</p> : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Plan</th><th>Period</th><th className="inv-num">Lines</th><th className="inv-num">Released</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Plan"><Link href={`/planning/production-plans/${row.id}`}><strong>{row.planNumber}</strong></Link><small>{row.title}</small></td>
                    <td data-label="Period">{row.periodStart} → {row.periodEnd}</td>
                    <td data-label="Lines" className="inv-num">{row.lines}</td>
                    <td data-label="Released" className="inv-num">{row.released}</td>
                    <td data-label="Status"><span className={`inv-badge ${TONE[row.status] ? `inv-badge--${TONE[row.status]}` : ""}`}>{row.status.charAt(0) + row.status.slice(1).toLowerCase()}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={list.data?.hasMore} onChange={setPage} disabled={list.loading} />
      </section>
      {creating && <PlanEditor onClose={() => setCreating(false)} onSaved={(plan) => router.push(`/planning/production-plans/${plan.id}`)} />}
    </main>
  );
}
