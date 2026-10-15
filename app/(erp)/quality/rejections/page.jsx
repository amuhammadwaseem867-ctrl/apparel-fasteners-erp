"use client";

import QualityInspectionList from "@/components/quality/QualityInspectionList";

export default function RejectionsPage() {
  return (
    <QualityInspectionList
      failedOnly
      title="Rejections & Rework"
      description="Inspections of every type with rejected or rework quantities, for traceability. NCR and CAPA records are not implemented yet."
      emptyText="No inspection has rejected or rework quantities."
    />
  );
}
