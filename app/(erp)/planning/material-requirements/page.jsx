"use client";

import LatestRunPage from "@/components/planning/LatestRunPage";

export default function MaterialRequirementsPage() {
  return (
    <LatestRunPage
      title="Material Requirements"
      description="Gross and net requirements per item from the latest MRP run, with the BOM revision used."
      show={["requirements", "orders"]}
    />
  );
}
