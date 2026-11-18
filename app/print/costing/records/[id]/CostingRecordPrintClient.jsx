"use client";

/* A saved costing (D-060), printed exactly as it was calculated. */

import Link from "next/link";

import CostingDocument from "@/components/print/CostingDocument";
import useApiData from "@/lib/inventory/useApiData";
import useCompany from "@/lib/useCompany";

export default function CostingRecordPrintClient({ id }) {
  const company = useCompany();
  const { data, error } = useApiData(`/api/costing/records/${encodeURIComponent(id)}`);

  if (error) return <main className="print-doc print-doc--message"><p role="alert">{error}</p><Link href="/sales/costing-history">Costing history</Link></main>;
  if (!data) return <main className="print-doc print-doc--message"><p role="status">Opening the costing…</p></main>;

  return (
    <main className="print-doc">
      <nav className="print-doc__toolbar" aria-label="Document actions">
        <Link href="/sales/costing-history">Costing history</Link>
        <button type="button" onClick={() => window.print()}>Print</button>
      </nav>
      <CostingDocument data={data.data} company={company} />
    </main>
  );
}
