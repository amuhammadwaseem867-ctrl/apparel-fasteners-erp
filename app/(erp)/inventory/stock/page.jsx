"use client";

import BalancesView from "@/components/inventory/BalancesView";

export default function StockPage() {
  return (
    <BalancesView
      title="Stock on Hand"
      description="Current stock per item and storage location. Available is what can be issued now (QC hold excluded). Every change comes from a posted stock document."
    />
  );
}
