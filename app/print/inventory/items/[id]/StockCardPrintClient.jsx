"use client";

/*
 * Printed stock card for one item (GET /api/inventory/raw-material/[id]):
 * specification, opening balance, every in / out with document, reference
 * and user, running balance and closing balance for the chosen dates.
 */

import Link from "next/link";

import { documentTypeLabel } from "@/components/inventory/DocumentsView";
import { Af7Fields, Af7Page, Af7Section, Af7Signatures } from "@/components/print/Af7Document";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";
import useCompany from "@/lib/useCompany";

const qty = (value) => (value === null || value === undefined ? "" : Number(value).toLocaleString("en-US", { maximumFractionDigits: 3 }));
const day = (value) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "");
const when = (value) => new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function StockCardPrintClient({ id, range }) {
  const company = useCompany();
  const { data, error } = useApiData(`/api/inventory/raw-material/${encodeURIComponent(id)}${toQuery(range)}`);

  if (error) return <main className="print-doc print-doc--message"><p role="alert">{error}</p><Link href="/inventory/raw-material">Back to stock</Link></main>;
  if (!data) return <main className="print-doc print-doc--message"><p role="status">Loading stock cardâ€¦</p></main>;

  const { item } = data;
  const period = range.dateFrom || range.dateTo ? `${day(range.dateFrom) || "Start"} to ${day(range.dateTo) || "today"}` : "All dates";

  return (
    <main className="print-doc">
      <nav className="print-doc__toolbar" aria-label="Document actions">
        <Link href={`/inventory/item-master/${item.id}`}>Back to item</Link>
        <button type="button" onClick={() => window.print()}>Print</button>
      </nav>
      <Af7Page company={company} title="STOCK CARD" subtitle={<Af7Fields rows={[["Item no", item.sku], ["Period", period]]} />}>
        <div className="af7__two">
          <Af7Section title="Item">
            <Af7Fields rows={[["Item", item.name], ["Category", item.category], ["Size", item.size], ["Type", [item.itemType, item.material].filter(Boolean).join(" · ")], ["Finish", item.finish || item.color]]} />
          </Af7Section>
          <Af7Section title="Stock">
            <Af7Fields rows={[
              ["Unit", item.unit],
              ["Unit weight", item.unitWeightGrams ? `${item.unitWeightGrams} g per piece` : ""],
              ["Received", `${qty(data.received)} ${item.unit}`],
              ["Issued to production", `${qty(data.issued)} ${item.unit}`],
              ["Closing stock", `${qty(data.closingBalance)} ${item.unit}${data.closing.pieces && item.unit !== "Pcs" ? ` · ${qty(data.closing.pieces)} pcs` : ""}${data.closing.kg && !/^kgs?$/i.test(item.unit) ? ` · ${qty(data.closing.kg)} kg` : ""}`],
            ]} />
          </Af7Section>
        </div>

        <Af7Section title="Transactions">
          <table className="af7__table af7__table--compact">
            <colgroup><col style={{ width: "13%" }} /><col style={{ width: "13%" }} /><col style={{ width: "13%" }} /><col style={{ width: "14%" }} /><col style={{ width: "10%" }} /><col style={{ width: "9%" }} /><col style={{ width: "9%" }} /><col style={{ width: "9%" }} /><col style={{ width: "10%" }} /></colgroup>
            <thead><tr><th>Date</th><th>Document</th><th>Type</th><th>Reference</th><th>Location</th><th>In</th><th>Out</th><th>Balance</th><th>By</th></tr></thead>
            <tbody>
              <tr><td colSpan={7}><strong>Opening balance</strong></td><td className="num"><strong>{qty(data.openingBalance)}</strong></td><td /></tr>
              {data.lines.map((line) => (
                <tr key={line.id}>
                  <td>{when(line.createdAt)}</td>
                  <td className="code">{line.documentNumber}</td>
                  <td>{documentTypeLabel(line.movementType)}</td>
                  <td>{line.reference || line.reason || ""}</td>
                  <td>{line.location}</td>
                  <td className="num">{qty(line.quantityIn)}</td>
                  <td className="num">{qty(line.quantityOut)}</td>
                  <td className="num">{qty(line.balance)}</td>
                  <td>{line.userName ?? ""}</td>
                </tr>
              ))}
              <tr><td colSpan={5}><strong>Closing balance</strong></td><td className="num"><strong>{qty(data.totalIn)}</strong></td><td className="num"><strong>{qty(data.totalOut)}</strong></td><td className="num"><strong>{qty(data.closingBalance)}</strong></td><td /></tr>
            </tbody>
          </table>
          {data.truncated && <p>Only the first 2000 transactions are printed; choose a shorter period for the rest.</p>}
        </Af7Section>
        <div className="af7__spacer" />
        <Af7Signatures roles={[["Store keeper"], ["Checked by"]]} stamp={false} />
      </Af7Page>
    </main>
  );
}

