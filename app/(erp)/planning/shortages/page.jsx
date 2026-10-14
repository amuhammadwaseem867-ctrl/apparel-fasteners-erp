"use client";

import LatestRunPage from "@/components/planning/LatestRunPage";

export default function ShortagesPage() {
  return (
    <LatestRunPage
      title="Material Shortages"
      description="Items whose requirement exceeds allocated and available stock in the latest MRP run."
      show={["shortages", "orders"]}
    />
  );
}
