"use client";

import {
  Warehouse,
  MapPin,
  Package,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";

import "./InventoryWarehouseStatus.css";

const STATUS_CONFIG = {
  active: {
    label: "Active",
    tone: "success",
  },
  attention: {
    label: "Attention",
    tone: "warning",
  },
  inactive: {
    label: "Inactive",
    tone: "neutral",
  },
};

export default function InventoryWarehouseStatus({
  warehouses = [],
  loading = false,
  onViewAll,
}) {
  return (
    <section className="inventory-warehouse-status">
      <div className="inventory-warehouse-status__header">
        <div>
          <span className="inventory-warehouse-status__eyebrow">
            Locations
          </span>

          <h2 className="inventory-warehouse-status__title">
            Warehouse Status
          </h2>

          <p className="inventory-warehouse-status__description">
            Inventory availability and operational status by location.
          </p>
        </div>

        <button
          type="button"
          className="inventory-warehouse-status__view-button"
          onClick={onViewAll}
          disabled={!onViewAll}
        >
          View Warehouses
          <ArrowUpRight size={15} strokeWidth={1.8} />
        </button>
      </div>

      <div className="inventory-warehouse-status__content">
        {loading ? (
          <WarehouseSkeleton />
        ) : warehouses.length > 0 ? (
          <div className="inventory-warehouse-status__list">
            {warehouses.map((warehouse) => (
              <WarehouseRow
                key={warehouse.id}
                warehouse={warehouse}
              />
            ))}
          </div>
        ) : (
          <EmptyWarehouseState />
        )}
      </div>
    </section>
  );
}

function WarehouseRow({ warehouse }) {
  const status =
    STATUS_CONFIG[warehouse.status] ||
    STATUS_CONFIG.inactive;

  const capacity =
    typeof warehouse.capacity === "number"
      ? Math.min(Math.max(warehouse.capacity, 0), 100)
      : 0;

  return (
    <article className="inventory-warehouse-row">
      <div className="inventory-warehouse-row__identity">
        <div className="inventory-warehouse-row__icon">
          <Warehouse size={18} strokeWidth={1.8} />
        </div>

        <div className="inventory-warehouse-row__name">
          <h3>{warehouse.name || "Unnamed Warehouse"}</h3>

          {warehouse.location ? (
            <span>
              <MapPin size={12} strokeWidth={1.8} />
              {warehouse.location}
            </span>
          ) : (
            <span>No location specified</span>
          )}
        </div>
      </div>

      <div className="inventory-warehouse-row__metrics">
        <div className="inventory-warehouse-row__metric">
          <span>Items</span>
          <strong>{warehouse.items ?? 0}</strong>
        </div>

        <div className="inventory-warehouse-row__metric">
          <span>Quantity</span>
          <strong>{warehouse.quantity ?? 0}</strong>
        </div>

        <div className="inventory-warehouse-row__metric inventory-warehouse-row__metric--capacity">
          <div className="inventory-warehouse-row__capacity-head">
            <span>Capacity</span>
            <strong>{capacity}%</strong>
          </div>

          <div
            className="inventory-warehouse-row__capacity-bar"
            aria-label={`Warehouse capacity ${capacity}%`}
          >
            <span
              className={`inventory-warehouse-row__capacity-fill inventory-warehouse-row__capacity-fill--${status.tone}`}
              style={{ width: `${capacity}%` }}
            />
          </div>
        </div>
      </div>

      <span
        className={`inventory-warehouse-row__status inventory-warehouse-row__status--${status.tone}`}
      >
        <span className="inventory-warehouse-row__status-dot" />
        {status.label}
      </span>
    </article>
  );
}

function EmptyWarehouseState() {
  return (
    <div className="inventory-warehouse-status__empty">
      <div className="inventory-warehouse-status__empty-icon">
        <Warehouse size={20} strokeWidth={1.7} />
      </div>

      <div>
        <strong>No warehouses configured</strong>

        <p>
          Warehouse locations and inventory capacity will appear
          here once they are connected to the system.
        </p>
      </div>
    </div>
  );
}

function WarehouseSkeleton() {
  return (
    <div className="inventory-warehouse-status__skeleton">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="inventory-warehouse-skeleton-row"
        >
          <span className="inventory-warehouse-skeleton-icon" />

          <div className="inventory-warehouse-skeleton-content">
            <span className="inventory-warehouse-skeleton-line skeleton-name" />
            <span className="inventory-warehouse-skeleton-line skeleton-location" />
          </div>

          <span className="inventory-warehouse-skeleton-value" />
          <span className="inventory-warehouse-skeleton-value skeleton-value-small" />
          <span className="inventory-warehouse-skeleton-bar" />
          <span className="inventory-warehouse-skeleton-status" />
        </div>
      ))}
    </div>
  );
}