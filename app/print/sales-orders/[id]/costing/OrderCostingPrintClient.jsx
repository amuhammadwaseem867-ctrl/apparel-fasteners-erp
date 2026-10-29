"use client";

/*
 * AF7 order costing report (D-055), laid out like the master costing sheet:
 * per gauge and end, the chain roll (tape) consumption, brass, wastage,
 * recoverable brass scrap and every material's consumption and expense,
 * then the order's total cost, profit and the stock-out receipt.
 */

import Link from "next/link";

import { Af7Fields, Af7Page, Af7Section, Af7Signatures } from "@/components/print/Af7Document";
import useApiData from "@/lib/inventory/useApiData";
import useCompany from "@/lib/useCompany";

const day = (value) => (value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "");
const n = (value, digits = 2) => Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pkr = (value) => n(value, 2);

function Section({ section, number }) {
  const g = section.lines[0];
  return (
    <>
      <Af7Section number={`${number}.1`} title={`#${section.gauge} ${section.end} · chain roll (tape) consumption`}>
        <table className="af7__table">
          <thead><tr><th>#</th><th>Item / finish</th><th>Qty (pcs)</th><th>Size</th><th>Size (cm)</th><th>Cut (cm, with margin)</th><th>Meters</th><th>Rolls</th><th>Tape (kg)</th></tr></thead>
          <tbody>
            {section.lines.map((line) => (
              <tr key={line.lineNo}>
                <td className="center">{line.lineNo}</td>
                <td>{line.productName}{line.finish ? ` · ${line.finish}` : ""}</td>
                <td className="num">{n(line.quantity, 0)}</td>
                <td>{line.size}</td>
                <td className="num">{n(line.sizeCm)}</td>
                <td className="num">{n(line.cutCm)}</td>
                <td className="num">{n(line.meters, 3)}</td>
                <td className="num">{n(line.rolls, 3)}</td>
                <td className="num">{n(line.tapeKg, 3)}</td>
              </tr>
            ))}
            <tr className="af7__total-row"><td colSpan={2}>TOTAL</td><td className="num">{n(section.pieces, 0)}</td><td colSpan={3} /><td className="num">{n(section.meters, 3)}</td><td className="num">{n(section.rolls, 3)}</td><td className="num">{n(section.tapeKg, 3)}</td></tr>
          </tbody>
        </table>
      </Af7Section>

      <Af7Section number={`${number}.2`} title="Brass per piece and complete order (teeth to teeth)">
        <table className="af7__table">
          <thead><tr><th>#</th><th>Teeth length (cm)</th><th>Qty</th><th>Meters per zipper</th><th>Brass per meter (g)</th><th>Per zipper (g)</th><th>Total brass (g)</th><th>Total brass (kg)</th></tr></thead>
          <tbody>
            {section.lines.map((line) => (
              <tr key={line.lineNo}>
                <td className="center">{line.lineNo}</td>
                <td className="num">{n(line.teethCm)}</td>
                <td className="num">{n(line.quantity, 0)}</td>
                <td className="num">{n(line.teethCm / 100, 4)}</td>
                <td className="num">{n(line.brassGramsPerZipper / (line.teethCm / 100), 2)}</td>
                <td className="num">{n(line.brassGramsPerZipper, 3)}</td>
                <td className="num">{n(line.brassKg * 1000, 2)}</td>
                <td className="num">{n(line.brassKg, 3)}</td>
              </tr>
            ))}
            <tr className="af7__total-row"><td colSpan={2}>TOTAL</td><td className="num">{n(section.pieces, 0)}</td><td colSpan={3} /><td className="num">{n(section.brassKg * 1000, 2)}</td><td className="num">{n(section.brassKg, 3)}</td></tr>
          </tbody>
        </table>
        {section.end === "Open end" && <p className="af7__small" style={{ padding: "0 8px" }}>Open end: the teeth cut from the gap ({n(section.lines.reduce((sum, line) => sum + line.gapBrassKg, 0), 3)} kg brass) are recovered as scrap.</p>}
      </Af7Section>

      <Af7Section number={`${number}.3`} title="Wastage and recoverable brass scrap">
        <table className="af7__table">
          <thead><tr><th>Wastage (kg)</th><th>Wastage in rolls</th><th>Wastage in meters</th><th>Brass wastage (kg)</th><th>Tape wastage (kg)</th><th>Brass scrap (kg)</th><th>Recoverable value (PKR)</th><th>Per piece</th></tr></thead>
          <tbody>
            <tr>
              <td className="num">{n(section.wastage.kg, 3)}</td>
              <td className="num">{n(section.wastage.rolls, 5)}</td>
              <td className="num">{n(section.wastage.meters, 4)}</td>
              <td className="num">{n(section.wastage.brassKg, 5)}</td>
              <td className="num">{n(section.wastage.tapeKg, 5)}</td>
              <td className="num">{n(section.scrap.kg, 4)}</td>
              <td className="num">{pkr(section.scrap.value)}</td>
              <td className="num">{n(section.scrap.perPiece, 4)}</td>
            </tr>
          </tbody>
        </table>
        {g && <p className="af7__small" style={{ padding: "0 8px" }}>Wastage by order meters: under 1,000 m 0.04 kg, to 2,000 m 0.2 kg, above 0.1 kg per 1,000 m. Scrap recovered at the brass rate × recovery %.</p>}
      </Af7Section>

      <Af7Section number={`${number}.4`} title="Material requirement & consumption">
        <table className="af7__table">
          <thead><tr><th>Item</th><th>Required</th><th>Rejection</th><th>Total utilized</th><th>Unit price</th><th>Rejection value</th><th>Total expense</th><th>Per piece</th></tr></thead>
          <tbody>
            {section.items.map((item) => (
              <tr key={item.key}>
                <td>{item.name} ({item.unit})</td>
                <td className="num">{n(item.required, item.unit === "Pcs" ? 0 : 3)}</td>
                <td className="num">{item.rejection ? n(item.rejection, 4) : "—"}</td>
                <td className="num">{n(item.total, item.unit === "Pcs" ? 0 : 3)}</td>
                <td className="num">{n(item.unitPrice, 4)}</td>
                <td className="num">{item.rejectionValue ? pkr(item.rejectionValue) : "—"}</td>
                <td className="num">{pkr(item.expense)}</td>
                <td className="num">{n(item.perPiece, 4)}</td>
              </tr>
            ))}
            <tr className="af7__total-row"><td colSpan={5}>TOTAL</td><td className="num">{pkr(section.rejectionValue)}</td><td className="num">{pkr(section.totalExpense)}</td><td className="num">{n(section.totalExpense / section.pieces, 4)}</td></tr>
            <tr><td colSpan={6}>Less: recoverable brass scrap</td><td className="num">−{pkr(section.scrap.value)}</td><td className="num">−{n(section.scrap.perPiece, 4)}</td></tr>
            <tr className="af7__total-row"><td colSpan={6}>TOTAL MATERIAL COST AGAINST ORDER (#{section.gauge} {section.end})</td><td className="num">{pkr(section.materialCost)}</td><td className="num">{n(section.perPiece, 4)}</td></tr>
          </tbody>
        </table>
      </Af7Section>
    </>
  );
}

export default function OrderCostingPrintClient({ id }) {
  const company = useCompany();
  const { data, error } = useApiData(`/api/sales/orders/${encodeURIComponent(id)}/costing`);
  const backHref = `/sales/orders/${encodeURIComponent(id)}`;

  if (error) return <main className="print-doc print-doc--message"><p role="alert">{error}</p><Link href={backHref}>Back to order</Link></main>;
  if (!data) return <main className="print-doc print-doc--message"><p role="status">Calculating the order costing…</p></main>;
  const { order, sections, skipped, totals } = data;
  const issued = sections.flatMap((section) => section.items
    .filter((item) => ["tape", "brass", "bottom-stop", "pin-box", "puller", "top-stop"].includes(item.key))
    .map((item) => ({ ...item, label: `#${section.gauge} ${section.end} · ${item.name}` })));

  return (
    <main className="print-doc">
      <nav className="print-doc__toolbar" aria-label="Document actions">
        <Link href={backHref}>Back to order</Link>
        <Link href="/sales/costing-rates">Costing rates</Link>
        <button type="button" onClick={() => window.print()}>Print</button>
      </nav>
      <Af7Page
        company={company}
        title="ORDER COSTING"
        longTitle
        subtitle={<Af7Fields rows={[["Order no.", order.orderNumber], ["Dated", day(order.orderDate)], ["Customer", order.customerName]]} />}
      >
        <p className="af7__notice">CONFIDENTIAL · internal costing, not for the customer.</p>
        {!data.ratesConfigured && <p className="af7__small" style={{ padding: "0 8px" }}>Rates: the master costing sheet's defaults. Set your own in Costing rates.</p>}

        <Af7Section number="1" title="Order summary">
          <table className="af7__table">
            <thead><tr><th>Pieces</th><th>Tape (m)</th><th>Tape (kg)</th><th>Brass (kg)</th><th>Material expense</th><th>Scrap recovered</th><th>Material cost</th><th>Per piece</th><th>Order value (before GST)</th><th>Profit</th><th>Margin</th></tr></thead>
            <tbody>
              <tr>
                <td className="num">{n(totals.pieces, 0)}</td>
                <td className="num">{n(totals.meters, 2)}</td>
                <td className="num">{n(totals.tapeKg, 3)}</td>
                <td className="num">{n(totals.brassKg, 3)}</td>
                <td className="num">{pkr(totals.totalExpense)}</td>
                <td className="num">{pkr(totals.scrapValue)}</td>
                <td className="num"><strong>{pkr(totals.materialCost)}</strong></td>
                <td className="num">{n(totals.perPiece, 4)}</td>
                <td className="num">{pkr(totals.revenue)}</td>
                <td className="num"><strong>{pkr(totals.profit)}</strong></td>
                <td className="num">{n(totals.marginPercent, 1)}%</td>
              </tr>
            </tbody>
          </table>
          {skipped.length > 0 && (
            <p className="af7__small" style={{ padding: "0 8px" }}>
              Not costed: {skipped.map((row) => `line ${row.lineNo} ${row.productName} (${row.reason})`).join("; ")}
            </p>
          )}
        </Af7Section>

        {sections.length === 0 && <p className="af7__notice">No line could be costed. Each line needs a gauge in its item name (e.g. #5), a size and a quantity.</p>}
        {sections.map((section, index) => <Section key={`${section.gauge}-${section.end}`} section={section} number={index + 2} />)}

        {issued.length > 0 && (
          <Af7Section number={sections.length + 2} title="Stock-out receipt · inventory issued to production">
            <table className="af7__table">
              <thead><tr><th>#</th><th>Item description</th><th>Quantity issued</th><th>UOM</th><th>Item code</th><th>Rack location</th><th>Remarks</th></tr></thead>
              <tbody>
                {issued.map((item, index) => (
                  <tr key={`${item.label}-${index}`}>
                    <td className="center">{index + 1}</td>
                    <td>{item.label}</td>
                    <td className="num">{n(item.total, item.unit === "Pcs" ? 0 : 3)}</td>
                    <td className="center">{item.unit}</td>
                    <td /><td /><td />
                  </tr>
                ))}
              </tbody>
            </table>
          </Af7Section>
        )}

        <div className="af7__spacer" />
        <Af7Section number={sections.length + 3} title="Authorization / signature">
          <Af7Signatures roles={[["PREPARED BY"], ["CHECKED BY"], ["APPROVED BY"]]} />
        </Af7Section>
      </Af7Page>
    </main>
  );
}
