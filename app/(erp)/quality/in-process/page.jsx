"use client";

import QualityInspectionList from "@/components/quality/QualityInspectionList";

export default function InProcessInspectionPage() {
  return (
    <QualityInspectionList
      type="IN_PROCESS"
      title="In-Process Inspection"
      description="Sampling checks at production stages before Quality Check. They record results and defects for traceability; stage output is still recorded on the production order."
      emptyText="No in-process inspections yet."
    />
  );
}
