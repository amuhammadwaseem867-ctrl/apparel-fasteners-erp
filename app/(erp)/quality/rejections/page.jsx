"use client";

import InspectionList from "@/components/quality/InspectionList";

export default function RejectionsPage() {
  return (
    <InspectionList
      type="incoming"
      title="Rejections"
      description="All rejected quality records across incoming and in-process inspections. Rejected material triggers NCR and CAPA."
      emptyTitle="No rejections"
      emptyDescription="Rejected inspections appear here for traceability and corrective action."
      showRejectionsOnly={true}
    />
  );
}
