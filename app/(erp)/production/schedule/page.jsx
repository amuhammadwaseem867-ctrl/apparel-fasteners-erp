"use client";

import ProductionOrderList from "@/components/production/ProductionOrderList";

export default function ProductionSchedulePage() {
  return (
    <ProductionOrderList
      title="Production Schedule"
      description="Open production orders by due date, earliest first; orders without a due date are listed last. Capacity-based scheduling is not implemented."
      initialStatus="OPEN"
      sort="due"
      emptyText="No open production orders."
    />
  );
}
