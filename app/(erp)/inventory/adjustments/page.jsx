"use client";

import DocumentsView from "@/components/inventory/DocumentsView";

export default function AdjustmentsPage() {
  return (
    <DocumentsView
      title="Stock Adjustments"
      description="Controlled corrections with a mandatory reason: signed adjustments and damaged or rejected stock write-offs. Reductions can never take available stock below zero."
      types={["ADJUSTMENT", "DAMAGE"]}
      newLabel="New adjustment"
    />
  );
}
