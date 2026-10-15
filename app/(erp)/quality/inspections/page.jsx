"use client";

import QualityInspectionList from "@/components/quality/QualityInspectionList";

export default function InspectionsPage() {
  return (
    <QualityInspectionList
      title="Inspections"
      description="All incoming, in-process and final inspections. Results apply only when an inspection is approved."
      emptyText="No inspections yet."
    />
  );
}
