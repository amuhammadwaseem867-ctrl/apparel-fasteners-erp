"use client";

import { useState } from "react";

import InventoryPager from "@/components/inventory/InventoryPager";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

function summary(metadata) {
  if (!metadata || typeof metadata !== "object") return metadata ? String(metadata) : "";
  return Object.entries(metadata)
    .filter(([, value]) => value !== null && value !== "")
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`)
    .join(" · ");
}

/* The audit log is append-only; this page only reads it. */
export default function AuditPage() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const actions = useApiData("/api/admin/audit/actions");
  const log = useApiData(`/api/admin/audit${toQuery({ search, action, dateFrom, dateTo, page, pageSize: 50 })}`);
  const rows = log.data?.entries ?? [];
  const reset = (setter) => (event) => { setter(event.target.value); setPage(1); };

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow">Administration</p>
          <h1>Audit Log</h1>
          <p>Every recorded business and security action, newest first. Entries cannot be edited or deleted.</p>
        </div>
      </header>
      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field"><label htmlFor="au-search">Search</label><input id="au-search" type="search" placeholder="Action, entity or details" value={search} onChange={reset(setSearch)} /></div>
          <div className="inv-field">
            <label htmlFor="au-action">Action</label>
            <select id="au-action" value={action} onChange={reset(setAction)}>
              <option value="">All actions</option>
              {(actions.data?.actions ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="inv-field"><label htmlFor="au-from">From</label><input id="au-from" type="date" value={dateFrom} onChange={reset(setDateFrom)} /></div>
          <div className="inv-field"><label htmlFor="au-to">To</label><input id="au-to" type="date" value={dateTo} onChange={reset(setDateTo)} /></div>
        </div>
        {log.error ? (
          <p className="inv-state inv-state--error" role="alert">{log.error}</p>
        ) : !log.data ? (
          <p className="inv-state" role="status">Loading audit log…</p>
        ) : rows.length === 0 ? (
          <p className="inv-state">No entries match these filters.</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>When</th><th>Action</th><th>Actor</th><th>Entity</th><th>Details</th></tr></thead>
              <tbody>
                {rows.map((entry) => (
                  <tr key={entry.id}>
                    <td data-label="When">{new Date(entry.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "medium" })}</td>
                    <td data-label="Action"><strong>{entry.action}</strong></td>
                    <td data-label="Actor">{entry.actorName ?? (entry.actorId ? "Unknown user" : "System")}<small>{entry.actorEmail ?? ""}</small></td>
                    <td data-label="Entity">{entry.entityType ?? "—"}<small>{entry.entityId ?? ""}</small></td>
                    <td data-label="Details" style={{ whiteSpace: "normal", maxWidth: 420 }}><small>{summary(entry.metadata)}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={log.data?.hasMore} onChange={setPage} disabled={log.loading} />
      </section>
    </main>
  );
}

