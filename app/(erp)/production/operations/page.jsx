"use client";

import StageTotalsTable from "@/components/production/StageTotalsTable";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

export default function ProductionOperationsPage() {
  const summary = useApiData("/api/production/summary");

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Production</p>
          <h1>Operations</h1>
          <p>The nine production operations in their fixed sequence, with the department responsible and live load. The sequence is configured in config/production.js.</p>
        </div>
      </header>
      <section className="inv-card">
        {summary.error ? (
          <p className="inv-state inv-state--error" role="alert">{summary.error}</p>
        ) : !summary.data ? (
          <p className="inv-state" role="status">Loading operations…</p>
        ) : (
          <StageTotalsTable stages={summary.data.stages} showDescription />
        )}
      </section>
    </main>
  );
}
