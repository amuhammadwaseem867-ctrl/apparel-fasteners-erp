"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import InventoryPager from "@/components/inventory/InventoryPager";
import MrpRunView from "@/components/planning/MrpRunView";
import useApiData from "@/lib/inventory/useApiData";
import { apiRequest } from "@/lib/api/client";

import "@/components/inventory/InventoryWorkspace.css";

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

/*
 * Run MRP and review stored runs. A run is calculated and saved on the
 * server in one transaction; nothing is computed in the browser.
 */
export default function MrpRunsPage() {
  const [page, setPage] = useState(1);
  const [horizonDate, setHorizonDate] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const runs = useApiData(`/api/planning/mrp-runs?page=${page}&pageSize=15`);
  const selected = useApiData(selectedId ? `/api/planning/mrp-runs/${selectedId}` : null);

  async function run() {
    if (running) return;
    setRunning(true);
    setError("");
    try {
      const result = await apiRequest("/api/planning/mrp-runs", {
        method: "POST",
        body: JSON.stringify({ horizonDate }),
      });
      setSelectedId(result.id);
      setPage(1);
      runs.reload();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setRunning(false);
    }
  }

  const rows = runs.data?.runs ?? [];

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Planning</p>
          <h1>MRP Runs</h1>
          <p>Material requirements from approved sales orders, exploded through active BOMs and netted against available stock. Each run is stored with its inputs and assumptions.</p>
        </div>
      </header>

      <section className="inv-card">
        <form className="inv-toolbar" onSubmit={(event) => { event.preventDefault(); run(); }}>
          <div className="inv-field">
            <label htmlFor="mrp-horizon">Demand due on or before</label>
            <input id="mrp-horizon" type="date" value={horizonDate} onChange={(event) => setHorizonDate(event.target.value)} />
          </div>
          <Button type="submit" variant="primary" loading={running}>Run MRP</Button>
        </form>
        {error && <p className="inv-state inv-state--error" role="alert">{error}</p>}

        {runs.error ? (
          <p className="inv-state inv-state--error" role="alert">{runs.error}</p>
        ) : !runs.data ? (
          <p className="inv-state" role="status">Loading runs…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">No MRP runs yet. Approve sales orders and activate BOMs, then run MRP.</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Run</th><th>When</th><th className="inv-num">Demand lines</th><th className="inv-num">Planned orders</th><th /></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} aria-selected={row.id === selectedId}>
                    <td data-label="Run"><strong>{row.runNumber}</strong></td>
                    <td data-label="When">{formatDateTime(row.createdAt)}</td>
                    <td data-label="Demand lines" className="inv-num">{row.demandCount}</td>
                    <td data-label="Planned orders" className="inv-num">{row.plannedCount}</td>
                    <td data-label="Open">
                      <button type="button" className="inv-text-button" onClick={() => setSelectedId(row.id)}>
                        {row.id === selectedId ? "Showing" : "Open"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={runs.data?.hasMore} onChange={setPage} disabled={runs.loading} />
      </section>

      {selectedId && (
        selected.error ? <p className="inv-dialog__error" role="alert">{selected.error}</p>
          : !selected.data ? <p className="inv-state" role="status">Loading run…</p>
            : <MrpRunView run={selected.data} onChanged={selected.reload} />
      )}
    </main>
  );
}
