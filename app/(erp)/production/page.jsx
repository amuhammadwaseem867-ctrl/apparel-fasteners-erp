"use client";

import Link from "next/link";

import StageTotalsTable from "@/components/production/StageTotalsTable";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";
import "@/components/production/Production.css";

const LINKS = [
  ["/production/orders", "Production orders", "Create, release and follow orders"],
  ["/production/stage-board", "Stage board", "Active orders by current stage"],
  ["/production/material-issue", "Material issues", "Material issued to and returned from orders"],
  ["/production/output", "Stage output", "Processed, rejected and wasted by stage"],
  ["/planning/mrp-runs", "MRP", "Convert confirmed MAKE orders"],
];

export default function ProductionDashboardPage() {
  const summary = useApiData("/api/production/summary");
  const data = summary.data;
  const count = (status) => data?.statusCounts?.[status] ?? 0;

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Production</p>
          <h1>Production</h1>
          <p>Nine-stage production from tape dyeing to delivery. All figures come from recorded production orders and stage runs.</p>
        </div>
        <div className="inv-header__actions">
          <Link className="inv-link-button" href="/production/orders/new">New production order</Link>
        </div>
      </header>

      {summary.error ? (
        <p className="inv-dialog__error" role="alert">{summary.error}</p>
      ) : !data ? (
        <p className="inv-state" role="status">Loading production summary…</p>
      ) : (
        <>
          <section className="inv-kpis" aria-label="Production orders by status">
            <div className="inv-kpi"><span>Planned</span><strong>{count("PLANNED")}</strong></div>
            <div className="inv-kpi"><span>Released</span><strong>{count("RELEASED")}</strong></div>
            <div className="inv-kpi inv-kpi--warning"><span>In progress</span><strong>{count("IN_PROGRESS")}</strong></div>
            <div className={`inv-kpi ${count("ON_HOLD") ? "inv-kpi--danger" : ""}`}><span>On hold</span><strong>{count("ON_HOLD")}</strong></div>
            <div className={`inv-kpi ${data.overdue ? "inv-kpi--danger" : ""}`}><span>Overdue (open, past due date)</span><strong>{data.overdue}</strong></div>
            <div className="inv-kpi"><span>Completed</span><strong>{count("COMPLETED")}</strong></div>
          </section>

          <section className="inv-card">
            <div className="inv-card__header">
              <h2>Stages</h2>
              <small>Active orders at each stage, and quantities recorded across all non-cancelled orders.</small>
            </div>
            <StageTotalsTable stages={data.stages} />
          </section>
        </>
      )}

      <section className="inv-card">
        <div className="inv-card__header"><h2>Production areas</h2></div>
        <ul className="prd-events">
          {LINKS.map(([href, label, text]) => <li key={href}><Link href={href}><strong>{label}</strong></Link> · {text}</li>)}
        </ul>
      </section>
    </main>
  );
}

