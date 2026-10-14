"use client";

import BalancesView from "@/components/inventory/BalancesView";

export default function WipStockPage() {
  return (
    <BalancesView
      title="Work-in-Progress Stock"
      description="Material held in warehouses of type WIP (production floor locations). Move material in with a transfer or material issue to a WIP location and back with a material return. Stage-level WIP arrives with the production module."
      warehouseType="WIP"
      actions={[
        { label: "Transfer", types: ["TRANSFER"], primary: true },
        { label: "Return to store", types: ["MATERIAL_RETURN"] },
        { label: "Issue / scrap", types: ["MATERIAL_ISSUE", "DAMAGE"] },
      ]}
      emptyText="No WIP stock. Create a warehouse of type WIP for production locations, then transfer material into it."
    />
  );
}
