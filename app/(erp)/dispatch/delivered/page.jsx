"use client";

import ShipmentList from "@/components/dispatch/ShipmentList";

export default function DeliveredPage() {
  return (
    <ShipmentList
      title="Delivered"
      description="Shipments confirmed as delivered, with who received them."
      initialStatus="DELIVERED"
      emptyText="No delivered shipments yet."
      allowCreate={false}
    />
  );
}
