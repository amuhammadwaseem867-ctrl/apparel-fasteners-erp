"use client";

import BalancesView from "@/components/inventory/BalancesView";

export default function FinishedGoodsPage() {
  return (
    <BalancesView
      title="Finished Goods Stock"
      description="Stock held in warehouses of type Finished Goods. Receive completed goods with a Finished Goods Receipt; dispatch them with a Finished Goods Dispatch."
      warehouseType="FINISHED_GOODS"
      actions={[
        { label: "Receive finished goods", types: ["FG_RECEIPT"], primary: true },
        { label: "Dispatch", types: ["FG_DISPATCH"] },
        { label: "Quality hold", types: ["QC_HOLD", "QC_RELEASE"] },
      ]}
      emptyText="No finished goods stock. Create a warehouse of type Finished Goods, then post a Finished Goods Receipt."
    />
  );
}
