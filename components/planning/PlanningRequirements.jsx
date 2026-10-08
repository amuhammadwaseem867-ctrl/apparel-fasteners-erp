"use client";

import Link from "next/link";
import {
  PackageSearch,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Clock3,
  AlertTriangle,
} from "lucide-react";

import EmptyState from "@/components/ui/EmptyState";
import "./PlanningRequirements.css";

const STATUS_CONFIG = {
  covered: {
    label: "Covered",
    icon: CheckCircle2,
    className: "success",
  },
  pending: {
    label: "Pending",
    icon: Clock3,
    className: "warning",
  },
  shortage: {
    label: "Shortage",
    icon: AlertTriangle,
    className: "danger",
  },
};

export default function PlanningRequirements({
  requirements = [],
  href = "/planning/material-requirements",
}) {
  const hasData =
    Array.isArray(requirements) &&
    requirements.length > 0;

  return (
    <section className="planning-requirements">
      <div className="planning-requirements__header">
        <div className="planning-requirements__heading">
          <div className="planning-requirements__icon">
            <PackageSearch
              size={18}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </div>

          <div>
            <h2 className="planning-requirements__title">
              Material Requirements
            </h2>

            <p className="planning-requirements__description">
              Material quantities calculated from current demand.
            </p>
          </div>
        </div>

        <Link
          href={href}
          className="planning-requirements__link"
        >
          View all
          <ArrowUpRight
            size={15}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </Link>
      </div>

      {hasData ? (
        <div className="planning-requirements__table-wrap">
          <table className="planning-requirements__table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Required</th>
                <th>Available</th>
                <th>Net Requirement</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {requirements.map((requirement) => {
                const status =
                  STATUS_CONFIG[requirement.status] ||
                  STATUS_CONFIG.pending;

                const StatusIcon = status.icon;

                return (
                  <tr key={requirement.id}>
                    <td>
                      <div className="planning-requirements__material">
                        <span className="planning-requirements__material-icon">
                          <Boxes
                            size={14}
                            strokeWidth={1.8}
                            aria-hidden="true"
                          />
                        </span>

                        <div className="planning-requirements__material-info">
                          <span className="planning-requirements__material-name">
                            {requirement.materialName || "—"}
                          </span>

                          <span className="planning-requirements__material-code">
                            {requirement.materialCode || "—"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="planning-requirements__quantity">
                        {requirement.requiredQuantity ?? "—"}
                      </span>
                    </td>

                    <td>
                      <span className="planning-requirements__quantity">
                        {requirement.availableQuantity ?? "—"}
                      </span>
                    </td>

                    <td>
                      <span className="planning-requirements__quantity planning-requirements__quantity--strong">
                        {requirement.netRequirement ?? "—"}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`planning-requirements__status planning-requirements__status--${status.className}`}
                      >
                        <StatusIcon
                          size={13}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={PackageSearch}
          title="No material requirements"
          description="Calculated material requirements will appear here after planning data is available."
          size="small"
        />
      )}
    </section>
  );
}