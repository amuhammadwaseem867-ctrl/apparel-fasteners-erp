"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  Package,
} from "lucide-react";

import Card from "@/components/ui/Card";

import "./ProcurementRequirements.css";

const priorityConfig = {
  urgent: {
    label: "Urgent",
    className: "urgent",
  },
  high: {
    label: "High",
    className: "high",
  },
  normal: {
    label: "Normal",
    className: "normal",
  },
  low: {
    label: "Low",
    className: "low",
  },
};

export default function ProcurementRequirements({
  requirements = [],
  title = "Material Requirements",
  description = "Material shortages and procurement requirements requiring action.",
  href = "/procurement/requisitions",
  className = "",
}) {
  const hasRequirements =
    Array.isArray(requirements) && requirements.length > 0;

  return (
    <Card
      title={title}
      description={description}
      className={`procurement-requirements-card ${className}`}
      action={
        href ? (
          <Link
            href={href}
            className="procurement-requirements__view"
          >
            View requisitions
            <ArrowRight size={13} />
          </Link>
        ) : null
      }
    >
      {!hasRequirements ? (
        <div className="procurement-requirements__empty">
          <div className="procurement-requirements__empty-icon">
            <ClipboardList size={20} strokeWidth={1.7} />
          </div>

          <strong>No material requirements</strong>

          <p>
            Inventory shortages, MRP requirements and manual procurement
            requests will appear here once the backend is connected.
          </p>

          <Link href={href || "/procurement/requisitions"}>
            Open Requisitions
            <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="procurement-requirements">
          {requirements.map((requirement, index) => {
            const priority =
              priorityConfig[
                requirement.priority?.toLowerCase()
              ] || priorityConfig.normal;

            const RequirementIcon =
              requirement.icon || Package;

            const content = (
              <>
                <div className="procurement-requirement__icon">
                  <RequirementIcon
                    size={17}
                    strokeWidth={1.8}
                  />
                </div>

                <div className="procurement-requirement__content">
                  <div className="procurement-requirement__top">
                    <strong>
                      {requirement.material ||
                        requirement.title ||
                        "Material requirement"}
                    </strong>

                    <span
                      className={`procurement-requirement__priority procurement-requirement__priority--${priority.className}`}
                    >
                      {priority.label}
                    </span>
                  </div>

                  <div className="procurement-requirement__details">
                    {requirement.category && (
                      <span>{requirement.category}</span>
                    )}

                    {requirement.sku && (
                      <span>{requirement.sku}</span>
                    )}

                    {requirement.quantity != null && (
                      <span>
                        Qty: {requirement.quantity}
                        {requirement.unit
                          ? ` ${requirement.unit}`
                          : ""}
                      </span>
                    )}
                  </div>

                  {requirement.description && (
                    <p>{requirement.description}</p>
                  )}
                </div>

                {requirement.href && (
                  <ArrowRight
                    className="procurement-requirement__arrow"
                    size={15}
                  />
                )}
              </>
            );

            if (requirement.href) {
              return (
                <Link
                  key={requirement.id || index}
                  href={requirement.href}
                  className="procurement-requirement"
                >
                  {content}
                </Link>
              );
            }

            return (
              <div
                key={requirement.id || index}
                className="procurement-requirement"
              >
                {content}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}