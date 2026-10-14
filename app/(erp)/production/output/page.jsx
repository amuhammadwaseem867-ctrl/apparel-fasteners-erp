"use client";

import Link from "next/link";

import StageTotalsTable from "@/components/production/StageTotalsTable";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

export default function ProductionOutputPage() {
  const summary = useApiData("/api/production/summary");

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Production</p>
          <h1>Stage Output</h1>
          <p>Quantities recorded at each stage across all non-cancelled orders. Record output on the production order.</p>
        </div>
        <div className="inv-header__actions">
          <Link className="inv-link-button" href="/production/stage-board">Stage board</Link>
        </div>
      </header>
      <section className="inv-card">
        {summary.error ? (
          <p className="inv-state inv-state--error" role="alert">{summary.error}</p>
        ) : !summary.data ? (
          <p className="inv-state" role="status">Loading stage output…</p>
        ) : (
          <StageTotalsTable stages={summary.data.stages} />
        )}
      </section>
    </main>
  );
}
