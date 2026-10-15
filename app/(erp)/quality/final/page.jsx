"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import QualityInspectionList from "@/components/quality/QualityInspectionList";

function FinalInspections() {
  const orderId = useSearchParams().get("productionOrderId") ?? "";
  return (
    <QualityInspectionList
      type="FINAL"
      title="Final Inspection"
      description="The Quality Check stage of production orders. Approving an inspection records the stage: passed units move on to packing, rework returns to the Quality Check queue, rejected units are lost."
      emptyText="No final inspections yet."
      openForOrderId={orderId}
    />
  );
}

export default function FinalInspectionPage() {
  return (
    <Suspense fallback={<p className="inv-state" role="status">Loading…</p>}>
      <FinalInspections />
    </Suspense>
  );
}
