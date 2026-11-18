"use client";

/*
 * Quick costing (D-059): type an order's lines and get its costing
 * document ready to print, for quick documentation. It only calculates:
 * no order, invoice, stock or accounting entry is made, and nothing is
 * saved. The document is the same as an order's costing report.
 */

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import { apiRequest } from "@/lib/api/client";
import { QUICK_COSTING_KEY } from "@/lib/costing/quickCosting";

import "@/components/inventory/InventoryWorkspace.css";

const ITEMS = [
  "#5 Metal Zipper Close End", "#5 Metal Zipper Open End", "#5 Metal Zipper 2 Way Open End",
  "#4.5 Metal Zipper Close End", "#4.5 Metal Zipper Open End", "#4.5 Metal Zipper 2 Way Open End",
];
const today = () => new Date().toISOString().slice(0, 10);
const blankLine = () => ({ productName: "#5 Metal Zipper Close End", size: "", finish: "", quantity: "", unit: "Pcs", unitPrice: "" });
const n = (value, digits = 2) => Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export default function QuickCostingPage() {
  const [header, setHeader] = useState({ customerName: "", reference: "", date: today() });
  const [lines, setLines] = useState([blankLine()]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(null);

  const setField = (key) => (event) => { setHeader((current) => ({ ...current, [key]: event.target.value })); setResult(null); setSaved(null); };
  const setLine = (index, key) => (event) => {
    setLines((current) => current.map((line, at) => (at === index ? { ...line, [key]: event.target.value } : line)));
    setResult(null);
    setSaved(null);
  };

  const requestBody = () => JSON.stringify({
    ...header,
    lines: lines.map((line) => ({ ...line, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice || 0) })),
  });

  /* Saves to the costing history (still no order or invoice), then opens its printout. */
  async function saveToHistory() {
    if (saved) { window.open(`/print/costing/records/${saved.id}`, "_blank"); return; }
    setBusy(true);
    setError("");
    try {
      const response = await apiRequest("/api/costing/records", { method: "POST", body: requestBody() });
      const record = response.data ?? response;
      setSaved(record);
      setResult(record.data);
      window.open(`/print/costing/records/${record.id}`, "_blank");
    } catch (cause) {
      setError(cause.details?.map?.((issue) => issue.message).join(" ") || cause.message);
    } finally {
      setBusy(false);
    }
  }

  async function calculate(event) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await apiRequest("/api/costing/quick", { method: "POST", body: requestBody() });
      setResult(response.data ?? response);
      return response.data ?? response;
    } catch (cause) {
      setError(cause.details?.map?.((issue) => issue.message).join(" ") || cause.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function print() {
    const data = result ?? await calculate();
    if (!data) return;
    try {
      sessionStorage.setItem(QUICK_COSTING_KEY, JSON.stringify(data));
    } catch {
      setError("This browser would not keep the document for printing. Allow site data and try again.");
      return;
    }
    window.open("/print/costing/quick", "_blank");
  }

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/sales/orders">2. Orders</Link></p>
          <h1>Quick costing</h1>
          <p>Type the lines, then print the costing document, or save it to the costing history. No order, invoice or accounting entry is ever made.</p>
        </div>
        <div className="inv-header__actions">
          <Link className="inv-link-button" href="/sales/costing-history">Costing history</Link>
          <Link className="inv-link-button" href="/sales/costing-rates">Costing rates</Link>
        </div>
      </header>

      <form onSubmit={calculate}>
        <section className="inv-card">
          <div className="inv-card__header"><h2>Details</h2></div>
          <div className="inv-dialog__grid" style={{ padding: 16 }}>
            <div className="inv-field"><label htmlFor="qc-customer">Customer (optional)</label><input id="qc-customer" value={header.customerName} onChange={setField("customerName")} /></div>
            <div className="inv-field"><label htmlFor="qc-reference">Reference (optional)</label><input id="qc-reference" placeholder="e.g. PO-123 or Quote 5" value={header.reference} onChange={setField("reference")} /></div>
            <div className="inv-field"><label htmlFor="qc-date">Date</label><input id="qc-date" type="date" required value={header.date} onChange={setField("date")} /></div>
          </div>
        </section>

        <section className="inv-card">
          <div className="inv-card__header">
            <h2>Lines</h2>
            <button type="button" className="inv-link-button" onClick={() => { setLines((current) => [...current, blankLine()]); setResult(null); }}>Add line</button>
          </div>
          <datalist id="qc-items">{ITEMS.map((item) => <option key={item} value={item} />)}</datalist>
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>#</th><th>Item (with gauge, e.g. #5 … Open End)</th><th>Size</th><th>Finish</th><th className="inv-num">Quantity</th><th>Unit</th><th className="inv-num">Rate per pc (optional)</th><th /></tr></thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index}>
                    <td data-label="#">{index + 1}</td>
                    <td data-label="Item"><input aria-label={`Line ${index + 1} item`} list="qc-items" required value={line.productName} onChange={setLine(index, "productName")} style={{ width: "100%", minWidth: 220 }} /></td>
                    <td data-label="Size"><input aria-label={`Line ${index + 1} size`} placeholder="20 Inch or 14 cm" required={line.unit === "Pcs"} value={line.size} onChange={setLine(index, "size")} style={{ width: 130 }} /></td>
                    <td data-label="Finish"><input aria-label={`Line ${index + 1} finish`} placeholder="Antique Brass" value={line.finish} onChange={setLine(index, "finish")} style={{ width: 150 }} /></td>
                    <td data-label="Quantity" className="inv-num"><input aria-label={`Line ${index + 1} quantity`} type="number" min="1" step="1" required value={line.quantity} onChange={setLine(index, "quantity")} style={{ width: 110 }} /></td>
                    <td data-label="Unit"><select aria-label={`Line ${index + 1} unit`} value={line.unit} onChange={setLine(index, "unit")}><option value="Pcs">Pcs</option><option value="Mtr">Mtr</option><option value="Roll">Roll</option></select></td>
                    <td data-label="Rate" className="inv-num"><input aria-label={`Line ${index + 1} rate`} type="number" min="0" step="any" value={line.unitPrice} onChange={setLine(index, "unitPrice")} style={{ width: 110 }} /></td>
                    <td>{lines.length > 1 && <button type="button" className="inv-link-button" onClick={() => { setLines((current) => current.filter((_, at) => at !== index)); setResult(null); }}>Remove</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {error && <p className="inv-state inv-state--error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button type="submit" variant="secondary" loading={busy}>Calculate</Button>
          <Button type="button" variant="secondary" loading={busy} onClick={print}>Print only</Button>
          <Button type="button" variant="primary" loading={busy} onClick={saveToHistory}>{saved ? `Saved as ${saved.recordNumber} · print` : "Save to history & print"}</Button>
        </div>
      </form>

      {result && (
        <section className="inv-card">
          <div className="inv-card__header"><h2>Costing</h2></div>
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Gauge · end</th><th className="inv-num">Pieces</th><th className="inv-num">Tape (m)</th><th className="inv-num">Brass (kg)</th><th className="inv-num">Material cost</th><th className="inv-num">Per piece</th></tr></thead>
              <tbody>
                {result.sections.map((section) => (
                  <tr key={`${section.gauge}-${section.end}-${section.material}-${section.countUnit}`}>
                    <td data-label="Gauge">#{section.gauge} {section.end}{section.material === "Aluminium" ? " · Aluminium" : ""}</td>
                    <td data-label="Pieces" className="inv-num">{n(section.pieces, 0)}</td>
                    <td data-label="Tape" className="inv-num">{n(section.meters)}</td>
                    <td data-label="Brass" className="inv-num">{n(section.brassKg, 3)}</td>
                    <td data-label="Cost" className="inv-num">{n(section.materialCost)}</td>
                    <td data-label="Per piece" className="inv-num">{n(section.perPiece, 4)}</td>
                  </tr>
                ))}
                <tr>
                  <td><strong>Total</strong></td>
                  <td className="inv-num"><strong>{n(result.totals.pieces, 0)}</strong></td>
                  <td className="inv-num">{n(result.totals.meters)}</td>
                  <td className="inv-num">{n(result.totals.brassKg, 3)}</td>
                  <td className="inv-num"><strong>{n(result.totals.materialCost)}</strong></td>
                  <td className="inv-num">{n(result.totals.perPiece, 4)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {Number(result.totals.revenue) > 0 && <p className="inv-state">Value {n(result.totals.revenue)} · profit {n(result.totals.profit)} ({n(result.totals.marginPercent, 1)}%)</p>}
          {result.skipped.length > 0 && <p className="inv-state inv-state--error">Not costed: {result.skipped.map((row) => `line ${row.lineNo} (${row.reason})`).join("; ")}</p>}
        </section>
      )}
    </main>
  );
}
