"use client";

import DocumentsView from "@/components/inventory/DocumentsView";

export default function StockCountsPage() {
  return (
    <DocumentsView
      title="Physical Stock Counts"
      description="Enter the counted quantity per item and location. The system locks the balance, compares it with the book quantity and posts only the difference as a reconciliation movement."
      types={["COUNT"]}
      newLabel="Record count"
    />
  );
}
