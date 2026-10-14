"use client";

import DocumentsView from "@/components/inventory/DocumentsView";

export default function ProductionMaterialIssuePage() {
  return (
    <DocumentsView
      eyebrow="Production"
      title="Material Issue"
      description="Material issued to and returned from production. To issue against a specific production order (linked and checked to be open), use Issue material on the order."
      types={["MATERIAL_ISSUE", "MATERIAL_RETURN"]}
      newLabel="Issue / return material"
    />
  );
}
