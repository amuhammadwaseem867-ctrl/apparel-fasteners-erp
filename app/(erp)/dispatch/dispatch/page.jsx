"use client";

import ShipmentList from "@/components/dispatch/ShipmentList";

export default function DispatchPage() {
  return (
    <ShipmentList
      title="Dispatch"
      description="Draft shipments waiting to be dispatched. Open one to dispatch it; stock is checked and posted out at that moment."
      initialStatus="DRAFT"
      emptyText="No draft shipments. Create one from Ready for Delivery or with New shipment."
    />
  );
}
