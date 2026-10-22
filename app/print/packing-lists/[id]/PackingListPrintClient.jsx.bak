"use client";

/*
 * AF7 Packing List (GET /api/packing/lists/[id]): date, PO # and order no.,
 * one row per carton / bag with size, pieces and weights, then totals and
 * the three signatures.
 */

import Link from "next/link";

import { Af7Page, Af7Section, Af7Signatures } from "@/components/print/Af7Document";
import useApiData from "@/lib/inventory/useApiData";
import { addDecimalStrings } from "@/server/core/utils/decimal";
import useCompany from "@/lib/useCompany";

const MIN_ROWS = 10;

export default function PackingListPrintClient({ id }) {
  const company = useCompany();
  const { data: list, error } = useApiData(`/api/packing/lists/${encodeURIComponent(id)}`);

  if (error) return <main className="print-doc print-doc--message"><p role="alert">{error}</p><Link href="/packing/orders">Back to packing</Link></main>;
  if (!list) return <main className="print-doc print-doc--message"><p role="status">Loading packing list…</p></main>;

  // Total of the weights entered; rows left without a weight add nothing.
  const weight = (field) => (list.packages.some((item) => item[field] !== null)
    ? list.packages.filter((item) => item[field] !== null).reduce((sum, item) => addDecimalStrings(sum, item[field]), "0")
    : "—");
  const weights = (item) => (item.netWeight === null && item.grossWeight === null ? "" : `${item.netWeight ?? "—"} / ${item.grossWeight ?? "—"}`);
  const blanks = Math.max(0, MIN_ROWS - list.packages.length);

  return (
    <main className="print-doc">
      <nav className="print-doc__toolbar" aria-label="Document actions">
        <Link href={`/packing/orders/${list.id}`}>Back to packing list</Link>
        <button type="button" onClick={() => window.print()}>Print</button>
      </nav>
      <Af7Page company={company} title="PACKING LIST" subtitle={<p className="af7__small">No. {list.packingNumber}</p>}>
        {list.status === "DRAFT" && <p className="af7__notice">DRAFT: packing not passed yet.</p>}
        {list.status === "CANCELLED" && <p className="af7__notice">CANCELLED: this packing list is void.</p>}

        <Af7Section number="1" title="Document information">
          <table className="af7__table">
            <thead><tr><th>Date</th><th>PO #</th><th>Order no.</th><th>Customer</th></tr></thead>
            <tbody>
              <tr>
                <td className="center">{new Date(list.createdAt).toLocaleDateString("en-GB")}</td>
                <td className="center">{list.customerPo ?? ""}</td>
                <td className="center">{list.salesOrderNumber ?? list.orderNumber}</td>
                <td className="center">{list.customerName ?? ""}</td>
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
              {list.packages.map((item) => (
                <tr key={item.id}>
                  <td className="center">{item.packageNo}</td>
                  <td>{item.description || list.productName}{item.marks ? ` · ${item.marks}` : ""}</td>
                  <td className="center">{item.size ?? list.size ?? ""}</td>
                  <td className="num">{item.quantity} {list.unit}</td>
                  <td className="center">{item.bags ?? 1} {item.packageType}{(item.bags ?? 1) > 1 ? "s" : ""}</td>
                  <td className="num">{weights(item)}</td>
                </tr>
              ))}
              {Array.from({ length: blanks }, (_, index) => (
                <tr key={`blank-${index}`} className="af7__blank"><td className="center">{list.packages.length + index + 1}</td><td /><td /><td /><td /><td /></tr>
              ))}
              <tr className="af7__total-row">
                <td colSpan={3}>TOTAL</td>
                <td className="num">{list.totalQuantity} {list.unit}</td>
                <td className="center">{list.packageCount}</td>
                <td className="num">{weight("netWeight")} / {weight("grossWeight")}</td>
              </tr>
            </tbody>
          </table>
          {list.notes && <p><strong>Notes:</strong> {list.notes}</p>}
        </Af7Section>

        <div className="af7__spacer" />
        <Af7Section number="3" title="Authorization / signature">
          <Af7Signatures roles={[["PREPARED BY"], ["CHECKED BY"], ["AUTHORIZED BY"]]} stamp={false} />
        </Af7Section>
      </Af7Page>
    </main>
  );
}
