"use client";

import {
  AlertTriangle,
  PackageOpen,
  ArrowUpRight,
  CircleAlert,
} from "lucide-react";

import "./InventoryLowStock.css";

const SEVERITY_CONFIG = {
  critical: {
    label: "Critical",
    tone: "danger",
  },
  low: {
    label: "Low",
    tone: "warning",
  },
  normal: {
    label: "Normal",
    tone: "success",
  },
};

export default function InventoryLowStock({
  items = [],
  loading = false,
  onViewAll,
  onReorder,
}) {
  return (
    <section className="inventory-low-stock">
      <div className="inventory-low-stock__header">
        <div>
          <span className="inventory-low-stock__eyebrow">
            Attention
          </span>

          <h2 className="inventory-low-stock__title">
            Low Stock & Reorder
          </h2>

          <p className="inventory-low-stock__description">
            Items approaching or below their defined stock thresholds.
          </p>
        </div>

        <button
          type="button"
          className="inventory-low-stock__view-button"
          onClick={onViewAll}
          disabled={!onViewAll}
        >
          View All
          <ArrowUpRight size={15} strokeWidth={1.8} />
        </button>
      </div>

      <div className="inventory-low-stock__content">
        {loading ? (
          <LowStockSkeleton />
        ) : items.length > 0 ? (
          <div className="inventory-low-stock__list">
            {items.map((item) => (
              <LowStockRow
                key={item.id}
                item={item}
                onReorder={onReorder}
              />
            ))}
          </div>
        ) : (
          <EmptyLowStockState />
        )}
      </div>
    </section>
  );
}

function LowStockRow({ item, onReorder }) {
  const severity =
    SEVERITY_CONFIG[item.severity] ||
    SEVERITY_CONFIG.low;

  const currentStock = Number(item.currentStock ?? 0);
  const reorderPoint = Number(item.reorderPoint ?? 0);

  const percentage =
    reorderPoint > 0
      ? Math.min((currentStock / reorderPoint) * 100, 100)
      : 0;

  return (
    <article className="inventory-low-stock-row">
      <div className="inventory-low-stock-row__identity">
        <div
          className={`inventory-low-stock-row__icon inventory-low-stock-row__icon--${severity.tone}`}
        >
          <PackageOpen size={18} strokeWidth={1.8} />
        </div>

        <div className="inventory-low-stock-row__name">
          <h3>{item.name || "Unnamed Item"}</h3>

          <span>
            {item.sku || "SKU not assigned"}
          </span>
        </div>
      </div>

      <div className="inventory-low-stock-row__stock">
        <div className="inventory-low-stock-row__stock-head">
          <span>Current stock</span>

          <strong>
            {currentStock} {item.unit || ""}
          </strong>
        </div>

        <div className="inventory-low-stock-row__progress">
          <span
            className={`inventory-low-stock-row__progress-fill inventory-low-stock-row__progress-fill--${severity.tone}`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <span className="inventory-low-stock-row__threshold">
          Reorder point: {reorderPoint} {item.unit || ""}
        </span>
      </div>

      <span
        className={`inventory-low-stock-row__severity inventory-low-stock-row__severity--${severity.tone}`}
      >
        <span className="inventory-low-stock-row__severity-dot" />
        {severity.label}
      </span>

      <button
        type="button"
        className="inventory-low-stock-row__reorder"
        onClick={() => onReorder?.(item)}
        disabled={!onReorder}
      >
        Reorder
      </button>
    </article>
  );
}

function EmptyLowStockState() {
  return (
    <div className="inventory-low-stock__empty">
      <div className="inventory-low-stock__empty-icon">
        <CircleAlert size={20} strokeWidth={1.7} />
      </div>

      <div>
        <strong>No low-stock items</strong>

        <p>
          Items requiring replenishment will appear here when
          stock levels fall below their reorder thresholds.
        </p>
      </div>
    </div>
  );
}

function LowStockSkeleton() {
  return (
    <div className="inventory-low-stock__skeleton">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="inventory-low-stock-skeleton-row"
        >
          <span className="inventory-low-stock-skeleton-icon" />

          <div className="inventory-low-stock-skeleton-name">
            <span />
            <span />
          </div>

          <div className="inventory-low-stock-skeleton-stock">
            <span />
            <span />
            <span />
          </div>

          <span className="inventory-low-stock-skeleton-status" />

          <span className="inventory-low-stock-skeleton-button" />
        </div>
      ))}
    </div>
  );
}