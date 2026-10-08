"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  PackageX,
  CalendarDays,
} from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";
import "./PlanningShortages.css";

const PRIORITY_CONFIG = {
  critical: {
    label: "Critical",
    className: "critical",
  },
  high: {
    label: "High",
    className: "high",
  },
  medium: {
    label: "Medium",
    className: "medium",
  },
  low: {
    label: "Low",
    className: "low",
  },
};

export default function PlanningShortages({
  shortages = [],
  href = "/planning/shortages",
}) {
  const hasData =
    Array.isArray(shortages) &&
    shortages.length > 0;

  return (
    <section className="planning-shortages">
      <div className="planning-shortages__header">
        <div className="planning-shortages__heading">
          <div className="planning-shortages__icon">
            <AlertTriangle
              size={18}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </div>

          <div>
            <h2 className="planning-shortages__title">
              Shortage Monitor
            </h2>

            <p className="planning-shortages__description">
              Materials requiring procurement or production action.
            </p>
          </div>
        </div>

        <Link
          href={href}
          className="planning-shortages__link"
        >
          View shortages
          <ArrowUpRight
            size={15}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </Link>
      </div>

      {hasData ? (
        <div className="planning-shortages__list">
          {shortages.map((shortage) => {
            const priority =
              PRIORITY_CONFIG[shortage.priority] ||
              PRIORITY_CONFIG.medium;

            return (
              <div
                key={shortage.id}
                className="planning-shortage"
              >
                <div className="planning-shortage__main">
                  <div className="planning-shortage__material-icon">
                    <PackageX
                      size={17}
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  </div>

                  <div className="planning-shortage__content">
                    <div className="planning-shortage__title-row">
                      <h3 className="planning-shortage__material">
                        {shortage.materialName || "Unknown material"}
                      </h3>

                      <span
                        className={`planning-shortage__priority planning-shortage__priority--${priority.className}`}
                      >
                        {priority.label}
                      </span>
                    </div>

                    <span className="planning-shortage__code">
                      {shortage.materialCode || "—"}
                    </span>

                    <div className="planning-shortage__details">
                      <span>
                        Required:{" "}
                        <strong>
                          {shortage.requiredQuantity ?? "—"}
                        </strong>
                      </span>

                      <span>
                        Available:{" "}
                        <strong>
                          {shortage.availableQuantity ?? "—"}
                        </strong>
                      </span>

                      <span>
                        Shortage:{" "}
                        <strong>
                          {shortage.shortageQuantity ?? "—"}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="planning-shortage__date">
                  <CalendarDays
                    size={14}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />

                  <span>
                    {shortage.requiredDate || "Date pending"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={AlertTriangle}
          title="No shortages detected"
          description="Material shortages identified by MRP will appear here."
          size="small"
        />
      )}
    </section>
  );
}