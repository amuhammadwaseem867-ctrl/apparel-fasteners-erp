"use client";

import DocumentsView from "@/components/inventory/DocumentsView";

export default function AdjustmentsPage() {
  return (
    <DocumentsView
      title="Stock Adjustments"
      description="Controlled corrections with a mandatory reason. Reductions can never take available stock below zero."
      types={["ADJUSTMENT"]}
      newLabel="New adjustment"
    />
  );
}
