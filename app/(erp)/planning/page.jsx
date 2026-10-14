"use client";

import Link from "next/link";

import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const LINKS = [
  ["/planning/mrp-runs", "MRP runs", "Run MRP and review stored plans"],
  ["/planning/material-requirements", "Material requirements", "Latest gross and net requirements"],
  ["/planning/shortages", "Shortages", "Items not covered by stock"],
  ["/products/bom", "Bills of materials", "Author, approve and activate BOMs"],
  ["/planning/material-reservations", "Reservations", "Stock reserved against orders"],
];

export default function PlanningOverviewPage() {
  const latest = useApiData("/api/planning/mrp-runs/latest");
  const run = latest.data;
  const noRun = latest.error && /No MRP run/.test(latest.error);
  const shortages = run ? run.requirements.filter((row) => Number(row.netRequirement) > 0).length : null;
  const suggested = run ? run.plannedOrders.filter((row) => row.status === "SUGGESTED").length : null;

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Planning</p>
          <h1>Planning &amp; MRP</h1>
          <p>Material planning from approved orders, active bills of materials and live stock.</p>
        </div>
        <div className="inv-header__actions">
          <Link className="inv-link-button" href="/planning/mrp-runs">Run MRP</Link>
        </div>
      </header>

      {noRun ? (
        <p className="inv-state">No MRP run yet. Approve sales orders, activate BOMs, then run MRP.</p>
      ) : latest.error ? (
        <p className="inv-dialog__error" role="alert">{latest.error}</p>
      ) : !run ? (
        <p className="inv-state" role="status">Loading the latest run…</p>
      ) : (
        <section className="inv-kpis" aria-label="Latest MRP run">
          <div className="inv-kpi"><span>Latest run</span><strong>{run.runNumber}</strong><small>{new Date(run.createdAt).toLocaleString("en-GB")}</small></div>
          <div className="inv-kpi"><span>Demand lines</span><strong>{run.demandCount}</strong><small>approved order lines</small></div>
          <div className="inv-kpi inv-kpi--warning"><span>Shortages</span><strong>{shortages}</strong><small>items with net requirement</small></div>
          <div className="inv-kpi"><span>Suggested orders</span><strong>{suggested}</strong><small>awaiting confirmation</small></div>
        </section>
      )}

      <nav className="inv-kpis" aria-label="Planning areas">
        {LINKS.map(([href, label, note]) => (
          <Link key={href} href={href} className="inv-kpi" style={{ textDecoration: "none" }}>
            <span>{label}</span>
            <small>{note}</small>
          </Link>
        ))}
      </nav>
    </main>
  );
}
