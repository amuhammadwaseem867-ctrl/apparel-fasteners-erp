"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import InventoryPager from "@/components/inventory/InventoryPager";
import ItemPicker from "@/components/inventory/ItemPicker";
import CapaDialog from "@/components/quality/CapaDialog";
import { QBadge, newKey } from "@/components/quality/qualityUi";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const SOURCES = { INSPECTION: "Inspection", IN_PROCESS: "In process", CUSTOMER: "Customer complaint", SUPPLIER: "Supplier", INTERNAL: "Internal audit" };
const DISPOSITIONS = { REWORK: "Rework", SCRAP: "Scrap", USE_AS_IS: "Use as is", RETURN_TO_SUPPLIER: "Return to supplier", REGRADE: "Regrade" };

function NewNcrDialog({ onClose, onSaved }) {
  const inspections = useApiData("/api/quality/inspections?pageSize=100");
  const [values, setValues] = useState({ source: "IN_PROCESS", severity: "MAJOR", title: "", description: "", inspectionId: "", quantityAffected: "", containment: "" });
  const [item, setItem] = useState(null);
  const [key] = useState(newKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    const inspection = (inspections.data?.inspections ?? []).find((row) => row.id === values.inspectionId);
    try {
      onSaved(await apiRequest("/api/quality/ncrs", {
        method: "POST",
        body: JSON.stringify({
          source: values.source, severity: values.severity, title: values.title, description: values.description, containment: values.containment,
          idempotencyKey: key, productId: item?.id ?? inspection?.productId ?? undefined, inspectionId: values.inspectionId || undefined,
          productionOrderId: inspection?.productionOrderId ?? undefined,
          ...(values.quantityAffected ? { quantityAffected: Number(values.quantityAffected) } : {}),
        }),
      }));
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title="Raise a non-conformance" size="large">
      <form className="inv-dialog" onSubmit={submit}>
        <div className="inv-dialog__grid">
          <div className="inv-field"><label htmlFor="nc-source">Source *</label><select id="nc-source" value={values.source} onChange={set("source")}>{Object.entries(SOURCES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="inv-field"><label htmlFor="nc-sev">Severity *</label><select id="nc-sev" value={values.severity} onChange={set("severity")}><option value="MINOR">Minor</option><option value="MAJOR">Major</option><option value="CRITICAL">Critical</option></select></div>
          <div className="inv-field">
            <label htmlFor="nc-insp">Inspection</label>
            <select id="nc-insp" value={values.inspectionId} onChange={set("inspectionId")}>
              <option value="">None</option>
              {(inspections.data?.inspections ?? []).map((row) => <option key={row.id} value={row.id}>{row.inspectionNumber} · {row.sku ?? ""} · {String(row.inspectionType ?? "").toLowerCase()}</option>)}
            </select>
          </div>
          <div className="inv-field"><label htmlFor="nc-qty">Quantity affected</label><input id="nc-qty" type="number" min="0" step="any" value={values.quantityAffected} onChange={set("quantityAffected")} /></div>
        </div>
        {!values.inspectionId && <ItemPicker label="Item (optional)" value={item} onChange={setItem} />}
        <div className="inv-field"><label htmlFor="nc-title">Title *</label><input id="nc-title" required minLength={3} maxLength={160} value={values.title} onChange={set("title")} /></div>
        <div className="inv-field"><label htmlFor="nc-desc">What is wrong *</label><textarea id="nc-desc" required minLength={3} rows={3} maxLength={4000} value={values.description} onChange={set("description")} /></div>
        <div className="inv-field"><label htmlFor="nc-cont">Immediate containment</label><textarea id="nc-cont" rows={2} maxLength={2000} value={values.containment} onChange={set("containment")} /></div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>Raise NCR</Button>
        </div>
      </form>
    </Modal>
  );
}

function NcrDetail({ id, onClose, onChanged }) {
  const { can } = useCurrentUser();
  const result = useApiData(`/api/quality/ncrs/${encodeURIComponent(id)}`);
  const data = result.data;
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const values = form ?? (data ? { containment: data.containment ?? "", rootCause: data.rootCause ?? "", disposition: data.disposition ?? "" } : null);
  const editable = data && ["OPEN", "INVESTIGATING"].includes(data.status) && can("quality:create");

  async function run(label, work) {
    setBusy(label);
    setError("");
    try {
      await work();
      setForm(null);
      result.reload();
      onChanged();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy("");
    }
  }
  const act = (action) => {
    const note = action === "investigate" ? "" : window.prompt(action === "close" ? "Closing note (optional)" : "Reason for cancelling?");
    if (note === null || (action === "cancel" && !note)) return;
    run(action, () => apiRequest(`/api/quality/ncrs/${id}`, { method: "PATCH", body: JSON.stringify({ action, note }) }));
  };
  const capaAct = (capa, action) => {
    const note = action === "start" ? "" : window.prompt({ complete: "What was done?", verify: "Verification evidence?", reopen: "Why was it not effective?", cancel: "Reason for cancelling?" }[action]);
    if (note === null || (action !== "start" && !note)) return;
    run(capa.id + action, () => apiRequest(`/api/quality/capas/${capa.id}`, { method: "PATCH", body: JSON.stringify({ action, note }) }));
  };

  return (
    <Modal open onClose={onClose} title={data ? `${data.ncrNumber}: ${data.title}` : "NCR"} size="large">
      {result.error ? <p className="inv-dialog__error" role="alert">{result.error}</p> : !data ? <p className="inv-state" role="status">Loading…</p> : (
        <div className="inv-dialog">
          <p><QBadge value={data.status} /> <QBadge value={data.severity} /> · {SOURCES[data.source]} · raised {data.createdAt.slice(0, 10)}{data.quantityAffected ? ` · ${data.quantityAffected} affected` : ""}</p>
          <p>
            {[data.links.product && `Item ${data.links.product}`, data.links.inspection && `Inspection ${data.links.inspection}`, data.links.productionOrder && `Production order ${data.links.productionOrder}`, data.links.supplier && `Supplier ${data.links.supplier}`, data.links.customer && `Customer ${data.links.customer}`].filter(Boolean).join(" · ")}
          </p>
          <p style={{ whiteSpace: "pre-wrap" }}>{data.description}</p>
          <div className="inv-field"><label htmlFor="nd-cont">Containment</label><textarea id="nd-cont" rows={2} disabled={!editable} value={values.containment} onChange={(event) => setForm({ ...values, containment: event.target.value })} /></div>
          <div className="inv-field"><label htmlFor="nd-root">Root cause</label><textarea id="nd-root" rows={3} disabled={!editable} value={values.rootCause} onChange={(event) => setForm({ ...values, rootCause: event.target.value })} /></div>
          <div className="inv-field">
            <label htmlFor="nd-disp">Disposition</label>
            <select id="nd-disp" disabled={!editable} value={values.disposition} onChange={(event) => setForm({ ...values, disposition: event.target.value })}>
              <option value="">Not decided</option>
              {Object.entries(DISPOSITIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          {data.closeNote && <p>{data.status === "CANCELLED" ? "Cancelled" : "Closed"}: {data.closeNote}</p>}
          <h3>Actions (CAPA)</h3>
          {data.capas.length === 0 ? <p className="inv-state">No actions yet.</p> : (
            <div className="inv-table-wrap">
              <table className="inv-table">
                <thead><tr><th>Action</th><th>Owner</th><th>Due</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {data.capas.map((capa) => (
                    <tr key={capa.id}>
                      <td data-label="Action"><strong>{capa.capaNumber}</strong> {capa.title}<small>{capa.actionType.toLowerCase()}</small></td>
                      <td data-label="Owner">{capa.ownerName}</td>
                      <td data-label="Due">{capa.dueDate}{capa.overdue && <small className="inv-neg">Overdue</small>}</td>
                      <td data-label="Status"><QBadge value={capa.status} /></td>
                      <td data-label="">
                        {capa.status === "OPEN" && can("quality:create") && <button type="button" className="inv-link-button" onClick={() => capaAct(capa, "start")}>Start</button>}
                        {["OPEN", "IN_PROGRESS"].includes(capa.status) && can("quality:create") && <> <button type="button" className="inv-link-button" onClick={() => capaAct(capa, "complete")}>Complete</button></>}
                        {capa.status === "DONE" && can("quality:approve") && <><button type="button" className="inv-link-button" onClick={() => capaAct(capa, "verify")}>Verify</button> <button type="button" className="inv-link-button" onClick={() => capaAct(capa, "reopen")}>Not effective</button></>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {error && <p className="inv-dialog__error" role="alert">{error}</p>}
          <div className="inv-dialog__actions">
            {editable && <Button variant="secondary" disabled={!form} loading={busy === "save"} onClick={() => run("save", () => apiRequest(`/api/quality/ncrs/${id}`, { method: "PUT", body: JSON.stringify(values) }))}>Save investigation</Button>}
            {editable && <Button variant="secondary" onClick={() => setAdding(true)}>Add action</Button>}
            {data.status === "OPEN" && can("quality:create") && <Button variant="secondary" loading={busy === "investigate"} onClick={() => act("investigate")}>Start investigation</Button>}
            {["OPEN", "INVESTIGATING"].includes(data.status) && can("quality:approve") && <Button variant="primary" disabled={Boolean(form)} loading={busy === "close"} onClick={() => act("close")}>Close NCR</Button>}
            {["OPEN", "INVESTIGATING"].includes(data.status) && can("quality:approve") && <Button variant="secondary" loading={busy === "cancel"} onClick={() => act("cancel")}>Cancel NCR</Button>}
          </div>
        </div>
      )}
      {adding && data && <CapaDialog ncr={data} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); result.reload(); onChanged(); }} />}
    </Modal>
  );
}

export default function NcrClient({ initialNcr = "" }) {
  const { can } = useCurrentUser();
  const [status, setStatus] = useState("ACTIVE");
  const [severity, setSeverity] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState(initialNcr);
  const list = useApiData(`/api/quality/ncrs${toQuery({ status, severity, search, page, pageSize: 25 })}`);
  const rows = list.data?.ncrs ?? [];

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/quality">Quality</Link></p>
          <h1>Non-conformance reports</h1>
          <p>Raise, investigate and close non-conformances. An NCR closes only with a root cause, a disposition and every action verified.</p>
        </div>
        <div className="inv-header__actions">
          <Link className="inv-link-button" href="/reports/quality/ncr">NCR report</Link>
          {can("quality:create") && <Button variant="primary" onClick={() => setCreating(true)}>Raise NCR</Button>}
        </div>
      </header>
      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field"><label htmlFor="nc-search">Search</label><input id="nc-search" type="search" placeholder="NCR, title or item" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
          <div className="inv-field">
            <label htmlFor="nc-status">Status</label>
            <select id="nc-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="ACTIVE">Open and investigating</option><option value="OPEN">Open</option><option value="INVESTIGATING">Investigating</option><option value="CLOSED">Closed</option><option value="CANCELLED">Cancelled</option><option value="">All</option>
            </select>
          </div>
          <div className="inv-field">
            <label htmlFor="nc-sevf">Severity</label>
            <select id="nc-sevf" value={severity} onChange={(event) => { setSeverity(event.target.value); setPage(1); }}><option value="">All</option><option value="CRITICAL">Critical</option><option value="MAJOR">Major</option><option value="MINOR">Minor</option></select>
          </div>
        </div>
        {list.error ? <p className="inv-state inv-state--error" role="alert">{list.error}</p> : !list.data ? <p className="inv-state" role="status">Loading NCRs…</p> : rows.length === 0 ? <p className="inv-state">No NCRs match.</p> : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>NCR</th><th>Title</th><th>Source</th><th>Severity</th><th className="inv-num">Open actions</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="NCR"><button type="button" className="inv-link-button" onClick={() => setViewing(row.id)}><strong>{row.ncrNumber}</strong></button><small>{row.createdAt.slice(0, 10)}</small></td>
                    <td data-label="Title">{row.title}{row.sku && <small>{row.sku}</small>}</td>
                    <td data-label="Source">{SOURCES[row.source]}</td>
                    <td data-label="Severity"><QBadge value={row.severity} /></td>
                    <td data-label="Open actions" className="inv-num">{row.openActions}</td>
                    <td data-label="Status"><QBadge value={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={list.data?.hasMore} onChange={setPage} disabled={list.loading} />
      </section>
      {creating && <NewNcrDialog onClose={() => setCreating(false)} onSaved={(ncr) => { setCreating(false); list.reload(); setViewing(ncr.id); }} />}
      {viewing && <NcrDetail key={viewing} id={viewing} onClose={() => setViewing("")} onChanged={() => list.reload()} />}
    </main>
  );
}
