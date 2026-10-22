"use client";

/*
 * AF7 Order Sheet: the copy that goes to production, laid out like the
 * company's order sheet (Description, Tape Color, Finish, Size, Unit,
 * Quantity), headed only by the invoice no. and the date. It never shows
 * prices, the customer or the customer's PO.
 */

import Link from "next/link";

import { Af7Fields, Af7Page, Af7Section, Af7Signatures } from "@/components/print/Af7Document";
import useApiData from "@/lib/inventory/useApiData";
import useCompany from "@/lib/useCompany";

const day = (value) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "");
const qty = (value) => Number(value).toLocaleString("en-US", { maximumFractionDigits: 3 });

function lineDescription(line) {
  return [line.productName, line.variant, line.teethType, line.slider && `Slider: ${line.slider}`].filter(Boolean).join(" · ");
}

export default function SalesOrderSheetClient({ id }) {
  const company = useCompany();
  const { data: order, error } = useApiData(`/api/sales/orders/${encodeURIComponent(id)}`);
  const backHref = `/sales/orders/${encodeURIComponent(id)}`;

  if (error) return <main className="print-doc print-doc--message"><p role="alert">{error}</p><Link href={backHref}>Back to order</Link></main>;
  if (!order) return <main className="print-doc print-doc--message"><p role="status">Loading order…</p></main>;

  const total = order.lines.reduce((sum, line) => sum + Number(line.quantity), 0);
  const units = [...new Set(order.lines.map((line) => line.unit))];

  return (
    <main className="print-doc">
      <nav className="print-doc__toolbar" aria-label="Document actions">
        <Link href={backHref}>Back to order</Link>
        <button type="button" onClick={() => window.print()}>Print</button>
      </nav>
      <Af7Page
        company={company}
        title="ORDER SHEET"
        // Like AF7's own order sheet: only the invoice no. (the order number) and the date; no customer, PO or prices.
        subtitle={<Af7Fields rows={[["Invoice no.", order.orderNumber], ["Dated", day(order.orderDate)]]} />}
      >
        {order.status === "DRAFT" && <p className="af7__notice">NOT CONFIRMED: this order is still a draft.</p>}
        {order.status === "CANCELLED" && <p className="af7__notice">CANCELLED: do not produce.</p>}

        <Af7Section number="1" title="Order details">
          <table className="af7__table">
            <colgroup>
              <col style={{ width: "5%" }} /><col style={{ width: "35%" }} /><col style={{ width: "19%" }} /><col style={{ width: "12%" }} /><col style={{ width: "9%" }} /><col style={{ width: "7%" }} /><col style={{ width: "13%" }} />
            </colgroup>
            <thead>
              <tr><th>#</th><th>Description</th><th>Tape color</th><th>Finish</th><th>Size</th><th>Unit</th><th>Quantity</th></tr>
            </thead>
            <tbody>
              {order.lines.map((line, index) => (
                <tr key={line.id}>
                  <td className="center">{index + 1}</td>
                  <td>{lineDescription(line)}</td>
                  <td>{line.tapeColor ?? ""}</td>
                  <td>{line.finish ?? ""}</td>
                  <td>{line.size ?? ""}</td>
                  <td className="center">{line.unit}</td>
                  <td className="num">{qty(line.quantity)}</td>
                </tr>
              ))}
              <tr className="af7__total-row"><td colSpan={6}>TOTAL{units.length === 1 ? ` (${units[0]})` : ""}</td><td className="num">{units.length === 1 ? qty(total) : ""}</td></tr>
            </tbody>
          </table>
          {order.notes && <p><strong>Remarks:</strong> {order.notes}</p>}
        </Af7Section>

        <div className="af7__spacer" />
        <Af7Section number="2" title="Authorization / signature">
          <Af7Signatures roles={[["PREPARED BY"], ["CHECKED BY"], ["AUTHORIZED BY"]]} />
        </Af7Section>
      </Af7Page>
    </main>
  );
}
