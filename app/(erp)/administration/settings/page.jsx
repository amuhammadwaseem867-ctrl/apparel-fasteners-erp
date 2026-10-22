"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import { PRODUCTION_STAGES } from "@/config/production";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";
import "./Settings.css";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const COMPANY_GROUPS = [
  ["Company", [["name", "Trading name *"], ["legalName", "Legal name"], ["address", "Address"], ["phone", "Phone"], ["email", "Email"], ["website", "Website"], ["taxRegistration", "Tax registration (NTN / STRN)"]]],
  ["Bank / payment details (sales tax invoice)", [["bankName", "Bank name"], ["accountName", "Account name"], ["accountNumber", "Account no."], ["iban", "IBAN"], ["swiftCode", "SWIFT code"], ["bankBranch", "Branch / address"]]],
  ["Commercial terms and shipment (defaults on the invoice)", [["productionTime", "Production time"], ["paymentTerms", "Payment terms"], ["shipmentTerms", "Shipment terms"], ["shipmentMode", "Shipment mode"], ["portOfLoading", "Port of loading"], ["countryOfOrigin", "Country of origin"], ["hsCode", "HS code"]]],
];
const COMPANY_FIELDS = COMPANY_GROUPS.flatMap(([, fields]) => fields);

function CompanyForm({ value, editable, onSaved }) {
  const [form, setForm] = useState(() => Object.fromEntries(COMPANY_FIELDS.map(([key]) => [key, value[key] ?? ""])));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ error: "", notice: "" });

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage({ error: "", notice: "" });
    try {
      await apiRequest("/api/settings/company.profile", { method: "PUT", body: JSON.stringify(form) });
      setMessage({ error: "", notice: "Saved. New prints use these details." });
      onSaved();
    } catch (cause) {
      setMessage({ error: cause.message, notice: "" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="inv-dialog" onSubmit={submit}>
      {COMPANY_GROUPS.map(([title, fields]) => (
        <fieldset key={title} className="settings-group">
          <legend>{title}</legend>
          <div className="inv-dialog__grid">
            {fields.map(([key, label]) => (
              <div className="inv-field" key={key}><label htmlFor={`co-${key}`}>{label}</label><input id={`co-${key}`} type={key === "email" ? "email" : "text"} required={key === "name"} disabled={!editable} maxLength={key === "address" ? 300 : key === "taxRegistration" || key === "accountNumber" || key === "iban" ? 60 : key === "swiftCode" ? 30 : 120} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></div>
            ))}
          </div>
        </fieldset>
      ))}
      {message.error && <p className="inv-dialog__error" role="alert">{message.error}</p>}
      {message.notice && <p className="inv-field__hint" role="status">{message.notice}</p>}
      {editable && <div className="inv-dialog__actions"><Button type="submit" variant="primary" loading={saving}>Save company profile</Button></div>}
    </form>
  );
}

function WeeklyOffForm({ value, editable, onSaved }) {
  const [days, setDays] = useState(value.days ?? []);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ error: "", notice: "" });

  async function save() {
    setSaving(true);
    setMessage({ error: "", notice: "" });
    try {
      await apiRequest("/api/settings/planning.weeklyOff", { method: "PUT", body: JSON.stringify({ days }) });
      setMessage({ error: "", notice: "Saved." });
      onSaved();
    } catch (cause) {
      setMessage({ error: cause.message, notice: "" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="inv-dialog">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {WEEKDAYS.map((name, index) => (
          <label key={name} className="inv-check" htmlFor={`wo-${index}`}><input id={`wo-${index}`} type="checkbox" disabled={!editable} checked={days.includes(index)} onChange={(event) => setDays((current) => (event.target.checked ? [...current, index] : current.filter((day) => day !== index)))} /> {name}</label>
        ))}
      </div>
      {message.error && <p className="inv-dialog__error" role="alert">{message.error}</p>}
      {message.notice && <p className="inv-field__hint" role="status">{message.notice}</p>}
      {editable && <div className="inv-dialog__actions"><Button variant="primary" loading={saving} onClick={save}>Save weekly off days</Button></div>}
    </div>
  );
}

const CHECK_STAGES = PRODUCTION_STAGES.filter((stage) => stage.sequence <= 6);
const slug = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36) || "check";

/* Production check points (D-040): what each of stages 1â€“6 must pass before it completes. */
function CheckpointsForm({ value, editable, onSaved }) {
  const [stages, setStages] = useState(() => Object.fromEntries(CHECK_STAGES.map((stage) => [stage.key, (value.stages?.[stage.key] ?? []).map((point) => ({ ...point, rowId: point.key }))])));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ error: "", notice: "" });
  const update = (stageKey, rowId, field, fieldValue) => setStages((current) => ({ ...current, [stageKey]: current[stageKey].map((point) => (point.rowId === rowId ? { ...point, [field]: fieldValue } : point)) }));

  async function save() {
    setSaving(true);
    setMessage({ error: "", notice: "" });
    try {
      const payload = Object.fromEntries(Object.entries(stages).map(([stageKey, points]) => {
        const used = new Set();
        return [stageKey, points.filter((point) => point.label.trim()).map(({ rowId, ...point }) => {
          let key = point.key || slug(point.label);
          for (let n = 2; used.has(key); n += 1) key = `${slug(point.label).slice(0, 33)}-${n}`;
          used.add(key);
          return { ...point, key, label: point.label.trim() };
        })];
      }));
      await apiRequest("/api/settings/production.checkpoints", { method: "PUT", body: JSON.stringify({ stages: payload }) });
      setMessage({ error: "", notice: "Saved. Stages in progress use the new check points straight away." });
      onSaved();
    } catch (cause) {
      setMessage({ error: cause.message, notice: "" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="inv-dialog">
      {CHECK_STAGES.map((stage) => (
        <fieldset key={stage.key} className="settings-group">
          <legend>{stage.sequence}. {stage.label}</legend>
          <div className="inv-table-wrap">
            <table className="inv-table settings-checks">
              <thead><tr><th>Check point</th><th>Type</th><th>Unit</th><th>Limit / standard</th><th>Required</th><th /></tr></thead>
              <tbody>
                {stages[stage.key].map((point) => (
                  <tr key={point.rowId}>
                    <td data-label="Check point"><input aria-label="Check point" disabled={!editable} maxLength={160} value={point.label} onChange={(event) => update(stage.key, point.rowId, "label", event.target.value)} /></td>
                    <td data-label="Type">
                      <select aria-label="Type" disabled={!editable} value={point.kind} onChange={(event) => update(stage.key, point.rowId, "kind", event.target.value)}>
                        <option value="check">Pass / fail</option>
                        <option value="measure">Measured value</option>
                      </select>
                    </td>
                    <td data-label="Unit"><input aria-label="Unit" disabled={!editable} maxLength={20} value={point.unit} onChange={(event) => update(stage.key, point.rowId, "unit", event.target.value)} /></td>
                    <td data-label="Limit"><input aria-label="Limit" disabled={!editable} maxLength={120} placeholder="e.g. Â±0.5 mm, buyer spec" value={point.limit} onChange={(event) => update(stage.key, point.rowId, "limit", event.target.value)} /></td>
                    <td data-label="Required"><input type="checkbox" aria-label="Required" disabled={!editable} checked={point.required} onChange={(event) => update(stage.key, point.rowId, "required", event.target.checked)} /></td>
                    <td data-label="">{editable && <button type="button" className="inv-text-button" onClick={() => setStages((current) => ({ ...current, [stage.key]: current[stage.key].filter((item) => item.rowId !== point.rowId) }))}>Remove</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editable && <button type="button" className="inv-text-button" onClick={() => setStages((current) => ({ ...current, [stage.key]: [...current[stage.key], { rowId: crypto.randomUUID(), key: "", label: "", kind: "check", unit: "", limit: "", required: true }] }))}>+ Add check point</button>}
        </fieldset>
      ))}
      {message.error && <p className="inv-dialog__error" role="alert">{message.error}</p>}
      {message.notice && <p className="inv-field__hint" role="status">{message.notice}</p>}
      {editable && <div className="inv-dialog__actions"><Button variant="primary" loading={saving} onClick={save}>Save check points</Button></div>}
    </div>
  );
}

export default function SystemSettingsPage() {
  const { can } = useCurrentUser();
  const result = useApiData("/api/settings?all=1");
  const data = result.data;
  const editable = can("roles:update");

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/administration">Administration</Link></p>
          <h1>System settings</h1>
          <p>Company details printed on every document, and the working week used by planning. Changes are audited. Users, roles and the audit log have their own pages.</p>
        </div>
      </header>
      {result.error ? <p className="inv-state inv-state--error" role="alert">{result.error}</p> : !data ? <p className="inv-state" role="status">Loading settingsâ€¦</p> : (
        <>
          <section className="inv-card">
            <div className="inv-card__header"><h2>Company profile {!data["company.profile"].value.configured && <span className="inv-badge inv-badge--warning">Not yet set</span>}</h2></div>
            <CompanyForm value={data["company.profile"].value} editable={editable} onSaved={result.reload} />
          </section>
          <section className="inv-card">
            <div className="inv-card__header"><h2>Production check points {!data["production.checkpoints"].value.configured && <span className="inv-badge inv-badge--warning">Default list</span>}</h2></div>
            <p className="inv-field__hint" style={{ padding: "0 18px" }}>A stage completes only when every required check point has passed. Quality Check, Packing and Delivered are checked by their own documents. Fill the limits from your buyers&apos; specifications.</p>
            <CheckpointsForm value={data["production.checkpoints"].value} editable={editable} onSaved={result.reload} />
          </section>
          <section className="inv-card">
            <div className="inv-card__header"><h2>Weekly off days {!data["planning.weeklyOff"].value.configured && <span className="inv-badge inv-badge--warning">Default</span>}</h2></div>
            <p className="inv-field__hint" style={{ padding: "0 18px" }}>Used by capacity planning, the planning calendar and production plans. Holidays are set day by day on the <Link href="/planning/calendar">planning calendar</Link>.</p>
            <WeeklyOffForm value={data["planning.weeklyOff"].value} editable={editable} onSaved={result.reload} />
          </section>
        </>
      )}
      <section className="inv-card">
        <div className="inv-card__header"><h2>Built-in configuration (reference)</h2></div>
        <div className="inv-table-wrap">
          <table className="inv-table">
            <tbody>
              <tr><td><strong>Production stages</strong></td><td>{PRODUCTION_STAGES.map((stage) => `${stage.sequence}. ${stage.label}`).join(" · ")}</td></tr>
              <tr><td><strong>Sales order statuses</strong></td><td>Draft · Approved · Cancelled</td></tr>
              <tr><td><strong>Money</strong></td><td>Exact cents, rounded half up; prices up to 6 decimals</td></tr>
              <tr><td><strong>Roles and permissions</strong></td><td><Link href="/administration/roles">Manage on the Roles page</Link></td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

