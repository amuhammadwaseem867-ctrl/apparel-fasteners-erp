"use client";

import InspectionList from "@/components/quality/InspectionList";

export default function IncomingInspectionPage() {
  return (
    <InspectionList
      type="incoming"
      title="Incoming Inspection"
      description="Verify supplier material compliance before issue to production. Goods Receipt flows into Incoming Inspection: Approved, Conditional or Rejected."
      emptyTitle="No incoming inspections"
      emptyDescription="Incoming inspections are created when purchased material is received and requires quality review before issue to production."
    />
  );
}
