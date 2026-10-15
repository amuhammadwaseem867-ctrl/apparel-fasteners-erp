"use client";

import ShipmentList from "@/components/dispatch/ShipmentList";

export default function ShipmentsPage() {
  return (
    <ShipmentList
      title="Shipments"
      description="All shipments. Dispatching posts the goods out of finished-goods stock; delivery confirmation records who received them."
      emptyText="No shipments yet."
    />
  );
}
