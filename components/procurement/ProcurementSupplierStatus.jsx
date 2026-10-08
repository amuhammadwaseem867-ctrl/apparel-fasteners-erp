"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, XCircle } from "lucide-react";

import Card from "@/components/ui/Card";

import "./ProcurementSupplierStatus.css";

const defaultStatuses = [
  {
    id: "approved",
    label: "Approved Suppliers",
    value: 0,
    description: "Approved for procurement",
    tone: "success",
    icon: CheckCircle2,
  },
  {
    id: "pending",
    label: "Pending Approval",
    value: 0,
    description: "Awaiting supplier review",
    tone: "warning",
    icon: Clock3,
  },
  {
    id: "inactive",
    label: "Inactive Suppliers",
    value: 0,
    description: "Currently unavailable",
    tone: "danger",
    icon: XCircle,
  },
];

export default function ProcurementSupplierStatus({
  statuses = defaultStatuses,
  title = "Supplier Status",
  description = "Supplier master approval and availability overview.",
  href = "/procurement/suppliers",
  className = "",
}) {
  const hasStatuses = Array.isArray(statuses) && statuses.length > 0;

  return (
    <Card
      title={title}
      description={description}
      className={`procurement-supplier-status-card ${className}`}
      action={
        href ? (
          <Link
            href={href}
            className="procurement-supplier-status__view"
          >
            Supplier Master
            <ArrowRight size={13} />
          </Link>
        ) : null
      }
    >
      {!hasStatuses ? (
        <div className="procurement-supplier-status__empty">
          <strong>No supplier status data</strong>

          <p>
            Supplier approval and availability information will appear after
            the supplier master is connected.
          </p>
        </div>
      ) : (
        <div className="procurement-supplier-status">
          {statuses.map((status) => {
            const Icon = status.icon || CheckCircle2;

            return (
              <div
                key={status.id || status.label}
                className="procurement-supplier-status__item"
              >
                <div
                  className={`procurement-supplier-status__icon procurement-supplier-status__icon--${
                    status.tone || "neutral"
                  }`}
                >
                  <Icon size={17} strokeWidth={1.8} />
                </div>

                <div className="procurement-supplier-status__content">
                  <strong>{status.label}</strong>

                  <span>{status.description}</span>
                </div>

                <strong className="procurement-supplier-status__value">
                  {status.value ?? 0}
                </strong>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}