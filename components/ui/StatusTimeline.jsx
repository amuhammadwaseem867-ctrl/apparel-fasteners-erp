"use client";

import { Check, Clock3, Circle, AlertTriangle, X } from "lucide-react";

import "./StatusTimeline.css";

const STATUS_ICONS = {
  completed: Check,
  current: Clock3,
  pending: Circle,
  warning: AlertTriangle,
  rejected: X,
};

export default function StatusTimeline({
  items = [],
  orientation = "vertical",
  size = "medium",
  showDates = true,
  showDescriptions = true,
  compact = false,
  className = "",
}) {
  if (!items.length) {
    return null;
  }

  return (
    <div
      className={[
        "status-timeline",
        `status-timeline--${orientation}`,
        `status-timeline--${size}`,
        compact ? "status-timeline--compact" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {items.map((item, index) => {
        const status = item.status || "pending";
        const Icon =
          item.icon || STATUS_ICONS[status] || Circle;

        const isLast = index === items.length - 1;

        return (
          <div
            key={item.id || `${item.label}-${index}`}
            className={[
              "status-timeline__item",
              `status-timeline__item--${status}`,
              item.active
                ? "status-timeline__item--active"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="status-timeline__track">
              <div className="status-timeline__marker">
                <Icon
                  size={14}
                  strokeWidth={2.4}
                />
              </div>

              {!isLast && (
                <span className="status-timeline__line" />
              )}
            </div>

            <div className="status-timeline__content">
              <div className="status-timeline__top">
                <div className="status-timeline__label">
                  {item.label}
                </div>

                {item.badge && (
                  <span className="status-timeline__badge">
                    {item.badge}
                  </span>
                )}
              </div>

              {showDescriptions &&
                item.description && (
                  <div className="status-timeline__description">
                    {item.description}
                  </div>
                )}

              {(showDates ||
                item.user ||
                item.reference) && (
                <div className="status-timeline__meta">
                  {showDates && item.date && (
                    <span>{item.date}</span>
                  )}

                  {item.user && (
                    <>
                      {item.date && (
                        <span className="status-timeline__separator">
                          ·
                        </span>
                      )}
                      <span>{item.user}</span>
                    </>
                  )}

                  {item.reference && (
                    <>
                      {(item.date || item.user) && (
                        <span className="status-timeline__separator">
                          ·
                        </span>
                      )}
                      <span>{item.reference}</span>
                    </>
                  )}
                </div>
              )}

              {item.children && (
                <div className="status-timeline__children">
                  {item.children}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* Convenience exports */

export function OrderStatusTimeline({
  orderNumber,
  className = "",
}) {
  const items = [
    {
      id: "order-created",
      label: "Order Created",
      description:
        "Sales order was created and submitted.",
      date: "06 Oct 2026 · 09:12",
      user: "Sales",
      status: "completed",
    },
    {
      id: "order-approved",
      label: "Approved",
      description:
        "Order has been approved for processing.",
      date: "06 Oct 2026 · 10:05",
      user: "Commercial Manager",
      status: "completed",
    },
    {
      id: "order-planning",
      label: "Planning",
      description:
        "Materials and production requirements are being planned.",
      date: "06 Oct 2026 · 11:20",
      user: "Planning",
      status: "current",
      active: true,
    },
    {
      id: "order-production",
      label: "Production",
      description:
        "Production has not started yet.",
      status: "pending",
    },
    {
      id: "order-qc",
      label: "Quality Control",
      description:
        "Final inspection is pending.",
      status: "pending",
    },
    {
      id: "order-dispatch",
      label: "Dispatch",
      description:
        "Shipment will be prepared after QC approval.",
      status: "pending",
    },
    {
      id: "order-delivered",
      label: "Delivered",
      description:
        "Customer delivery is pending.",
      status: "pending",
    },
  ];

  return (
    <div className="status-timeline-card">
      <div className="status-timeline-card__header">
        <div>
          <span className="status-timeline-card__eyebrow">
            Order Progress
          </span>

          <h3>{orderNumber || "Sales Order"}</h3>
        </div>
      </div>

      <StatusTimeline
        items={items}
        className={className}
      />
    </div>
  );
}

export function ProductionTimeline({
  className = "",
}) {
  const items = [
    {
      id: "released",
      label: "Released",
      description:
        "Production order released to the factory.",
      status: "completed",
      date: "06 Oct 2026 · 08:30",
      user: "Planning",
    },
    {
      id: "material",
      label: "Material Issued",
      description:
        "Required materials issued from inventory.",
      status: "completed",
      date: "06 Oct 2026 · 09:15",
      user: "Warehouse",
    },
    {
      id: "production",
      label: "Production",
      description:
        "Work order is currently being processed.",
      status: "current",
      active: true,
    },
    {
      id: "qc",
      label: "Quality Control",
      description:
        "Inspection will begin after production output.",
      status: "pending",
    },
    {
      id: "completed",
      label: "Completed",
      description:
        "Finished goods will be transferred to inventory.",
      status: "pending",
    },
  ];

  return (
    <StatusTimeline
      items={items}
      className={className}
    />
  );
}

export function DispatchTimeline({
  className = "",
}) {
  const items = [
    {
      id: "ready",
      label: "Ready",
      description:
        "Goods passed final QC and are ready for dispatch.",
      status: "completed",
      date: "06 Oct 2026 · 13:10",
      user: "QC",
    },
    {
      id: "packing",
      label: "Packing",
      description:
        "Goods are being packed for shipment.",
      status: "current",
      active: true,
    },
    {
      id: "shipped",
      label: "Shipped",
      description:
        "Carrier pickup is pending.",
      status: "pending",
    },
    {
      id: "in-transit",
      label: "In Transit",
      description:
        "Shipment has not left the facility.",
      status: "pending",
    },
    {
      id: "delivered",
      label: "Delivered",
      description:
        "Customer delivery is pending.",
      status: "pending",
    },
  ];

  return (
    <StatusTimeline
      items={items}
      className={className}
    />
  );
}