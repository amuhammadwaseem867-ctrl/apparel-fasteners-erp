"use client";

import ProductionOrderList from "@/components/production/ProductionOrderList";

export default function ProductionCompletionPage() {
  return (
    <ProductionOrderList
      title="Completed Production"
      description="Orders whose nine stages are all completed. Delivered is the quantity accepted at the final (Delivered) stage."
      initialStatus="COMPLETED"
      emptyText="No completed production orders yet."
    />
  );
}
