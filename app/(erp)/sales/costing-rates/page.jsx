"use client";

/*
 * Costing rates (D-055): the numbers the order costing report uses, per
 * zipper gauge and overall. Prefilled from the master costing sheet until
 * saved. Open to sales:update while costing is being tried out.
 */

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import { apiRequest } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const GLOBAL_FIELDS = [
  ["brassPricePerKg", "Brass price per kg (PKR)"],
  ["packingPerPc", "Packing per piece (PKR)"],
  ["scrapRecoveryPercent", "Brass scrap recovered (%)"],
  ["teethDeductionCm", "Teeth length = size minus (cm)"],
  ["wastageSmallKg", "Wastage under 1,000 m (kg)"],
  ["wastageMediumKg", "Wastage 1,000–2,000 m (kg)"],
  ["wastageLargeKgPer1000m", "Wastage above 2,000 m, per 1,000 m (kg)"],
];

const GAUGE_FIELDS = [
  ["marginCm", "Cut margin (cm)"],
  ["rollMeters", "Roll length (m)"],
  ["tapeMetersPerKg", "Tape meters per kg"],
  ["brassGramsPerMeter", "Brass per meter (g)"],
  ["rollWeightKg", "Roll weight (kg, for wastage)"],
  ["brassKgPerRoll", "Brass per roll (kg, for wastage)"],
  ["openEndGapCm", "Open-end gap (cm)"],
  ["tapePricePerKg", "Tape price per kg"],
  ["dyeingPerMeter", "Dyeing per meter"],
  ["platingPerMeter", "Plating per meter"],
  ["bottomStopPerPc", "Bottom stop per pc (close end)"],
  ["pinBoxSetPerPc", "Pin box set per pc (open end)"],
  ["topStopPerPc", "Top stop per pc (×2)"],
  ["pullerPerPc", "Puller / slider per pc"],
];

const blankGauge = (gauge = "") => ({ gauge, ...Object.fromEntries(GAUGE_FIELDS.map(([key]) => [key, 0])) });

function RatesForm({ initial, editable, onSaved }) {
  const [rates, setRates] = useState(() => ({ ...initial, platedText: initial.platedFinishes.join(", ") }));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const setGlobal = (key) => (event) => setRates((current) => ({ ...current, [key]: event.target.value }));
  const setGauge = (index, key) => (event) => setRates((current) => ({
    ...current,
    gauges: current.gauges.map((gauge, at) => (at === index ? { ...gauge, [key]: event.target.value } : gauge)),
  }));

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const body = {
        ...Object.fromEntries(GLOBAL_FIELDS.map(([key]) => [key, Number(rates[key])])),
        platedFinishes: rates.platedText.split(",").map((word) => word.trim()).filter(Boolean),
        gauges: rates.gauges.map((gauge) => ({ gauge: String(gauge.gauge), ...Object.fromEntries(GAUGE_FIELDS.map(([key]) => [key, Number(gauge[key])])) })),
      };
      await apiRequest("/api/costing/rates", { method: "PUT", body: JSON.stringify(body) });
      setMessage("Saved. Every order's costing report now uses these rates.");
      onSaved();
    } catch (cause) {
      setMessage(cause.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save}>
      <section className="inv-card">
        <div className="inv-card__header"><h2>Overall</h2></div>
        <div className="inv-dialog__grid" style={{ padding: 16 }}>
          {GLOBAL_FIELDS.map(([key, label]) => (
            <div className="inv-field" key={key}><label htmlFor={`cr-${key}`}>{label}</label><input id={`cr-${key}`} type="number" step="any" min="0" required disabled={!editable} value={rates[key]} onChange={setGlobal(key)} /></div>
          ))}
          <div className="inv-field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="cr-plated">Plated finishes (words, comma separated)</label>
            <input id="cr-plated" disabled={!editable} value={rates.platedText} onChange={setGlobal("platedText")} />
            <small className="inv-field__hint">A line whose finish contains one of these words is charged plating per meter.</small>
          </div>
        </div>
      </section>
      <section className="inv-card">
        <div className="inv-card__header">
          <h2>Per zipper gauge</h2>
          {editable && <button type="button" className="inv-link-button" onClick={() => setRates((current) => ({ ...current, gauges: [...current.gauges, blankGauge()] }))}>Add gauge</button>}
        </div>
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead><tr><th>Rate</th>{rates.gauges.map((gauge, index) => (
              <th key={index}>#<input aria-label="Gauge" style={{ width: 60 }} disabled={!editable} value={gauge.gauge} onChange={setGauge(index, "gauge")} /></th>
            ))}</tr></thead>
            <tbody>
              {GAUGE_FIELDS.map(([key, label]) => (
                <tr key={key}>
                  <td data-label="Rate">{label}</td>
                  {rates.gauges.map((gauge, index) => (
                    <td key={index} data-label={`#${gauge.gauge}`}><input aria-label={`${label} #${gauge.gauge}`} type="number" step="any" min="0" required disabled={!editable} style={{ width: 110 }} value={gauge[key]} onChange={setGauge(index, key)} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {message && <p className="inv-state" role="status">{message}</p>}
      {editable && <div className="inv-dialog__actions"><Button type="submit" variant="primary" loading={saving}>Save costing rates</Button></div>}
    </form>
  );
}

export default function CostingRatesPage() {
  const { can } = useCurrentUser();
  const rates = useApiData("/api/costing/rates");
  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/sales/orders">2. Orders</Link></p>
          <h1>Costing rates</h1>
          <p>The prices and factors the order costing report uses. {rates.data && !rates.data.configured ? "Showing the master costing sheet\u2019s rates until you save." : ""}</p>
        </div>
      </header>
      {rates.error ? <p className="inv-state inv-state--error" role="alert">{rates.error}</p>
        : !rates.data ? <p className="inv-state" role="status">Loading rates…</p>
          : <RatesForm key={JSON.stringify(rates.data)} initial={rates.data} editable={can("sales:update")} onSaved={rates.reload} />}
    </main>
  );
}
