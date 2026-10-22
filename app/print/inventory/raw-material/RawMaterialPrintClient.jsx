"use client";

/*
 * Printed raw material stock list (GET /api/inventory/raw-material) with
 * the same filters as the Raw Material Stock page: received, issued and
 * current stock per item, in its unit and in pieces / kg.
 */

import Link from "next/link";

import { Af7Fields, Af7Page, Af7Section, Af7Signatures } from "@/components/print/Af7Document";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";
import useCompany from "@/lib/useCompany";

const qty = (value) => (value === null || value === undefined ? "" : Number(value).toLocaleString("en-US", { maximumFractionDigits: 3 }));
const STATUS = { OK: "", LOW: "Low", OUT: "Out" };

export default function RawMaterialPrintClient({ params }) {
  const company = useCompany();
  const filters = { category: params.category ?? "", search: params.search ?? "", stock: params.stock ?? "", includeProducts: params.includeProducts ?? "" };
  const { data, error } = useApiData(`/api/inventory/raw-material${toQuery(filters)}`);

  if (error) return <main className="print-doc print-doc--message"><p role="alert">{error}</p><Link href="/inventory/raw-material">Back to stock</Link></main>;
  if (!data) return <main className="print-doc print-doc--message"><p role="status">Loading stockâ€¦</p></main>;

  const printed = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

  return (
    <main className="print-doc">
      <nav className="print-doc__toolbar" aria-label="Document actions">
        <Link href="/inventory/raw-material">Back to stock</Link>
        <button type="button" onClick={() => window.print()}>Print</button>
      </nav>
      <Af7Page
        company={company}
        title="RAW MATERIAL STOCK"
        subtitle={<Af7Fields rows={[["Printed", printed], ["Category", filters.category || "All"]]} />}
      >
        <Af7Section title={`Stock list · ${data.items.length} items${filters.search ? ` · search "${filters.search}"` : ""}`}>
          <table className="af7__table af7__table--compact">
            <colgroup><col style={{ width: "15%" }} /><col style={{ width: "6%" }} /><col style={{ width: "10%" }} /><col style={{ width: "11%" }} /><col style={{ width: "9%" }} /><col style={{ width: "5%" }} /><col style={{ width: "7%" }} /><col style={{ width: "7%" }} /><col style={{ width: "7%" }} /><col style={{ width: "6%" }} /><col style={{ width: "5%" }} /><col style={{ width: "8%" }} /><col style={{ width: "4%" }} /></colgroup>
            <thead>
              <tr><th>Item no</th><th>Size</th><th>Type</th><th>Finish</th><th>Variant</th><th>Unit</th><th>Recv.</th><th>Issued</th><th>Stock</th><th>Pcs</th><th>Kg</th><th>Location</th><th /></tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.sku}</td>
                  <td>{item.size ?? ""}</td>
                  <td>{[item.itemType, item.material].filter(Boolean).join(" · ")}</td>
                  <td>{item.finish || item.color || ""}</td>
                  <td>{[item.variant, item.logoType].filter(Boolean).join(" · ")}</td>
                  <td className="center">{item.unit}</td>
                  <td className="num">{qty(item.received)}</td>
                  <td className="num">{qty(item.issued)}</td>
                  <td className="num"><strong>{qty(item.onHand)}</strong></td>
                  <td className="num">{qty(item.pieces)}</td>
                  <td className="num">{qty(item.kg)}</td>
                  <td>{item.locations}</td>
                  <td className="center">{STATUS[item.stockStatus]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Af7Section>
        <div className="af7__spacer" />
        <Af7Signatures roles={[["Store keeper"], ["Checked by"]]} stamp={false} />
      </Af7Page>
    </main>
  );
}

