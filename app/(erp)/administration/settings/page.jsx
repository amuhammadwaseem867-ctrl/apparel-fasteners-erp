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
  ["Commercial terms and shipment (defaults on the invoice)", [["productionTime", "Production time"], ["paymentTerms", "Payment terms"], ["shipmentTerms", "Shipment terms"], ["shipmentMode", "Shipment mode"], ["portOfLoading", "Port of loading"], ["countryOfOrigin", "Country of origin"]]],
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
      {result.error ? <p className="inv-state inv-state--error" role="alert">{result.error}</p> : !data ? <p className="inv-state" role="status">Loading settings…</p> : (
        <>
          <section className="inv-card">
            <div className="inv-card__header"><h2>Company profile {!data["company.profile"].value.configured && <span className="inv-badge inv-badge--warning">Not yet set</span>}</h2></div>
            <CompanyForm value={data["company.profile"].value} editable={editable} onSaved={result.reload} />
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
