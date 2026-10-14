"use client";

import DocumentsView from "@/components/inventory/DocumentsView";

export default function TransfersPage() {
  return (
    <DocumentsView
      title="Stock Transfers"
      description="Move stock between storage locations and warehouses. Each transfer takes available stock from the source and adds it at the destination in one transaction."
      types={["TRANSFER"]}
      newLabel="New transfer"
    />
  );
}
