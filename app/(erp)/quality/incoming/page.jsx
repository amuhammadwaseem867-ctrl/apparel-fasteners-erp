"use client";

import QualityInspectionList from "@/components/quality/QualityInspectionList";

export default function IncomingInspectionPage() {
  return (
    <QualityInspectionList
      type="INCOMING"
      title="Incoming Inspection"
      description="Inspect received material that is on quality hold. On approval, passed quantity is released to available stock, rejected quantity is scrapped, and rework stays on hold."
      emptyText="No incoming inspections. Put received stock on quality hold (Inventory → Stock → Quality hold), then record an inspection."
    />
  );
}
