"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import InventoryPager from "@/components/inventory/InventoryPager";
import CapaDialog from "@/components/quality/CapaDialog";
import { QBadge } from "@/components/quality/qualityUi";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const PROMPTS = { complete: "What was done?", verify: "Verification evidence?", reopen: "Why was it not effective?", cancel: "Reason for cancelling?" };

export default function CapaPage() {
  const { can } = useCurrentUser();
  const [status, setStatus] = useState("ACTIVE");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const list = useApiData(`/api/quality/capas${toQuery({ status, search, page, pageSize: 25 })}`);
  const rows = list.data?.capas ?? [];

  async function act(capa, action) {
    const note = action === "start" ? "" : window.prompt(PROMPTS[action]);
    if (note === null || (action !== "start" && !note)) return;
    setError("");
    try {
      await apiRequest(`/api/quality/capas/${capa.id}`, { method: "PATCH", body: JSON.stringify({ action, note }) });
      list.reload();
    } catch (cause) {
      setError(cause.message);
    }
  }

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/quality">Quality</Link></p>
          <h1>Corrective and preventive actions</h1>
          <p>Open → in progress → done → verified. Verification (or &quot;not effective&quot;, which sends it back) needs quality approval.</p>
        </div>
        <div className="inv-header__actions">
          <Link className="inv-link-button" href="/reports/quality/capa">CAPA report</Link>
          {can("quality:create") && <Button variant="primary" onClick={() => setCreating(true)}>New CAPA</Button>}
        </div>
      </header>
      {error && <p className="inv-dialog__error" role="alert">{error}</p>}
      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field"><label htmlFor="cp-search">Search</label><input id="cp-search" type="search" placeholder="CAPA, title, owner or NCR" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
          <div className="inv-field">
            <label htmlFor="cp-status">Status</label>
            <select id="cp-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="ACTIVE">Not yet verified</option><option value="OVERDUE">Overdue</option><option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="DONE">Done (to verify)</option><option value="VERIFIED">Verified</option><option value="CANCELLED">Cancelled</option><option value="">All</option>
            </select>
          </div>
        </div>
        {list.error ? <p className="inv-state inv-state--error" role="alert">{list.error}</p> : !list.data ? <p className="inv-state" role="status">Loading actions…</p> : rows.length === 0 ? <p className="inv-state">No actions match.</p> : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>CAPA</th><th>NCR</th><th>Owner</th><th>Due</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="CAPA"><strong>{row.capaNumber}</strong> {row.title}<small>{row.actionType.toLowerCase()}</small></td>
                    <td data-label="NCR">{row.ncrId ? <Link href={`/quality/ncr?ncr=${row.ncrId}`}>{row.ncrNumber}</Link> : "—"}</td>
                    <td data-label="Owner">{row.ownerName}</td>
                    <td data-label="Due">{row.dueDate}{row.overdue && <small className="inv-neg">Overdue</small>}</td>
                    <td data-label="Status"><QBadge value={row.status} /></td>
                    <td data-label="">
                      {row.status === "OPEN" && can("quality:create") && <button type="button" className="inv-link-button" onClick={() => act(row, "start")}>Start</button>}
                      {["OPEN", "IN_PROGRESS"].includes(row.status) && can("quality:create") && <> <button type="button" className="inv-link-button" onClick={() => act(row, "complete")}>Complete</button></>}
                      {["OPEN", "IN_PROGRESS"].includes(row.status) && can("quality:approve") && <> <button type="button" className="inv-link-button" onClick={() => act(row, "cancel")}>Cancel</button></>}
                      {row.status === "DONE" && can("quality:approve") && <><button type="button" className="inv-link-button" onClick={() => act(row, "verify")}>Verify</button> <button type="button" className="inv-link-button" onClick={() => act(row, "reopen")}>Not effective</button></>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={list.data?.hasMore} onChange={setPage} disabled={list.loading} />
      </section>
      {creating && <CapaDialog onClose={() => setCreating(false)} onSaved={() => { setCreating(false); list.reload(); }} />}
    </main>
  );
}
