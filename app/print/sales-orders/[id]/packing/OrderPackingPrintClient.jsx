"use client";

/*
 * The AF7 packing list for a whole order (D-048): every product of the
 * order in one document, under the order's own number, with the order's
 * totals (GET /api/sales/orders/[id]/packing).
 */

import Link from "next/link";

import { Af7Page, Af7Section, Af7Signatures } from "@/components/print/Af7Document";
import useApiData from "@/lib/inventory/useApiData";
import useCompany from "@/lib/useCompany";
import { addDecimalStrings } from "@/server/core/utils/decimal";

export default function OrderPackingPrintClient({ id }) {
  const company = useCompany();
  const { data, error } = useApiData(`/api/sales/orders/${encodeURIComponent(id)}/packing`);

  if (error) return <main className="print-doc print-doc--message"><p role="alert">{error}</p><Link href={`/sales/orders/${id}`}>Back to order</Link></main>;
  if (!data) return <main className="print-doc print-doc--message"><p role="status">Loading packing list…</p></main>;

  const { rows } = data;
  const sum = (field) => rows.filter((row) => row[field] !== null && row[field] !== undefined).reduce((total, row) => addDecimalStrings(total, String(row[field])), "0");
  const weights = (row) => (row.netWeight === null && row.grossWeight === null ? "" : `${row.netWeight ?? "—"} / ${row.grossWeight ?? "—"}`);
  const units = [...new Set(rows.map((row) => row.unit))];
  const totalQuantity = units.length === 1 ? `${sum("quantity")} ${units[0]}` : units.map((unit) => `${rows.filter((row) => row.unit === unit).reduce((total, row) => addDecimalStrings(total, row.quantity), "0")} ${unit}`).join(" + ");
  const bags = rows.reduce((total, row) => total + (row.bags ?? 1), 0);
  const anyWeight = (field) => rows.some((row) => row[field] !== null);

  return (
    <main className="print-doc">
      <nav className="print-doc__toolbar" aria-label="Document actions">
        <Link href={`/sales/orders/${data.salesOrderId}`}>Back to order</Link>
        <button type="button" onClick={() => window.print()}>Print</button>
      </nav>
      <Af7Page company={company} title="PACKING LIST" subtitle={<p className="af7__small">Order no. {data.orderNumber}</p>}>
        {data.drafts.length > 0 && <p className="af7__notice">Not passed yet: {data.drafts.join(", ")}.</p>}

        <Af7Section number="1" title="Document information">
          <table className="af7__table">
            <thead><tr><th>Date</th><th>PO #</th><th>Order no.</th><th>Customer</th></tr></thead>
            <tbody>
              <tr>
                <td className="center">{data.date ? new Date(data.date).toLocaleDateString("en-GB") : ""}</td>
                <td className="center">{data.customerPo ?? ""}</td>
                <td className="center">{data.orderNumber}</td>
                <td className="center">{data.customerName ?? ""}</td>
              </tr>
            </tbody>
          </table>
        </Af7Section>

        <Af7Section number="2" title="Packing details">
          <table className="af7__table">
            <colgroup>
              <col style={{ width: "7%" }} /><col style={{ width: "33%" }} /><col style={{ width: "13%" }} /><col style={{ width: "15%" }} /><col style={{ width: "14%" }} /><col style={{ width: "18%" }} />
            </colgroup>
            <thead>
              <tr><th>Sr. no.</th><th>Description</th><th>Size (cm / inches)</th><th>Pcs / meters / rolls</th><th>No. of bags / cartons</th><th>Net weight / gross weight (kg)</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="center">{row.rowNo}</td>
                  <td>{row.description}{row.marks ? ` · ${row.marks}` : ""}</td>
                  <td className="center">{row.size ?? ""}</td>
                  <td className="num">{row.quantity} {row.unit}</td>
                  <td className="center">{row.bags ?? 1} {row.packageType}{(row.bags ?? 1) > 1 ? "s" : ""}</td>
                  <td className="num">{weights(row)}</td>
                </tr>
              ))}
              <tr className="af7__total-row">
                <td colSpan={3}>TOTAL</td>
                <td className="num">{totalQuantity}</td>
                <td className="center">{bags}</td>
                <td className="num">{anyWeight("netWeight") ? sum("netWeight") : "—"} / {anyWeight("grossWeight") ? sum("grossWeight") : "—"}</td>
              </tr>
            </tbody>
          </table>
        </Af7Section>

        <div className="af7__spacer" />
        <Af7Section number="3" title="Authorization / signature">
          <Af7Signatures roles={[["PREPARED BY"], ["CHECKED BY"], ["AUTHORIZED BY"]]} stamp={false} />
        </Af7Section>
      </Af7Page>
    </main>
  );
}


