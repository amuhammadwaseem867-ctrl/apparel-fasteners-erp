"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  History,
  ExternalLink,
} from "lucide-react";

import "./InventoryMovementSummary.css";

const MOVEMENT_TYPES = {
  receipt: {
    label: "Receipt",
    icon: ArrowDownLeft,
    tone: "success",
  },
  issue: {
    label: "Issue",
    icon: ArrowUpRight,
    tone: "warning",
  },
  transfer: {
    label: "Transfer",
    icon: ArrowLeftRight,
    tone: "info",
  },
  adjustment: {
    label: "Adjustment",
    icon: History,
    tone: "neutral",
  },
};

export default function InventoryMovementSummary({
  movements = [],
  loading = false,
  onViewAll,
}) {
  return (
    <section className="inventory-movement-summary">
      <div className="inventory-movement-summary__header">
        <div>
          <span className="inventory-movement-summary__eyebrow">
            Activity
          </span>

          <h2 className="inventory-movement-summary__title">
            Stock Movements
          </h2>

          <p className="inventory-movement-summary__description">
            Recent inventory movement activity across locations.
          </p>
        </div>

        <button
          type="button"
          className="inventory-movement-summary__view-button"
          onClick={onViewAll}
          disabled={!onViewAll}
        >
          View All
          <ExternalLink size={14} strokeWidth={1.8} />
        </button>
      </div>

      <div className="inventory-movement-summary__content">
        {loading ? (
          <MovementSkeleton />
        ) : movements.length > 0 ? (
          <div className="inventory-movement-summary__table">
            <div className="inventory-movement-summary__table-head">
              <span>Type</span>
              <span>Reference</span>
              <span>Location</span>
              <span>Quantity</span>
              <span>Date</span>
            </div>

            {movements.map((movement) => (
              <MovementRow
                key={movement.id}
                movement={movement}
              />
            ))}
          </div>
        ) : (
          <EmptyMovementState />
        )}
      </div>
    </section>
  );
}

function MovementRow({ movement }) {
  const type =
    MOVEMENT_TYPES[movement.type] || MOVEMENT_TYPES.adjustment;

  const Icon = type.icon;

  return (
    <div className="inventory-movement-row">
      <div className="inventory-movement-row__type">
        <span
          className={`inventory-movement-row__icon inventory-movement-row__icon--${type.tone}`}
        >
          <Icon size={15} strokeWidth={1.8} />
        </span>

        <span className="inventory-movement-row__type-label">
          {type.label}
        </span>
      </div>

      <span className="inventory-movement-row__reference">
        {movement.reference || "—"}
      </span>

      <span className="inventory-movement-row__location">
        {movement.location || "—"}
      </span>

      <span className="inventory-movement-row__quantity">
        {movement.quantity ?? 0}
      </span>

      <span className="inventory-movement-row__date">
        {movement.date || "—"}
      </span>
    </div>
  );
}

function EmptyMovementState() {
  return (
    <div className="inventory-movement-summary__empty">
      <div className="inventory-movement-summary__empty-icon">
        <History size={19} strokeWidth={1.7} />
      </div>

      <div className="inventory-movement-summary__empty-content">
        <strong>No stock movements yet</strong>

        <p>
          Inventory receipts, issues, transfers and adjustments
          will appear here once activity is recorded.
        </p>
      </div>
    </div>
  );
}

function MovementSkeleton() {
  return (
    <div className="inventory-movement-summary__skeleton">
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="inventory-movement-summary__skeleton-row"
        >
          <span className="inventory-movement-summary__skeleton-icon" />
          <span className="inventory-movement-summary__skeleton-line skeleton-reference" />
          <span className="inventory-movement-summary__skeleton-line skeleton-location" />
          <span className="inventory-movement-summary__skeleton-line skeleton-quantity" />
          <span className="inventory-movement-summary__skeleton-line skeleton-date" />
        </div>
      ))}
    </div>
  );
}