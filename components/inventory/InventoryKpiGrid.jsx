"use client";

import {
  Boxes,
  Warehouse,
  ArrowLeftRight,
  AlertTriangle,
} from "lucide-react";

import "./InventoryKpiGrid.css";

const DEFAULT_ITEMS = [
  {
    key: "totalStock",
    label: "Total Stock",
    description: "Inventory across all locations",
    icon: Boxes,
    tone: "neutral",
  },
  {
    key: "warehouses",
    label: "Warehouses",
    description: "Active inventory locations",
    icon: Warehouse,
    tone: "info",
  },
  {
    key: "movements",
    label: "Stock Movements",
    description: "Inventory movements recorded",
    icon: ArrowLeftRight,
    tone: "success",
  },
  {
    key: "lowStock",
    label: "Low Stock",
    description: "Items requiring attention",
    icon: AlertTriangle,
    tone: "warning",
  },
];

export default function InventoryKpiGrid({
  data = {},
  loading = false,
  items = DEFAULT_ITEMS,
}) {
  return (
    <section
      className="inventory-kpi-grid"
      aria-label="Inventory key performance indicators"
    >
      {items.map((item) => {
        const Icon = item.icon;

        const value =
          data[item.key] !== undefined && data[item.key] !== null
            ? data[item.key]
            : 0;

        return (
          <article
            key={item.key}
            className={`inventory-kpi-card inventory-kpi-card--${item.tone}`}
          >
            <div className="inventory-kpi-card__header">
              <div className="inventory-kpi-card__icon" aria-hidden="true">
                <Icon size={18} strokeWidth={1.8} />
              </div>

              <span className="inventory-kpi-card__label">
                {item.label}
              </span>
            </div>

            <div className="inventory-kpi-card__content">
              {loading ? (
                <span
                  className="inventory-kpi-card__skeleton"
                  aria-label="Loading"
                />
              ) : (
                <span className="inventory-kpi-card__value">
                  {value}
                </span>
              )}

              <p className="inventory-kpi-card__description">
                {item.description}
              </p>
            </div>
          </article>
        );
      })}
    </section>
  );
}