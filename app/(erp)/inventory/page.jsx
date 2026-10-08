"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";

import InventoryKpiGrid from "@/components/inventory/InventoryKpiGrid";
import InventoryStockSummary from "@/components/inventory/InventoryStockSummary";
import InventoryQuickActions from "@/components/inventory/InventoryQuickActions";
import InventoryMovementSummary from "@/components/inventory/InventoryMovementSummary";
import InventoryWarehouseStatus from "@/components/inventory/InventoryWarehouseStatus";
import InventoryLowStock from "@/components/inventory/InventoryLowStock";
import InventoryWorkflow from "@/components/inventory/InventoryWorkflow";
import InventoryActivity from "@/components/inventory/InventoryActivity";

import "./InventoryDashboard.css";

export default function InventoryPage() {
  const router = useRouter();

  const [loading] = useState(false);

  /*
   * Backend-ready state.
   *
   * No mock records are intentionally provided here.
   * These values will later come from the inventory API.
   */
  const inventory = {
    kpis: {},
    stockSummary: {},
    movements: [],
    warehouses: [],
    lowStock: [],
    activities: [],
  };

  const handleQuickAction = (action) => {
    const routes = {
      receive: "/procurement/goods-receipts",
      movement: "/inventory/movements",
      adjustment: "/inventory/adjustments",
      count: "/inventory/stock-counts",
    };

    const route = routes[action];

    if (route) {
      router.push(route);
    }
  };

  const handleViewStock = () => {
    router.push("/inventory/stock");
  };

  const handleViewMovements = () => {
    router.push("/inventory/movements");
  };

  const handleViewWarehouses = () => {
    router.push("/inventory/warehouses");
  };

  const handleViewLowStock = () => {
    router.push("/inventory/item-master");
  };

  const handleReorder = (item) => {
    /*
     * Backend/API integration will be added later.
     * For now this only provides the event boundary.
     */
    /* Backend integration pending. */
  };

  const handleWorkflowStep = (step) => {
    const routes = {
      receive: "/procurement/goods-receipts",
      store: "/inventory/warehouses",
      move: "/inventory/movements",
      count: "/inventory/stock-counts",
      adjust: "/inventory/adjustments",
      reorder: "/inventory/item-master",
    };

    const route = routes[step];

    if (route) {
      router.push(route);
    }
  };

  return (
    <main className="inventory-dashboard">
      <PageHeader
        eyebrow="Inventory"
        title="Inventory Overview"
        description="Monitor stock, warehouse operations, movements, and replenishment from one central workspace."
        action={
          <Button
            variant="primary"
            onClick={() =>
              router.push("/procurement/goods-receipts")
            }
          >
            Receive Stock
          </Button>
        }
      />

      <div className="inventory-dashboard__content">
        {/* ------------------------------------------------
            KPI OVERVIEW
        ------------------------------------------------ */}

        <InventoryKpiGrid
          data={inventory.kpis}
          loading={loading}
        />

        {/* ------------------------------------------------
            STOCK SUMMARY
        ------------------------------------------------ */}

        <InventoryStockSummary
          data={inventory.stockSummary}
          loading={loading}
          onViewStock={handleViewStock}
        />

        {/* ------------------------------------------------
            QUICK ACTIONS
        ------------------------------------------------ */}

        <InventoryQuickActions
          onAction={handleQuickAction}
          disabled={loading}
        />

        {/* ------------------------------------------------
            OPERATIONAL WORKFLOW
        ------------------------------------------------ */}

        <InventoryWorkflow
          onStepClick={handleWorkflowStep}
        />

        {/* ------------------------------------------------
            MOVEMENTS + WAREHOUSES
        ------------------------------------------------ */}

        <div className="inventory-dashboard__grid inventory-dashboard__grid--two">
          <InventoryMovementSummary
            movements={inventory.movements}
            loading={loading}
            onViewAll={handleViewMovements}
          />

          <InventoryWarehouseStatus
            warehouses={inventory.warehouses}
            loading={loading}
            onViewAll={handleViewWarehouses}
          />
        </div>

        {/* ------------------------------------------------
            LOW STOCK
        ------------------------------------------------ */}

        <InventoryLowStock
          items={inventory.lowStock}
          loading={loading}
          onViewAll={handleViewLowStock}
          onReorder={handleReorder}
        />

        {/* ------------------------------------------------
            ACTIVITY
        ------------------------------------------------ */}

        <InventoryActivity
          activities={inventory.activities}
          loading={loading}
          onViewAll={handleViewMovements}
        />
      </div>
    </main>
  );
}