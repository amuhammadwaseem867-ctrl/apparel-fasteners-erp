"use client";

/* An order's costing report (D-055): the costing document for one sales order. */

import Link from "next/link";

import CostingDocument from "@/components/print/CostingDocument";
import useApiData from "@/lib/inventory/useApiData";
import useCompany from "@/lib/useCompany";

export default function OrderCostingPrintClient({ id }) {
  const company = useCompany();
  const { data, error } = useApiData(`/api/sales/orders/${encodeURIComponent(id)}/costing`);
  const backHref = `/sales/orders/${encodeURIComponent(id)}`;

  if (error) return <main className="print-doc print-doc--message"><p role="alert">{error}</p><Link href={backHref}>Back to order</Link></main>;
  if (!data) return <main className="print-doc print-doc--message"><p role="status">Calculating the order costing…</p></main>;

  return (
    <main className="print-doc">
      <nav className="print-doc__toolbar" aria-label="Document actions">
        <Link href={backHref}>Back to order</Link>
        <Link href="/sales/costing-rates">Costing rates</Link>
        <button type="button" onClick={() => window.print()}>Print</button>
      </nav>
      <CostingDocument data={data} company={company} />
    </main>
  );
}
