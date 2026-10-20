"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import PackingListTable from "@/components/packing/PackingListTable";

function PackingOrders() {
  const orderId = useSearchParams().get("productionOrderId") ?? "";
  return (
    <PackingListTable
      title="Packing Lists"
      description="Every packing list with its print and history. Passing a list records the packing stage and puts the goods into finished-goods stock."
      initialStatus="OPEN"
      emptyText="No open packing lists. Create one for a production order with output waiting at Packing."
      openForOrderId={orderId}
    />
  );
}

export default function PackingOrdersPage() {
  return (
    <Suspense fallback={<p className="inv-state" role="status">Loading…</p>}>
      <PackingOrders />
    </Suspense>
  );
}
