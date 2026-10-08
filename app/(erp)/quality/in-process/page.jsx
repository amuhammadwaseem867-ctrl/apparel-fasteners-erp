"use client";

import InspectionList from "@/components/quality/InspectionList";

export default function InProcessInspectionPage() {
  return (
    <InspectionList
      type="in-process"
      title="In-Process Inspection"
      description="Quality checks during production stages. Production Output depends on in-process results."
      emptyTitle="No in-process inspections"
      emptyDescription="In-process inspections are created against production stages while an order is being manufactured."
    />
  );
}
