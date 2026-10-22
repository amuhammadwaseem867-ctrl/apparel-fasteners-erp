"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TYPE_LABEL = { HOLIDAY: "Holiday", SHUTDOWN: "Shutdown", WORKING: "Extra working day" };

function shiftMonth(month, delta) {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

function DayDialog({ day, onClose, onSaved }) {
  const { can } = useCurrentUser();
  const [dayType, setDayType] = useState(day.override?.dayType ?? (day.working ? "HOLIDAY" : "WORKING"));
  const [note, setNote] = useState(day.override?.note ?? "");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function run(label, request) {
    setBusy(label);
    setError("");
    try { await request(); onSaved(); } catch (cause) { setError(cause.message); setBusy(""); }
  }

  return (
    <Modal open onClose={busy ? undefined : onClose} title={new Date(`${day.date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })} size="medium">
      <div className="inv-dialog">
        <p>{day.working ? "Working day" : "Not a working day"}{day.override ? ` (${TYPE_LABEL[day.override.dayType].toLowerCase()}${day.override.note ? `: ${day.override.note}` : ""})` : ""}.</p>
        {day.production.length > 0 && <div><strong>Production due</strong><ul>{day.production.map((row) => <li key={row.id}><Link href={`/production/orders/${row.id}`}>{row.number}</Link> · {row.sku} · {row.quantity} {row.unit} · {row.status.toLowerCase()}</li>)}</ul></div>}
        {day.deliveries.length > 0 && <div><strong>Customer deliveries due</strong><ul>{day.deliveries.map((row) => <li key={row.id}><Link href={`/sales/orders/${row.id}`}>{row.number}</Link> · {row.customer}</li>)}</ul></div>}
        {day.purchases.length > 0 && <div><strong>Supplier deliveries expected</strong><ul>{day.purchases.map((row) => <li key={row.id}><Link href={`/procurement/purchase-orders/${row.id}`}>{row.number}</Link> · {row.supplier}</li>)}</ul></div>}
        {can("production:update") && (
          <>
            <div className="inv-dialog__grid">
              <div className="inv-field"><label htmlFor="cd-type">Mark as</label><select id="cd-type" value={dayType} onChange={(event) => setDayType(event.target.value)}>{Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div className="inv-field"><label htmlFor="cd-note">Note</label><input id="cd-note" maxLength={120} placeholder="e.g. Eid ul-Fitr" value={note} onChange={(event) => setNote(event.target.value)} /></div>
            </div>
            <p className="inv-field__hint">Holidays and shutdowns are not counted as leave days and reduce capacity.</p>
          </>
        )}
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          {day.override && can("production:update") && <Button variant="secondary" loading={busy === "clear"} onClick={() => run("clear", () => apiRequest(`/api/planning/calendar${toQuery({ date: day.date })}`, { method: "DELETE" }))}>Remove override</Button>}
          {can("production:update") && <Button variant="primary" loading={busy === "save"} onClick={() => run("save", () => apiRequest("/api/planning/calendar", { method: "PUT", body: JSON.stringify({ date: day.date, dayType, note }) }))}>Save</Button>}
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}

export default function CalendarPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selected, setSelected] = useState(null);
  const result = useApiData(`/api/planning/calendar${toQuery({ month })}`);
  const data = result.data;
  const lead = data ? data.days[0].weekday : 0;

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/planning">Planning</Link></p>
          <h1>Planning calendar</h1>
          <p>Working days, holidays and what is due: production orders, customer deliveries and supplier deliveries. Weekly off days are set in Administration → Settings{data && !data.weeklyOffConfigured ? " (currently the default: Sunday)" : ""}.</p>
        </div>
        <div className="inv-header__actions">
          <Button variant="secondary" onClick={() => setMonth(shiftMonth(month, -1))}>‹ Previous</Button>
          <input aria-label="Month" type="month" value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} />
          <Button variant="secondary" onClick={() => setMonth(shiftMonth(month, 1))}>Next ›</Button>
        </div>
      </header>
      <section className="inv-card">
        {result.error ? <p className="inv-state inv-state--error" role="alert">{result.error}</p> : !data ? <p className="inv-state" role="status">Loading calendar…</p> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4, padding: 12 }}>
            {WEEKDAYS.map((name) => <div key={name} style={{ fontWeight: 600, fontSize: 12, textAlign: "center" }}>{name}</div>)}
            {Array.from({ length: lead }, (_, index) => <div key={`lead-${index}`} />)}
            {data.days.map((day) => (
              <button key={day.date} type="button" onClick={() => setSelected(day)} aria-label={`${day.date}${day.working ? "" : ", not working"}`}
                style={{ minHeight: 76, textAlign: "left", padding: 6, border: "1px solid #e5e7eb", borderRadius: 6, background: day.working ? "#fff" : "#f3f4f6", cursor: "pointer", overflow: "hidden", fontSize: 11 }}>
                <strong style={{ fontSize: 13 }}>{Number(day.date.slice(8))}</strong>
                {day.override && <div style={{ color: day.override.dayType === "WORKING" ? "#166534" : "#991b1b" }}>{day.override.note || TYPE_LABEL[day.override.dayType]}</div>}
                {day.production.length > 0 && <div>⚙ {day.production.length} due</div>}
                {day.deliveries.length > 0 && <div>🚚 {day.deliveries.length} to ship</div>}
                {day.purchases.length > 0 && <div>📦 {day.purchases.length} arriving</div>}
              </button>
            ))}
          </div>
        )}
      </section>
      {selected && <DayDialog key={selected.date} day={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); result.reload(); }} />}
    </main>
  );
}

