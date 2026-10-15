"use client";

import PackingListTable from "@/components/packing/PackingListTable";

export default function CompletedPackingPage() {
  return (
    <PackingListTable
      title="Packed & Shipped"
      description="Confirmed packing lists (in finished-goods stock, ready to ship) and those already shipped."
      initialStatus="CONFIRMED"
      emptyText="No confirmed packing lists yet."
      allowCreate={false}
    />
  );
}
