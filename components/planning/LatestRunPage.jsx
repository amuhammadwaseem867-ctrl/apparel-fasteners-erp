"use client";

import Link from "next/link";

import MrpRunView from "@/components/planning/MrpRunView";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

/* A view of the most recent stored MRP run. */
export default function LatestRunPage({ title, description, show }) {
  const latest = useApiData("/api/planning/mrp-runs/latest");
  const noRun = latest.error && /No MRP run/.test(latest.error);

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Planning</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="inv-header__actions">
          <Link className="inv-link-button" href="/planning/mrp-runs">Run MRP</Link>
        </div>
      </header>
      {noRun ? (
        <p className="inv-state">No MRP run has been made yet. Run MRP to calculate requirements.</p>
      ) : latest.error ? (
        <p className="inv-dialog__error" role="alert">{latest.error}</p>
      ) : !latest.data ? (
        <p className="inv-state" role="status">Loading the latest MRP run…</p>
      ) : (
        <MrpRunView run={latest.data} onChanged={latest.reload} show={show} />
      )}
    </main>
  );
}
