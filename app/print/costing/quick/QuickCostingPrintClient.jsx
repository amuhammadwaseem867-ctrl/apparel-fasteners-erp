"use client";

/* Quick costing document (D-059): what the quick costing page calculated, ready to print. */

import Link from "next/link";
import { useEffect, useState } from "react";

import CostingDocument from "@/components/print/CostingDocument";
import { QUICK_COSTING_KEY } from "@/lib/costing/quickCosting";
import useCompany from "@/lib/useCompany";

export default function QuickCostingPrintClient() {
  const company = useCompany();
  const [state, setState] = useState({ loading: true, data: null });

  useEffect(() => {
    let data = null;
    try {
      data = JSON.parse(sessionStorage.getItem(QUICK_COSTING_KEY) ?? "null");
    } catch {
      data = null;
    }
    // Read once, after the page is in the browser (sessionStorage is not on the server).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ loading: false, data });
  }, []);

  if (state.loading) return <main className="print-doc print-doc--message"><p role="status">Opening the costing…</p></main>;
  if (!state.data) {
    return (
      <main className="print-doc print-doc--message">
        <p role="alert">No quick costing to print. Fill in the lines on the Quick costing page and press Print costing document.</p>
        <Link href="/sales/quick-costing">Quick costing</Link>
      </main>
    );
  }

  return (
    <main className="print-doc">
      <nav className="print-doc__toolbar" aria-label="Document actions">
        <Link href="/sales/quick-costing">Back to quick costing</Link>
        <button type="button" onClick={() => window.print()}>Print</button>
      </nav>
      <CostingDocument data={state.data} company={company} />
    </main>
  );
}
