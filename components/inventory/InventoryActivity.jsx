"use client";

import {
  ArrowDownToLine,
  ArrowLeftRight,
  ClipboardCheck,
  SlidersHorizontal,
  ShoppingCart,
  Warehouse,
  PackageCheck,
} from "lucide-react";

import "./InventoryActivity.css";

const ACTIVITY_CONFIG = {
  receipt: {
    label: "Stock Received",
    icon: ArrowDownToLine,
    tone: "success",
  },
  transfer: {
    label: "Stock Transferred",
    icon: ArrowLeftRight,
    tone: "info",
  },
  count: {
    label: "Stock Count",
    icon: ClipboardCheck,
    tone: "neutral",
  },
  adjustment: {
    label: "Stock Adjusted",
    icon: SlidersHorizontal,
    tone: "warning",
  },
  reorder: {
    label: "Reorder Requested",
    icon: ShoppingCart,
    tone: "danger",
  },
  warehouse: {
    label: "Warehouse Updated",
    icon: Warehouse,
    tone: "info",
  },
  dispatch: {
    label: "Stock Dispatched",
    icon: PackageCheck,
    tone: "success",
  },
};

function formatTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function InventoryActivity({
  activities = [],
  loading = false,
  title = "Recent Activity",
  description = "Latest inventory operations and stock events.",
  onViewAll,
}) {
  const hasActivities = activities.length > 0;

  return (
    <section className="inventory-activity">
      <div className="inventory-activity__header">
        <div>
          <span className="inventory-activity__eyebrow">
            Activity
          </span>

          <h2 className="inventory-activity__title">
            {title}
          </h2>

          <p className="inventory-activity__description">
            {description}
          </p>
        </div>

        {onViewAll && (
          <button
            type="button"
            className="inventory-activity__view-all"
            onClick={onViewAll}
          >
            View all
          </button>
        )}
      </div>

      <div className="inventory-activity__body">
        {loading ? (
          <div className="inventory-activity__loading">
            <div className="inventory-activity__skeleton inventory-activity__skeleton--large" />
            <div className="inventory-activity__skeleton" />
            <div className="inventory-activity__skeleton" />
            <div className="inventory-activity__skeleton" />
          </div>
        ) : !hasActivities ? (
          <div className="inventory-activity__empty">
            <div className="inventory-activity__empty-icon">
              <PackageCheck size={19} strokeWidth={1.8} />
            </div>

            <div>
              <h3>No inventory activity yet</h3>
              <p>
                Inventory activity will appear here once stock
                operations are recorded.
              </p>
            </div>
          </div>
        ) : (
          <div className="inventory-activity__list">
            {activities.map((activity) => {
              const config =
                ACTIVITY_CONFIG[activity.type] ||
                ACTIVITY_CONFIG.count;

              const Icon = config.icon;

              return (
                <article
                  className="inventory-activity__item"
                  key={activity.id}
                >
                  <div
                    className={`inventory-activity__icon inventory-activity__icon--${config.tone}`}
                  >
                    <Icon size={17} strokeWidth={1.8} />
                  </div>

                  <div className="inventory-activity__content">
                    <div className="inventory-activity__main">
                      <strong>
                        {activity.title || config.label}
                      </strong>

                      {activity.reference && (
                        <span className="inventory-activity__reference">
                          {activity.reference}
                        </span>
                      )}
                    </div>

                    {activity.description && (
                      <p>{activity.description}</p>
                    )}

                    <div className="inventory-activity__meta">
                      {activity.user && (
                        <span>{activity.user}</span>
                      )}

                      {activity.location && (
                        <>
                          <span className="inventory-activity__dot">
                            •
                          </span>
                          <span>{activity.location}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <time
                    className="inventory-activity__time"
                    dateTime={activity.timestamp || undefined}
                  >
                    {formatTime(activity.timestamp)}
                  </time>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}